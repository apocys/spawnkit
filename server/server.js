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
const REPO_DIR = process.env.SPAWNKIT_REPO || path.join(process.env.HOME, 'spawnkit');
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
      const repoVersionFile = path.join(REPO_DIR, 'server', 'version.json');
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
      `rsync -a --delete "${REPO_DIR}/server/" "${STATIC_DIR}/" --exclude='auto-sync.sh' --exclude='caddy-patch.sh'`,
      `rsync -a --delete "${REPO_DIR}/lib/" "${STATIC_DIR}/lib/" 2>/dev/null || true`,
      `rsync -a --delete "${REPO_DIR}/office-medieval/" "${STATIC_DIR}/office-medieval/" 2>/dev/null || true`,
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

function getAgents() {
  // Read agent config from workspace or provide defaults
  const agentsFile = path.join(WORKSPACE, 'agents.json');
  try {
    const data = readJSON(agentsFile);
    if (data && data.agents) return data;
  } catch(e) {}
  
  // Default agents based on SpawnKit configuration
  return { agents: [
    { id: 'sycopa', name: 'Sycopa', role: 'Chief of Staff', status: 'active', emoji: '🧠', description: 'Strategic planning and coordination' },
    { id: 'atlas', name: 'Atlas', role: 'Navigator', status: 'active', emoji: '🗺️', description: 'Research and analysis' },
    { id: 'forge', name: 'Forge', role: 'Builder', status: 'active', emoji: '🔨', description: 'Code and infrastructure' },
    { id: 'hunter', name: 'Hunter', role: 'Scout', status: 'active', emoji: '🎯', description: 'Market intelligence and opportunities' },
    { id: 'echo', name: 'Echo', role: 'Communicator', status: 'active', emoji: '📡', description: 'Channels and messaging' },
    { id: 'sentinel', name: 'Sentinel', role: 'Guardian', status: 'active', emoji: '🛡️', description: 'Security and quality assurance' }
  ]};
}
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
  // ─── Fleet Relay Proxy (peers/invite/pair/disconnect) ─────
  const FLEET_RELAY_URL = 'http://localhost:18790';
  const FLEET_RELAY_TOKEN = process.env.FLEET_RELAY_TOKEN || 'sk-fleet-2ad53564b03d9facbe3389bb5c461179ffc73af12e50ae00';

  // GET /api/fleet/peers — public, no auth needed
  if (req.url === '/api/fleet/peers' && req.method === 'GET') {
    try {
      const fr = await proxyFetch(FLEET_RELAY_URL + '/api/fleet/peers', '');
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(fr.ok ? 200 : 502);
      res.end(JSON.stringify(fr.ok ? fr.data : { error: 'Fleet relay unreachable' }));
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/remote/offices — maps to fleet relay peers (backward compat)
  if (req.url.startsWith('/api/remote/offices') && req.method === 'GET') {
    try {
      const fr = await proxyFetch(FLEET_RELAY_URL + '/api/fleet/stats', '');
      if (fr.ok && fr.data) {
        const officesObj = fr.data.offices || {};
        const officesArr = Object.entries(officesObj).map(([id, o]) => ({
          id, name: o.name, emoji: o.emoji, status: o.status,
          lastSeen: o.lastSeen, agents: o.state && o.state.agents ? o.state.agents : []
        }));
        const recentMessages = fr.data.recentMessages || [];
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, offices: officesArr, recentMessages }));
      } else {
        res.writeHead(502, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Fleet relay unreachable' }));
      }
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/fleet/invite — generate invite (requires SK auth)
  if (req.url === '/api/fleet/invite' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const resp = await new Promise((resolve, reject) => {
        const postData = JSON.stringify(body || {});
        const opts = {
          hostname: 'localhost', port: 18790, path: '/api/fleet/invite', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Authorization': 'Bearer ' + FLEET_RELAY_TOKEN }
        };
        const r = require('http').request(opts, (res2) => {
          let d = ''; res2.on('data', c => d += c);
          res2.on('end', () => { try { resolve({ status: res2.statusCode, data: JSON.parse(d) }); } catch(e) { reject(e); } });
        });
        r.on('error', reject);
        r.write(postData); r.end();
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resp.status);
      res.end(JSON.stringify(resp.data));
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/fleet/pair — pair with invite code (no auth needed)
  if (req.url === '/api/fleet/pair' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const resp = await new Promise((resolve, reject) => {
        const postData = JSON.stringify(body || {});
        const opts = {
          hostname: 'localhost', port: 18790, path: '/api/fleet/pair', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
        };
        const r = require('http').request(opts, (res2) => {
          let d = ''; res2.on('data', c => d += c);
          res2.on('end', () => { try { resolve({ status: res2.statusCode, data: JSON.parse(d) }); } catch(e) { reject(e); } });
        });
        r.on('error', reject);
        r.write(postData); r.end();
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resp.status);
      res.end(JSON.stringify(resp.data));
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // DELETE /api/fleet/peer/:id — disconnect a peer
  const peerDisconnectMatch = req.url.match(/^\/api\/fleet\/peer\/([a-zA-Z0-9_-]+)$/);
  if (peerDisconnectMatch && req.method === 'DELETE') {
    const peerId = peerDisconnectMatch[1];
    try {
      const resp = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'localhost', port: 18790, path: '/api/fleet/peer/' + peerId, method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + FLEET_RELAY_TOKEN }
        };
        const r = require('http').request(opts, (res2) => {
          let d = ''; res2.on('data', c => d += c);
          res2.on('end', () => { try { resolve({ status: res2.statusCode, data: JSON.parse(d) }); } catch(e) { reject(e); } });
        });
        r.on('error', reject);
        r.end();
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(resp.status);
      res.end(JSON.stringify(resp.data));
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

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

  // ─── Channel OAuth & Verification Routes ──────────────────
  const CHANNELS_FILE = path.join(WORKSPACE, '.spawnkit-channels.json');

  function readChannels() {
    try { return JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8')); }
    catch(e) { return {}; }
  }

  function writeChannels(data) {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(data, null, 2));
  }

  // Verify a channel's credentials by calling its real API
  async function verifyChannel(channel, config) {
    const https = require('https');
    const http_ = require('http');

    function apiGet(url, headers = {}) {
      const mod = url.startsWith('https') ? https : http_;
      return new Promise((resolve) => {
        const req = mod.get(url, { headers, timeout: 10000 }, (resp) => {
          let data = '';
          resp.on('data', c => data += c);
          resp.on('end', () => {
            try { resolve({ ok: resp.statusCode >= 200 && resp.statusCode < 300, status: resp.statusCode, data: JSON.parse(data) }); }
            catch(e) { resolve({ ok: false, status: resp.statusCode, data: data }); }
          });
        });
        req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
      });
    }

    switch (channel) {
      case 'telegram': {
        if (!config.token) return { ok: false, error: 'Bot token required' };
        // Validate format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
        if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(config.token)) {
          return { ok: false, error: 'Invalid token format. Expected: 123456789:ABCdef...' };
        }
        const result = await apiGet(`https://api.telegram.org/bot${config.token}/getMe`);
        if (result.ok && result.data?.ok) {
          const bot = result.data.result;
          return { ok: true, details: { botName: bot.first_name, username: bot.username, botId: bot.id } };
        }
        return { ok: false, error: result.data?.description || 'Invalid Telegram bot token' };
      }

      case 'discord': {
        if (!config.token) return { ok: false, error: 'Bot token required' };
        // Discord bot tokens are base64-ish strings
        if (config.token.length < 50) {
          return { ok: false, error: 'Token too short. Use the full bot token from Discord Developer Portal.' };
        }
        const result = await apiGet('https://discord.com/api/v10/users/@me', {
          'Authorization': `Bot ${config.token}`
        });
        if (result.ok && result.data?.id) {
          return { ok: true, details: { botName: result.data.username, botId: result.data.id, discriminator: result.data.discriminator } };
        }
        return { ok: false, error: result.data?.message || 'Invalid Discord bot token' };
      }

      case 'slack': {
        if (!config.token) return { ok: false, error: 'Bot token required' };
        if (!/^xoxb-/.test(config.token)) {
          return { ok: false, error: 'Invalid format. Slack bot tokens start with xoxb-' };
        }
        const result = await apiGet('https://slack.com/api/auth.test', {
          'Authorization': `Bearer ${config.token}`
        });
        if (result.ok && result.data?.ok) {
          return { ok: true, details: { team: result.data.team, user: result.data.user, teamId: result.data.team_id } };
        }
        return { ok: false, error: result.data?.error || 'Invalid Slack bot token' };
      }

      case 'whatsapp': {
        // WhatsApp Business API verification
        if (!config.token) return { ok: false, error: 'Access token required' };
        if (!config.phoneNumberId) {
          // Format-only validation if no phone number ID
          return { ok: true, details: { mode: 'token-only', note: 'Provide Phone Number ID for full verification' } };
        }
        const result = await apiGet(
          `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
          { 'Authorization': `Bearer ${config.token}` }
        );
        if (result.ok && result.data?.id) {
          return { ok: true, details: { phoneNumberId: result.data.id, displayName: result.data.verified_name || result.data.display_phone_number } };
        }
        return { ok: false, error: result.data?.error?.message || 'Invalid WhatsApp credentials' };
      }

      case 'signal': {
        // Signal doesn't have a public API for verification
        // We validate the phone number format and mark as pending linking
        if (!config.phoneNumber) return { ok: false, error: 'Phone number required' };
        if (!/^\+\d{8,15}$/.test(config.phoneNumber.replace(/[\s-]/g, ''))) {
          return { ok: false, error: 'Invalid phone format. Use international format: +33612345678' };
        }
        return { ok: true, details: { phoneNumber: config.phoneNumber, mode: 'device-linking', note: 'Complete linking in Signal app' } };
      }

      case 'github': {
        if (!config.token) return { ok: false, error: 'Personal Access Token required' };
        if (!/^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/.test(config.token)) {
          return { ok: false, error: 'Invalid format. GitHub tokens start with ghp_ or github_pat_' };
        }
        const ghResult = await apiGet('https://api.github.com/user', {
          'Authorization': `Bearer ${config.token}`,
          'User-Agent': 'SpawnKit/1.0'
        });
        if (ghResult.ok && ghResult.data?.login) {
          return { ok: true, details: { username: ghResult.data.login, name: ghResult.data.name || ghResult.data.login, repos: ghResult.data.public_repos } };
        }
        return { ok: false, error: ghResult.data?.message || 'Invalid GitHub token' };
      }

      case 'imessage': {
        // iMessage: check if we're on macOS and Messages.app is available
        try {
          const platform = require('os').platform();
          if (platform !== 'darwin') {
            return { ok: false, error: 'iMessage requires macOS' };
          }
          // Check if imsg CLI is available
          try {
            execSync('which imsg 2>/dev/null', { timeout: 3000 });
            return { ok: true, details: { mode: 'native', cli: 'imsg', platform: 'macOS' } };
          } catch(e) {
            return { ok: true, details: { mode: 'applescript', platform: 'macOS', note: 'Install imsg CLI for full features' } };
          }
        } catch(e) {
          return { ok: false, error: 'Could not detect macOS environment' };
        }
      }

      default:
        return { ok: false, error: `Unknown channel: ${channel}` };
    }
  }

  // POST /api/oc/channels/verify — Real API verification
  if (req.url === '/api/oc/channels/verify' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.channel) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Missing channel type' }));
      return;
    }
    try {
      const result = await verifyChannel(body.channel, body.config || body);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(result.ok ? 200 : 422);
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Verification failed: ' + e.message }));
    }
    return;
  }

  // GET /api/oc/channels/status — All connected channels
  if (req.url === '/api/oc/channels/status' && req.method === 'GET') {
    const saved = readChannels();
    // Also check OpenClaw config for already-configured channels
    const ocConfig = getConfig();
    const channels = [];

    // Merge saved channels
    for (const [id, ch] of Object.entries(saved)) {
      channels.push({ id, connected: true, ...ch });
    }

    // Check OpenClaw config for channels we didn't save but are configured
    if (ocConfig.channels) {
      for (const [id, conf] of Object.entries(ocConfig.channels)) {
        if (!saved[id] && conf.enabled !== false) {
          channels.push({ id, connected: true, source: 'openclaw', name: id, connectedAt: null });
        }
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ channels }));
    return;
  }

  // POST /api/oc/channels/save — Persist channel config
  if (req.url === '/api/oc/channels/save' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.channel) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Missing channel' }));
      return;
    }
    const saved = readChannels();
    saved[body.channel] = {
      name: body.name || body.channel,
      config: body.config || {},
      details: body.details || {},
      connectedAt: Date.now()
    };
    try {
      writeChannels(saved);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Failed to save: ' + e.message }));
    }
    return;
  }

  // DELETE /api/oc/channels/:id — Disconnect a channel
  if (req.url.startsWith('/api/oc/channels/') && req.method === 'DELETE') {
    const channelId = req.url.split('/').pop();
    const saved = readChannels();
    if (saved[channelId]) {
      delete saved[channelId];
      writeChannels(saved);
    }
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ─── Local API routes ────────────────────────────────────

  // POST /api/oc/chat — Send message to OpenClaw agent via gateway
  if (req.url.replace(/\?.*/, '') === '/api/oc/chat' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const message = body?.message;
    if (!message || typeof message !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing message field' }));
      return;
    }
    try {
      const OC_GATEWAY = 'http://localhost:18789';
      const OC_TOKEN = process.env.OC_GATEWAY_TOKEN || '2b1b2cdb509e42c71b487eca06502e794baff0d7e6a8e81e';

      // Detect persona prefix: [Speaking to Hunter] message
      let agentMessage = message;
      const personaMatch = message.match(/^\[Speaking to (\w+)\]\s*(.*)/s);
      if (personaMatch) {
        const personaName = personaMatch[1];
        const userText = personaMatch[2];
        // Load persona file if it exists
        const personaPath = path.join(__dirname, 'office-medieval', 'personalities', personaName.toLowerCase() + '.md');
        let personaCtx = '';
        try {
          if (fs.existsSync(personaPath)) {
            personaCtx = fs.readFileSync(personaPath, 'utf8');
          }
        } catch(e) {}
        if (personaCtx) {
          agentMessage = `The user is speaking to ${personaName} in the medieval castle UI. Respond FULLY IN CHARACTER as ${personaName}. Use their personality, speech style, and temperament. Do NOT break character or mention being Sycopa/an AI. Stay brief and medieval-flavored.\n\nPersona:\n${personaCtx}\n\nUser says: ${userText}`;
        } else {
          agentMessage = `The user is speaking to ${personaName} in the medieval castle UI. Respond in character as ${personaName}, a knight of the castle. Stay brief and medieval-flavored.\n\nUser says: ${userText}`;
        }
      }

      const resp = await fetch(OC_GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OC_TOKEN,
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages: [{ role: 'user', content: agentMessage }],
          stream: false,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[chat] Gateway error:', resp.status, errText);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Gateway error', status: resp.status }));
        return;
      }
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || '(No response)';
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, reply }));
    } catch (e) {
      console.error('[chat] Gateway send error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to reach gateway', detail: e.message }));
    }
    return;
  }

  // GET /api/oc/chat/transcript?last=N — Sanitized transcript (text-only, no tool calls)
  if (req.url.startsWith('/api/oc/chat/transcript') && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const url = new URL(req.url, 'http://localhost');
    const last = Math.min(parseInt(url.searchParams.get('last') || '15'), 50);
    try {
      const sessData = readJSON(SESSIONS_FILE);
      const mainSess = sessData?.['agent:main:main'];
      const transcriptPath = mainSess?.sessionFile;
      if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        res.writeHead(200);
        res.end(JSON.stringify({ messages: [] }));
        return;
      }
      const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
      const messages = [];
      for (let i = lines.length - 1; i >= 0 && messages.length < last * 3; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type !== 'message') continue;
          const msg = entry.message;
          if (!msg || msg.role === 'system') continue;
          // Extract text content only — skip tool calls/results
          let text = '';
          if (typeof msg.content === 'string') {
            text = msg.content;
          } else if (Array.isArray(msg.content)) {
            text = msg.content
              .filter(p => p.type === 'text' && typeof p.text === 'string')
              .map(p => p.text)
              .join(' ');
          }
          if (!text.trim()) continue;
          if (msg.role === 'toolResult') continue;
          // Truncate long messages
          if (text.length > 500) text = text.substring(0, 500) + '...';
          messages.unshift({ role: msg.role, text, ts: entry.timestamp });
        } catch(e) {}
      }
      res.writeHead(200);
      res.end(JSON.stringify({ messages: messages.slice(-last) }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ─── AI Provider Setup API ────────────────────────────────
  
  // GET /api/wizard/providers — list available provider presets
  if (req.url === '/api/wizard/providers' && req.method === 'GET') {
    const providers = [
      {
        id: 'anthropic', name: 'Anthropic', icon: '🟣', description: 'Claude models (Opus, Sonnet, Haiku)',
        authType: 'api_key', keyPlaceholder: 'sk-ant-...',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        models: [
          { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', recommended: true },
          { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
          { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5' }
        ],
        config: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic' }
      },
      {
        id: 'openai', name: 'OpenAI', icon: '🟢', description: 'GPT models (GPT-5, GPT-4o)',
        authType: 'api_key', keyPlaceholder: 'sk-...',
        keyUrl: 'https://platform.openai.com/api-keys',
        models: [
          { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', recommended: true },
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
        ],
        config: { baseUrl: 'https://api.openai.com/v1', api: 'openai-completions' }
      },
      {
        id: 'cliproxy', name: 'CLIProxyAPI', icon: '🔵', description: 'Claude via CLI Proxy — uses your Max/Pro subscription, no API costs',
        authType: 'oauth', oauthUrl: '/api/wizard/providers/cliproxy/auth',
        models: [
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Max)', recommended: true },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Max)' },
          { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Max)' }
        ],
        config: { baseUrl: 'http://127.0.0.1:8317/v1', api: 'openai-completions' }
      },
      {
        id: 'ollama', name: 'Ollama (Local)', icon: '🦙', description: 'Run models locally — free, private, no API key needed',
        authType: 'none',
        models: [
          { id: 'llama3.3', name: 'Llama 3.3 70B', recommended: true },
          { id: 'qwen2.5', name: 'Qwen 2.5 72B' },
          { id: 'glm-4.7-flash', name: 'GLM 4.7 Flash' }
        ],
        config: { baseUrl: 'http://localhost:11434/v1', api: 'openai-completions' }
      }
    ];
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, providers }));
    return;
  }

  // POST /api/wizard/providers/setup — configure a provider in OpenClaw
  if (req.url === '/api/wizard/providers/setup' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.providerId || !body.modelId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'providerId and modelId required' }));
        return;
      }
      
      const { spawnSync } = require('child_process');
      const results = [];
      
      // Provider presets
      const presets = {
        anthropic: {
          config: { api: 'anthropic' },
          baseUrl: 'https://api.anthropic.com/v1',
          authProfile: 'anthropic:default'
        },
        openai: {
          config: { api: 'openai-completions' },
          baseUrl: 'https://api.openai.com/v1',
          authProfile: 'openai:default'
        },
        cliproxy: {
          config: { api: 'openai-completions' },
          baseUrl: 'http://127.0.0.1:8317/v1',
          authProfile: 'openai:cliproxy'
        },
        ollama: {
          config: { api: 'openai-completions' },
          baseUrl: 'http://localhost:11434/v1',
          authProfile: 'openai:ollama'
        }
      };
      
      const preset = presets[body.providerId];
      if (!preset) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown provider: ' + body.providerId }));
        return;
      }
      
      // Build provider config
      const providerConfig = {
        baseUrl: body.baseUrl || preset.baseUrl,
        api: preset.config.api,
        models: [{
          id: body.modelId,
          name: body.modelName || body.modelId,
          reasoning: false,
          input: ['text', 'image'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 200000,
          maxTokens: 8192
        }]
      };
      
      // Add API key if provided (not for ollama/cliproxy-oauth)
      if (body.apiKey) {
        providerConfig.apiKey = body.apiKey;
      }
      
      // Set provider config via openclaw CLI
      const setProvider = spawnSync('openclaw', [
        'config', 'set',
        'models.providers.' + body.providerId,
        JSON.stringify(providerConfig)
      ], { timeout: 10000, encoding: 'utf8' });
      
      if (setProvider.error || setProvider.status !== 0) {
        results.push({ step: 'provider', status: 'failed', error: (setProvider.stderr || '').slice(0, 200) });
      } else {
        results.push({ step: 'provider', status: 'ok' });
      }
      
      // Set as default model
      const modelPath = body.providerId + '/' + body.modelId;
      const setModel = spawnSync('openclaw', [
        'config', 'set',
        'agents.defaults.model.primary',
        JSON.stringify(modelPath)
      ], { timeout: 10000, encoding: 'utf8' });
      
      if (setModel.error || setModel.status !== 0) {
        results.push({ step: 'default-model', status: 'failed', error: (setModel.stderr || '').slice(0, 200) });
      } else {
        results.push({ step: 'default-model', status: 'ok' });
      }
      
      // Set auth profile if API key provided
      if (body.apiKey && body.providerId !== 'ollama') {
        const authMode = body.providerId === 'anthropic' ? 'anthropic' : 'openai';
        const setAuth = spawnSync('openclaw', [
          'config', 'set',
          'auth.profiles.' + preset.authProfile,
          JSON.stringify({ provider: authMode, mode: 'api_key' })
        ], { timeout: 10000, encoding: 'utf8' });
        results.push({ step: 'auth', status: (setAuth.error || setAuth.status !== 0) ? 'failed' : 'ok' });
      }
      
      // Set model alias
      const setAlias = spawnSync('openclaw', [
        'config', 'set',
        'agents.defaults.models.' + modelPath,
        JSON.stringify({ alias: body.providerId })
      ], { timeout: 10000, encoding: 'utf8' });
      results.push({ step: 'alias', status: (setAlias.error || setAlias.status !== 0) ? 'failed' : 'ok' });
      
      const allOk = results.every(function(r) { return r.status === 'ok'; });
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(allOk ? 200 : 207);
      res.end(JSON.stringify({
        ok: allOk,
        model: modelPath,
        results,
        message: allOk ? 'Provider configured. Restart gateway to apply.' : 'Some steps failed — check results.',
        needsRestart: true
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/wizard/providers/test — test a provider connection
  if (req.url === '/api/wizard/providers/test' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.baseUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'baseUrl required' }));
        return;
      }
      
      const testUrl = body.baseUrl.replace(/\/+$/, '') + '/models';
      const headers = {};
      if (body.apiKey) headers['Authorization'] = 'Bearer ' + body.apiKey;
      if (body.apiKey && body.provider === 'anthropic') {
        headers['x-api-key'] = body.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
      
      const proto = testUrl.startsWith('https') ? require('https') : require('http');
      const testResult = await new Promise(function(resolve) {
        const r = proto.get(testUrl, { headers, timeout: 5000 }, function(resp) {
          let data = '';
          resp.on('data', function(c) { data += c; });
          resp.on('end', function() {
            if (resp.statusCode >= 200 && resp.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                const models = parsed.data || parsed.models || [];
                resolve({ ok: true, models: models.slice(0, 10).map(function(m) { return { id: m.id, name: m.id }; }) });
              } catch(e) { resolve({ ok: true, models: [] }); }
            } else {
              resolve({ ok: false, status: resp.statusCode, error: data.slice(0, 200) });
            }
          });
        });
        r.on('error', function(e) { resolve({ ok: false, error: e.message }); });
        r.on('timeout', function() { r.destroy(); resolve({ ok: false, error: 'Connection timeout' }); });
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(testResult));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ─── Setup Wizard API ─────────────────────────────────────
  const BLUEPRINTS_DIR = require('path').join(__dirname, 'blueprints');

  // GET /api/wizard/blueprints — list available blueprints
  if (req.url === '/api/wizard/blueprints' && req.method === 'GET') {
    try {
      const fs = require('fs');
      const path = require('path');
      const dirs = fs.readdirSync(BLUEPRINTS_DIR).filter(d => 
        fs.statSync(path.join(BLUEPRINTS_DIR, d)).isDirectory()
      );
      const blueprints = dirs.map(d => {
        try {
          const yaml = fs.readFileSync(path.join(BLUEPRINTS_DIR, d, 'config.yaml'), 'utf8');
          const name = (yaml.match(/^name:\s*(.+)$/m) || [])[1] || d;
          const desc = (yaml.match(/^description:\s*"?(.+?)"?\s*$/m) || [])[1] || '';
          const icon = (yaml.match(/^icon:\s*(.+)$/m) || [])[1] || '📦';
          const version = (yaml.match(/^version:\s*(.+)$/m) || [])[1] || '1.0.0';
          const featuresRaw = yaml.match(/features:\n((?:\s+-\s+.+\n?)+)/);
          const features = featuresRaw ? featuresRaw[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^\s*-\s*/, '').trim()) : [];
          return { id: d, name: name.trim(), description: desc.trim(), icon: icon.trim(), version, features };
        } catch(e) { return { id: d, name: d, description: '', icon: '📦', version: '1.0.0', features: [] }; }
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, blueprints }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/wizard/blueprint/:id — get blueprint details + variables
  const bpMatch = req.url.match(/^\/api\/wizard\/blueprint\/([a-zA-Z0-9_-]+)$/);
  if (bpMatch && req.method === 'GET') {
    try {
      const fs = require('fs');
      const path = require('path');
      const bpDir = path.join(BLUEPRINTS_DIR, bpMatch[1]);
      if (!fs.existsSync(bpDir)) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Blueprint not found'})); return; }
      const yaml = fs.readFileSync(path.join(bpDir, 'config.yaml'), 'utf8');
      
      // Parse variables from config.yaml
      const varsSection = yaml.match(/variables:\n((?:\s+\w+:.+\n?)+)/);
      const variables = {};
      if (varsSection) {
        varsSection[1].split('\n').filter(l => l.trim()).forEach(line => {
          const m = line.match(/^\s+(\w+):\s*\{(.+)\}/);
          if (m) {
            const key = m[1];
            const props = {};
            m[2].split(',').forEach(p => {
              const kv = p.match(/(\w+):\s*"?([^",}]+)"?/);
              if (kv) props[kv[1].trim()] = kv[2].trim();
            });
            variables[key] = props;
          }
        });
      }

      // List templates
      const files = fs.readdirSync(bpDir);
      const templates = files.filter(f => f.endsWith('.template')).map(f => f.replace('.template', ''));
      const skills = fs.existsSync(path.join(bpDir, 'skills')) ? fs.readdirSync(path.join(bpDir, 'skills')) : [];
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, id: bpMatch[1], variables, templates, skills, files }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/wizard/apply — apply a blueprint with variables
  if (req.url === '/api/wizard/apply' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.blueprintId) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'blueprintId required'})); return; }
      
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      // Sanitise blueprintId: alphanumeric + hyphens only, no path traversal
      const safeId = String(body.blueprintId).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId || safeId !== body.blueprintId) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Invalid blueprint id'})); return; }
      const bpDir = path.join(BLUEPRINTS_DIR, safeId);
      if (!bpDir.startsWith(BLUEPRINTS_DIR)) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Invalid blueprint path'})); return; }
      if (!fs.existsSync(bpDir)) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Blueprint not found'})); return; }
      
      const vars = body.variables || {};
      const workspace = vars.WORKSPACE || process.env.OPENCLAW_WORKSPACE || (process.env.HOME + '/clawd');
      vars.WORKSPACE = workspace;
      
      // Write vars file for bootstrap.sh
      fs.writeFileSync(path.join(bpDir, '.vars.json'), JSON.stringify(vars, null, 2));
      
      // Run bootstrap.sh
      let output = '';
      try {
        output = execSync(`bash "${path.join(bpDir, 'bootstrap.sh')}" "${workspace}" 2>&1`, {
          timeout: 30000,
          encoding: 'utf8',
          env: { ...process.env, HOME: process.env.HOME }
        });
      } finally {
        // Always clean up vars file (success or error)
        try { fs.unlinkSync(path.join(bpDir, '.vars.json')); } catch(e) {}
      }
      
      // Auto-register crons from crons.json
      const cronsFile = path.join(bpDir, 'crons.json');
      const cronResults = [];
      if (fs.existsSync(cronsFile)) {
        try {
          const crons = JSON.parse(fs.readFileSync(cronsFile, 'utf8'));
          for (const cron of crons) {
            // Substitute variables in prompts and schedule
            let prompt = cron.prompt || '';
            let name = cron.name || 'unnamed';
            let schedule = cron.schedule || '';
            let tz = cron.timezone || '';
            for (const [k, v] of Object.entries(vars)) {
              const re = new RegExp('\\{\\{' + k + '\\}\\}', 'g');
              prompt = prompt.replace(re, v);
              name = name.replace(re, v);
              schedule = schedule.replace(re, v);
              tz = tz.replace(re, v);
            }
            // Skip code-review cron if no repo configured
            if (cron.name === 'code-review' && (!vars.REPO_PATH || vars.REPO_PATH.trim() === '')) {
              cronResults.push({ name: cron.name, status: 'skipped', reason: 'no REPO_PATH' });
              continue;
            }
            // Build openclaw cron add command — use spawnSync (no shell) to prevent injection
            const { spawnSync } = require('child_process');
            const spawnArgs = ['cron', 'add', '--name', name, '--message', prompt, '--session', 'main', '--json'];
            if (schedule.startsWith('*/') || schedule.match(/^[0-9*,/\s]+$/)) {
              spawnArgs.push('--cron', schedule);
            }
            if (tz) spawnArgs.push('--tz', tz);
            try {
              const cronResult = spawnSync('openclaw', spawnArgs, { timeout: 10000, encoding: 'utf8' });
              if (cronResult.error) throw cronResult.error;
              const cronData = JSON.parse(cronResult.stdout);
              cronResults.push({ name: cron.name, status: 'registered', id: cronData.id });
            } catch(ce) {
              cronResults.push({ name: cron.name, status: 'failed', error: (ce.message || String(ce)).slice(0, 100) });
            }
          }
        } catch(cronErr) {
          cronResults.push({ name: 'parse', status: 'failed', error: cronErr.message.slice(0, 100) });
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        workspace,
        output: output.split('\n').filter(l => l.trim()).slice(-15),
        crons: cronResults,
        message: `Blueprint '${body.blueprintId}' applied to ${workspace}`
      }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message, output: e.stdout || '' }));
    }
    return;
  }

  // GET /api/wizard/status — check if workspace is already configured
  if (req.url === '/api/wizard/status' && req.method === 'GET') {
    try {
      const fs = require('fs');
      const workspace = process.env.OPENCLAW_WORKSPACE || (process.env.HOME + '/clawd');
      const files = ['SOUL.md', 'AGENTS.md', 'USER.md', 'MEMORY.md', 'IDENTITY.md', 'HEARTBEAT.md'];
      const existing = files.filter(f => fs.existsSync(require('path').join(workspace, f)));
      const configured = existing.length >= 3;
      const skillsDir = require('path').join(workspace, 'skills');
      const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(d => fs.statSync(require('path').join(skillsDir, d)).isDirectory()) : [];
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, configured, workspace, existingFiles: existing, skills, total: files.length, found: existing.length }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

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
      case '/api/oc/agents': data = getAgents(); break;
      case '/api/oc/skills': { const skillDirs = [require('path').join(require('os').homedir(), '.npm-global/lib/node_modules/openclaw/skills'), require('path').join(WORKSPACE, 'skills')]; const skills = []; const seen = new Set(); for (const dir of skillDirs) { try { const entries = require('fs').readdirSync(dir); for (const n of entries) { if (seen.has(n)) continue; try { const md = require('fs').readFileSync(require('path').join(dir, n, 'SKILL.md'), 'utf8'); const m = md.match(/description[:\s]*(.+)/i); skills.push({ id: n, description: m ? m[1].trim().slice(0,200) : '', installed: true }); seen.add(n); } catch(e) {} } } catch(e) {} } data = { skills }; break; }
      case '/api/oc/health': data = { ok: true, uptime: process.uptime() }; break;
      default: res.writeHead(404); res.end(JSON.stringify({error:'not found'})); return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  // Static files
  let filePath = req.url.split('?')[0];
  // Strip /office-executive/ prefix if present (Caddy proxies full path)
  if (filePath.startsWith('/office-executive/')) filePath = filePath.slice('/office-executive'.length);
  else if (filePath === '/office-executive') filePath = '/index.html';
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
            res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-store, no-cache, must-revalidate'}); res.end(html);
          });
          return;
        }
        // SPA fallback to root index.html
        fs.readFile(path.join(STATIC_DIR, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(500); res.end('Error'); return; }
          res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-store, no-cache, must-revalidate'}); res.end(html);
        });
      } else { res.writeHead(500); res.end('Error'); }
      return;
    }
    const ext = path.extname(fullPath);
    // HTML: no-store to prevent flash of old content. JS/CSS: no-cache (revalidate).
    const cachePolicy = ext === '.html' ? 'no-store, no-cache, must-revalidate' : 'no-cache';
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cachePolicy});
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏢 Executive Office serving on http://0.0.0.0:${PORT}`);
  console.log(`   Static: ${STATIC_DIR}`);
  console.log(`   API: /api/oc/*`);
  console.log(`   Workspace: ${WORKSPACE}`);
});
