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
const VERSION_FILE = path.join(__dirname, 'version.json');
const REPO_DIR = process.env.SPAWNKIT_REPO || path.join(process.env.HOME, 'fleetkit-v2');
const UPDATE_TOKEN = process.env.SK_API_TOKEN || '';

// ── Version Management ──────────────────────────────────────────────────
function getLocalVersion() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); }
  catch(e) { return { version: '0.0.0', buildDate: null, channel: 'unknown' }; }
}

function getLatestVersion() {
  // Check if git repo exists and has remote changes
  const local = getLocalVersion();
  const result = { current: local, latest: null, updateAvailable: false };
  try {
    if (fs.existsSync(path.join(REPO_DIR, '.git'))) {
      // Fetch latest from remote (silent, non-blocking)
      try { execSync('git -C ' + REPO_DIR + ' fetch --quiet 2>/dev/null', { timeout: 10000 }); } catch(e) {}
      
      const localHead = execSync('git -C ' + REPO_DIR + ' rev-parse HEAD 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
      const remoteHead = execSync('git -C ' + REPO_DIR + ' rev-parse origin/main 2>/dev/null || git -C ' + REPO_DIR + ' rev-parse origin/master 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
      
      // Check version.json in repo
      const repoVersionFile = path.join(REPO_DIR, 'office-executive', 'version.json');
      let repoVersion = local;
      try { repoVersion = JSON.parse(fs.readFileSync(repoVersionFile, 'utf8')); } catch(e) {}
      
      result.latest = repoVersion;
      result.localCommit = localHead.substring(0, 8);
      result.remoteCommit = remoteHead.substring(0, 8);
      result.updateAvailable = localHead !== remoteHead;
      
      // Get commit count behind
      try {
        const behind = execSync('git -C ' + REPO_DIR + ' rev-list HEAD..origin/main --count 2>/dev/null || echo 0', { encoding: 'utf8', timeout: 5000 }).trim();
        result.commitsBehind = parseInt(behind) || 0;
      } catch(e) { result.commitsBehind = 0; }
    }
  } catch(e) { result.error = e.message; }
  return result;
}

function performUpdate() {
  const log = [];
  try {
    // 1. Pull latest from git
    log.push('Pulling latest from git...');
    const pullOut = execSync('git -C ' + REPO_DIR + ' pull --ff-only 2>&1', { encoding: 'utf8', timeout: 30000 });
    log.push(pullOut.trim());
    
    // 2. Sync to live directory (same as auto-sync.sh)
    log.push('Syncing to live directory...');
    const syncCmds = [
      `rsync -a --delete "${REPO_DIR}/office-executive/" "${STATIC_DIR}/" --exclude='auto-sync.sh' --exclude='caddy-patch.sh'`,
      `rsync -a --delete "${REPO_DIR}/lib/" "${STATIC_DIR}/lib/" 2>/dev/null || true`,
      `rsync -a --delete "${REPO_DIR}/office-medieval/" "${path.dirname(STATIC_DIR)}/office-medieval/" 2>/dev/null || true`,
    ];
    for (const cmd of syncCmds) {
      try { execSync(cmd, { timeout: 15000 }); } catch(e) { log.push('Warning: ' + e.message); }
    }
    
    // 3. Record deploy
    const commit = execSync('git -C ' + REPO_DIR + ' rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
    fs.writeFileSync('/tmp/.last-deploy-commit', commit);
    log.push(`Deployed commit: ${commit.substring(0, 8)}`);
    log.push('Update complete! Server will restart...');
    
    // 4. Schedule restart (give time to send response)
    setTimeout(() => { process.exit(0); }, 1500); // systemd will restart us
    
    return { ok: true, log };
  } catch(e) {
    log.push('ERROR: ' + e.message);
    return { ok: false, log, error: e.message };
  }
}

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

// Helper: read POST body as JSON
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
  });
}

// Helper: proxy fetch to a remote gateway
async function proxyFetch(url, token) {
  const https = url.startsWith('https') ? require('https') : require('http');
  return new Promise((resolve) => {
    const req = https.get(url, { headers: token ? { 'Authorization': 'Bearer ' + token } : {}, timeout: 8000 }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try { resolve({ ok: resp.statusCode === 200, status: resp.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ ok: false, status: resp.statusCode, data: null }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ─── Auth validation endpoint ────────────────────────────
  if (req.url === '/api/auth/validate' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.url) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Missing gateway URL' }));
      return;
    }
    // Try to reach the gateway's health endpoint
    const gatewayUrl = body.url.replace(/\/+$/, '');
    const token = body.token || '';
    const result = await proxyFetch(gatewayUrl + '/api/oc/health', token);
    res.setHeader('Content-Type', 'application/json');
    if (result.ok) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, gateway: gatewayUrl, health: result.data }));
    } else {
      res.writeHead(502);
      res.end(JSON.stringify({ ok: false, error: result.error || 'Gateway unreachable', status: result.status }));
    }
    return;
  }

  // ─── Remote proxy endpoint ───────────────────────────────
  if (req.url.startsWith('/api/remote/') && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.url || !body.endpoint) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Missing url or endpoint' }));
      return;
    }
    const gatewayUrl = body.url.replace(/\/+$/, '');
    const token = body.token || '';
    const result = await proxyFetch(gatewayUrl + body.endpoint, token);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(result.ok ? 200 : 502);
    res.end(JSON.stringify(result.ok ? result.data : { error: result.error || 'Remote fetch failed' }));
    return;
  }

  // ─── Version & Update endpoints ───────────────────────────
  if (req.url === '/api/oc/version' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const versionInfo = getLatestVersion();
    res.writeHead(200);
    res.end(JSON.stringify(versionInfo));
    return;
  }

  if (req.url === '/api/oc/update' && req.method === 'POST') {
    // Auth check — require SK_API_TOKEN
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');
    if (!UPDATE_TOKEN || token !== UPDATE_TOKEN) {
      res.writeHead(401, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    const result = performUpdate();
    res.writeHead(result.ok ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  // ─── Local API routes ────────────────────────────────────
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
      case '/api/oc/chat/history': data = getChat(); break;
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
  // Directory URLs: append index.html (e.g. /office-medieval/ → /office-medieval/index.html)
  if (filePath.endsWith('/')) filePath += 'index.html';
  
  const fullPath = path.join(STATIC_DIR, filePath);
  // Security: prevent directory traversal
  if (!fullPath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Try as directory: /office-medieval → /office-medieval/index.html
        const dirIndex = path.join(STATIC_DIR, filePath, 'index.html');
        if (dirIndex.startsWith(STATIC_DIR) && fs.existsSync(dirIndex)) {
          fs.readFile(dirIndex, (e3, html) => {
            if (e3) { res.writeHead(500); res.end('Error'); return; }
            res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-cache'}); res.end(html);
          });
          return;
        }
        // SPA fallback to root index.html
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
