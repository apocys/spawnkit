#!/usr/bin/env node
/**
 * Executive Office Production Server
 * Serves static files + API bridge on a single port
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.PORT || '8765');
const WORKSPACE = process.env.WORKSPACE || process.env.HOME + '/.openclaw/workspace';
const SESSIONS_FILE = process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';
const STATIC_DIR = __dirname;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch(e) { return null; } }

function getSessions() {
  const data = readJSON(SESSIONS_FILE);
  if (!data) return [];
  const sessions = data.sessions || data;
  if (typeof sessions !== 'object') return [];
  return Object.entries(sessions).map(([key, s]) => ({
    key, kind: key.includes(':subagent:') ? 'subagent' : (key.includes(':cron:') ? 'cron' : 'main'),
    label: s.label || s.displayName || key.split(':').pop(),
    displayName: s.displayName || s.label || key,
    status: (Date.now() - (s.updatedAt || 0)) < 300000 ? 'active' : 'idle',
    model: s.model || 'unknown', totalTokens: s.totalTokens || 0,
    lastActive: s.updatedAt || null, channel: s.lastChannel || s.channel || 'unknown'
  }));
}

function getMemory() {
  const memDir = path.join(WORKSPACE, 'memory');
  const mainFile = path.join(WORKSPACE, 'MEMORY.md');
  const todoFile = path.join(WORKSPACE, 'TODO.md');
  const files = [];
  try { fs.readdirSync(memDir).forEach(f => { try { const s = fs.statSync(path.join(memDir, f)); files.push({name:f,size:s.size,modified:s.mtimeMs}); } catch(e){} }); } catch(e){}
  let main = ''; try { main = fs.readFileSync(mainFile, 'utf8'); } catch(e){}
  let todo = ''; try { todo = fs.readFileSync(todoFile, 'utf8'); } catch(e){}
  return { main, todo, files };
}

function getChat() {
  // Read the main session transcript
  const agentsDir = process.env.HOME + '/.openclaw/agents/main/sessions';
  const sessionsFile = path.join(agentsDir, 'sessions.json');
  console.log('[chat] agentsDir:', agentsDir, 'exists:', fs.existsSync(agentsDir));
  const sessData = readJSON(sessionsFile);
  if (!sessData) { console.log('[chat] sessions.json not readable'); return { messages: [] }; }
  
  // Find main session transcript path
  const sessions = sessData.sessions || sessData;
  let transcriptPath = null;
  for (const [key, s] of Object.entries(sessions)) {
    if (key === 'agent:main:main' && s.transcriptPath) {
      transcriptPath = s.transcriptPath;
      break;
    }
  }
  
  if (!transcriptPath) {
    // Fallback: find newest .jsonl in sessions dir or workspace
    const searchDirs = [
      path.join(agentsDir),
      WORKSPACE
    ];
    for (const dir of searchDirs) {
      try {
        const jFiles = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => ({
          name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs
        })).sort((a, b) => b.mtime - a.mtime);
        if (jFiles.length > 0) { transcriptPath = jFiles[0].path; break; }
      } catch(e){}
    }
  }
  
  console.log('[chat] transcriptPath:', transcriptPath, 'exists:', transcriptPath ? fs.existsSync(transcriptPath) : 'null');
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return { messages: [] };
  
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf8');
    const lines = raw.trim().split('\n').slice(-100); // Last 100 lines
    const messages = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        // OpenClaw format: { type, message: { role, content } }
        const msg = obj.message || obj;
        const role = msg.role;
        if (role && (role === 'user' || role === 'assistant')) {
          let content = '';
          if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          }
          if (content && content.trim().length > 0) {
            messages.push({ role, content: content.substring(0, 1000), timestamp: obj.timestamp || 0 });
          }
        }
      } catch(e){}
    }
    return { messages: messages.slice(-50) };
  } catch(e) {
    return { messages: [] };
  }
}

function getConfig() {
  const c = readJSON(process.env.HOME + '/.openclaw/openclaw.json');
  if (!c) return {};
  const safe = {...c};
  if (safe.gateway?.auth) delete safe.gateway.auth.token;
  if (safe.channels?.telegram) delete safe.channels.telegram.botToken;
  return safe;
}

function getCrons() {
  try {
    const ocPath = ['/usr/local/bin/openclaw', '/opt/homebrew/bin/openclaw', process.env.HOME + '/.local/bin/openclaw']
      .find(p => fs.existsSync(p));
    if (ocPath) {
      const out = execSync(ocPath + ' cron list --json 2>/dev/null', {timeout:10000,encoding:'utf8'});
      const parsed = JSON.parse(out);
      return { jobs: Array.isArray(parsed) ? parsed : (parsed.jobs || []) };
    }
  } catch(e){}
  return { jobs: [] };
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API routes
  if (req.url.startsWith('/api/oc/')) {
    res.setHeader('Content-Type', 'application/json');
    const route = req.url.replace(/\?.*/, '');
    let data;
    switch(route) {
      case '/api/oc/sessions': data = getSessions(); break;
      case '/api/oc/memory': data = getMemory(); break;
      case '/api/oc/config': data = getConfig(); break;
      case '/api/oc/crons': data = getCrons(); break;
      case '/api/oc/chat': data = getChat(); break;
      case '/api/oc/agents': data = { agents: [] }; break;
      case '/api/oc/health': data = { ok: true, uptime: process.uptime() }; break;
      default: res.writeHead(404); res.end(JSON.stringify({error:'not found'})); return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  // Static files
  let filePath = req.url.split('?')[0];
  if (filePath === '/' || filePath === '') filePath = '/index.html';
  
  const fullPath = path.join(STATIC_DIR, filePath);
  // Security: prevent directory traversal
  if (!fullPath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback
        fs.readFile(path.join(STATIC_DIR, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(500); res.end('Error'); return; }
          res.writeHead(200, {'Content-Type': 'text/html'}); res.end(html);
        });
      } else { res.writeHead(500); res.end('Error'); }
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏢 Executive Office serving on http://0.0.0.0:${PORT}`);
  console.log(`   Static: ${STATIC_DIR}`);
  console.log(`   API: /api/oc/*`);
  console.log(`   Workspace: ${WORKSPACE}`);
});
