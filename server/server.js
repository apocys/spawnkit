#!/usr/bin/env node
/**
 * Executive Office Production Server
 * Serves static files + API bridge on a single port
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { verifyChannel } = require('./channel-verifier');
const { generateSOUL, generateIDENTITY, generateAGENTS } = require('./agent-templates');

const PORT = parseInt(process.env.PORT || '8765');
const WORKSPACE = process.env.WORKSPACE || process.env.HOME + '/.openclaw/workspace';
const SESSIONS_FILE = process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';
const MISSIONS_FILE = path.join(WORKSPACE, '.spawnkit-missions.json');
const STATIC_DIR = __dirname;
const MissionOrchestrator = require('./mission-orchestrator');
const registerDashboardRoutes = require('./dashboard-api').registerDashboardRoutes || require('./dashboard-api');
const { getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getTasks, getSkills, getLocalVersion, getLatestVersion } = require('./lib/oc-reader');
const { proxyRequest, proxyFetch, cors, readBody } = require('./lib/proxy-client');
const VERSION_FILE = path.join(__dirname, 'version.json');
const REPO_DIR = process.env.SPAWNKIT_REPO || path.join(process.env.HOME, 'spawnkit');
const UPDATE_TOKEN = process.env.SK_API_TOKEN || '';

// ── OpenClaw Gateway Connection ─────────────────────────────────────────
const OC_GATEWAY = process.env.OC_GATEWAY_URL || 'http://localhost:18789';
let OC_TOKEN = process.env.OC_GATEWAY_TOKEN || '';
if (!OC_TOKEN) {
  try {
    const ocConfig = JSON.parse(fs.readFileSync(path.join(process.env.HOME || '', '.openclaw', 'openclaw.json'), 'utf8'));
    OC_TOKEN = ocConfig?.gateway?.auth?.token || '';
  } catch(e) { console.warn('[server] Could not read OC gateway token from config'); }
}

// ── Mission Orchestrator ────────────────────────────────────────────────
const missionOrch = new MissionOrchestrator({
  workspace: WORKSPACE,
  gatewayUrl: OC_GATEWAY,
  gatewayToken: OC_TOKEN,
  sessionsFile: SESSIONS_FILE,
});
missionOrch.resumeActivePolling();

// ── Version Management ──────────────────────────────────────────────────
// getLocalVersion and getLatestVersion → moved to ./lib/oc-reader.js

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
      `rsync -a --delete "${REPO_DIR}/server/" "${STATIC_DIR}/" --exclude='auto-sync.sh' --exclude='caddy-patch.sh' --exclude='_old_root/'`,
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

// readJSON, getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getLocalVersion, getLatestVersion
// → moved to ./lib/oc-reader.js
// cors, readBody, proxyRequest, proxyFetch
// → moved to ./lib/proxy-client.js
function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch(e) { return null; } }

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ─── Live Dashboard API ───────────────────────────────────
  if (req.url.startsWith('/api/dashboard/')) {
    const handled = await registerDashboardRoutes(req, res, {
      ocGateway: OC_GATEWAY,
      ocToken: OC_TOKEN,
      workspace: WORKSPACE,
      missionsFile: MISSIONS_FILE,
    });
    if (handled) return;
  }

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
  const FLEET_RELAY_URL = process.env.FLEET_RELAY_URL || 'http://localhost:18790';
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

  // GET /api/fleet/status — proxy to fleet relay stats (used by MC Remote tab)
  if (req.url === '/api/fleet/status' && req.method === 'GET') {
    try {
      const fr = await proxyFetch(FLEET_RELAY_URL + '/api/fleet/stats', FLEET_RELAY_TOKEN);
      if (fr.ok && fr.data) {
        // Normalize data for mc-center.js: { instances: [...] }
        const offices = fr.data.offices || {};
        const instances = Object.entries(offices).map(([id, o]) => ({
          id, name: o.name || id, status: o.status || 'unknown',
          lastSeen: o.lastSeen, agents: o.state && o.state.agents ? o.state.agents : [],
          inbox: []
        }));
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ instances, raw: fr.data }));
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

  // GET /api/fleet/mailbox — proxy to fleet relay mailbox (relay messages)
  if (req.url.startsWith('/api/fleet/mailbox') && req.method === 'GET') {
    try {
      const qs = req.url.includes('?') ? req.url.split('?')[1] : '';
      const fr = await proxyFetch(FLEET_RELAY_URL + '/api/fleet/mailbox' + (qs ? '?' + qs : ''), FLEET_RELAY_TOKEN);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(fr.ok ? 200 : 502);
      res.end(JSON.stringify(fr.ok ? fr.data : { error: 'Fleet relay unreachable' }));
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ALL /api/arena/* — proxy to fleet relay (ArenaAPI lives there)
  if (req.url.startsWith('/api/arena')) {
    try {
      const body = req.method === 'POST' ? await readBody(req) : null;
      const fr = await proxyRequest(req.method, FLEET_RELAY_URL + req.url, FLEET_RELAY_TOKEN, body);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(fr.status || (fr.ok ? 200 : 502));
      res.end(fr.raw || JSON.stringify({ error: 'Arena relay error' }));
    } catch(e) {
      res.writeHead(502, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: e.message }));
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
          hostname: 'localhost', port: parseInt(new URL(FLEET_RELAY_URL).port || '18790'), path: '/api/fleet/invite', method: 'POST',
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
          hostname: 'localhost', port: parseInt(new URL(FLEET_RELAY_URL).port || '18790'), path: '/api/fleet/pair', method: 'POST',
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
          hostname: 'localhost', port: parseInt(new URL(FLEET_RELAY_URL).port || '18790'), path: '/api/fleet/peer/' + peerId, method: 'DELETE',
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

  // ─── Deploy Assets (static files for cloud-init) ────────────────────
  if (req.url.startsWith('/api/deploy/assets/') && req.method === 'GET') {
    const assetName = req.url.replace('/api/deploy/assets/', '').split('?')[0];
    const ASSETS_DIR = require('path').join(process.env.HOME || '/home/apocyz_runner', 'managed-deploy');
    const assetPath = require('path').join(ASSETS_DIR, assetName);
    // Security: only serve files directly in ASSETS_DIR (no path traversal)
    // Block dotfiles (.env, .htpasswd, etc.) and restrict to allowed extensions
    const allowedExts = new Set(['.js', '.json', '.gz', '.tar', '.sh', '.txt', '.yaml', '.yml']);
    const assetExt = require('path').extname(assetName);
    if (
      !assetPath.startsWith(ASSETS_DIR) ||
      assetName.includes('..') ||
      assetName.includes('/') ||
      assetName.startsWith('.') ||
      assetName.includes('/.') ||
      !allowedExts.has(assetExt)
    ) {
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'forbidden'}));
      return;
    }
    try {
      const data = require('fs').readFileSync(assetPath);
      const ext = require('path').extname(assetName);
      const mime = {'.js':'application/javascript','.json':'application/json','.gz':'application/gzip','.tar':'application/x-tar','.sh':'text/x-shellscript'}[ext] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'public, max-age=300'});
      res.end(data);
    } catch(e) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error:'Asset not found: ' + assetName}));
    }
    return;
  }

  // ─── Deploy Provisioning Proxy (routes to provisioning API on :3456) ────
  if (req.url.startsWith('/api/deploy/') && (req.method === 'POST' || req.method === 'GET')) {
    // Auth: require Bearer token OR same-origin (dashboard UI)
    const deployAuthHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const deployOrigin = req.headers.origin || '';
    const deployReferer = req.headers.referer || '';
    const deploySelfHosts = ['app.spawnkit.ai', 'localhost:' + PORT, '127.0.0.1:' + PORT];
    const deployIsSameOrigin = deploySelfHosts.some(h => deployOrigin.includes(h) || deployReferer.includes(h));
    if (!deployIsSameOrigin && (!OC_TOKEN || deployAuthHeader !== OC_TOKEN)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    const provisionUrl = 'http://localhost:3456' + req.url;
    const DEPLOY_BYPASS_CODE = process.env.DEPLOY_ACCESS_CODE || '';
    
    if (req.method === 'POST') {
      // Handle POST: read body, check for useServerBypass flag
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          // If useServerBypass flag is set, inject the server-side bypass code
          if (data.useServerBypass && DEPLOY_BYPASS_CODE) {
            data.accessCode = DEPLOY_BYPASS_CODE;
            delete data.useServerBypass;
          }
          
          const proxyReq = require('http').request(provisionUrl, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          }, (proxyRes) => {
            let responseData = '';
            proxyRes.on('data', c => responseData += c);
            proxyRes.on('end', () => {
              res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(responseData);
            });
          });
          proxyReq.on('error', (e) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Provisioning service unavailable: ' + e.message }));
          });
          proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Provisioning service timeout' }));
          });
          proxyReq.write(JSON.stringify(data));
          proxyReq.end();
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
    } else {
      // Handle GET: simple proxy
      const proxyReq = require('http').request(provisionUrl, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }, (proxyRes) => {
        let data = '';
        proxyRes.on('data', c => data += c);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });
      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provisioning service unavailable: ' + e.message }));
      });
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Provisioning service timeout' }));
      });
      proxyReq.end();
    }
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

  // ─── Google OAuth ──────────────────────────────────────────
  // Client-side uses Google Identity Services (GSI) to get ID token
  // Server verifies token via Google's tokeninfo endpoint

  if (req.url === '/api/auth/google' && req.method === 'POST') {
    const body = await readBody(req);
    const credential = body && body.credential;
    if (!credential) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Missing credential (Google ID token)' }));
      return;
    }
    try {
      // Verify the ID token with Google
      const https = require('https');
      const verifyResult = await new Promise(function (resolve, reject) {
        https.get('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), function (resp) {
          let data = '';
          resp.on('data', function (c) { data += c; });
          resp.on('end', function () {
            try { resolve({ status: resp.statusCode, data: JSON.parse(data) }); }
            catch (e) { reject(e); }
          });
        }).on('error', reject);
      });

      if (verifyResult.status !== 200 || verifyResult.data.error) {
        res.writeHead(401, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Invalid Google token', detail: verifyResult.data.error || 'verification failed' }));
        return;
      }

      const googleUser = verifyResult.data;
      const userProfile = {
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        picture: googleUser.picture || '',
        sub: googleUser.sub,
        emailVerified: googleUser.email_verified === 'true'
      };

      // Store user profile in workspace
      const profilePath = require('path').join(WORKSPACE, '.spawnkit-user.json');
      try {
        fs.writeFileSync(profilePath, JSON.stringify(userProfile, null, 2));
      } catch(e) { /* non-critical */ }

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, user: userProfile }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Google verification failed: ' + e.message }));
    }
    return;
  }

  // GET /api/auth/user — get current user profile
  if (req.url === '/api/auth/user' && req.method === 'GET') {
    const profilePath = require('path').join(WORKSPACE, '.spawnkit-user.json');
    try {
      if (fs.existsSync(profilePath)) {
        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, user: profile }));
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true, user: null }));
      }
    } catch(e) {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, user: null }));
    }
    return;
  }

  // POST /api/auth/logout — clear user profile
  if (req.url === '/api/auth/logout' && req.method === 'POST') {
    const profilePath = require('path').join(WORKSPACE, '.spawnkit-user.json');
    try { fs.unlinkSync(profilePath); } catch(e) {}
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
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

  // ═══ AGENT CREATION SYSTEM ═══════════════════════════════════════════
  const AGENTS_BASE_DIR = path.join(WORKSPACE, 'fleet', 'agents');



  // GET /api/oc/agents — List all agents
  if (req.url === '/api/oc/agents' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { spawnSync } = require('child_process');
      const ocBinList = process.env.OC_BIN || '/home/apocyz_runner/.npm-global/bin/openclaw';
      const spawnEnvList = { ...process.env, PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin' };
      const result = spawnSync(ocBinList, ['agents', 'list', '--json'], { encoding: 'utf8', timeout: 10000, env: spawnEnvList });
      const agents = JSON.parse(result.stdout || '[]');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, agents }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/oc/agents/create — Create a new agent
  if (req.url === '/api/oc/agents/create' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const { name, displayName, role, model, traits, skills, theme, emoji, customInstructions } = body || {};

    if (!name || !displayName) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'name and displayName required' }));
      return;
    }

    // Sanitize agent name (slug)
    const agentId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const agentDir = path.join(AGENTS_BASE_DIR, agentId);

    try {
      // Check if agent already exists
      if (fs.existsSync(agentDir)) {
        res.writeHead(409);
        res.end(JSON.stringify({ error: 'Agent already exists: ' + agentId }));
        return;
      }

      // Create workspace directory
      fs.mkdirSync(agentDir, { recursive: true });

      const config = { name: agentId, displayName, role: role || 'General Assistant', model: model || 'sonnet', traits: traits || [], skills: skills || [], theme: theme || 'executive', emoji: emoji || '⚔️', customInstructions: customInstructions || '' };

      // Generate workspace files
      fs.writeFileSync(path.join(agentDir, 'SOUL.md'), generateSOUL(config));
      fs.writeFileSync(path.join(agentDir, 'IDENTITY.md'), generateIDENTITY(config));
      fs.writeFileSync(path.join(agentDir, 'AGENTS.md'), generateAGENTS(config));
      fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), '# MEMORY.md\n\nFresh agent — no memories yet.\n');
      fs.writeFileSync(path.join(agentDir, 'TODO.md'), '# TODO.md\n\nNo tasks yet.\n');
      fs.writeFileSync(path.join(agentDir, 'TOOLS.md'), '# TOOLS.md\n\nStandard tooling.\n');
      fs.writeFileSync(path.join(agentDir, 'USER.md'), '# USER.md\n\nUser context provided by SpawnKit.\n');

      // Copy skills if requested
      if (config.skills.length > 0) {
        const skillsDir = path.join(agentDir, 'skills');
        fs.mkdirSync(skillsDir, { recursive: true });
        // Note: actual skill installation would use clawhub or symlinks
        // For now, create a SKILLS.md reference
        fs.writeFileSync(path.join(agentDir, 'SKILLS.md'), '# Skills\n\n' + config.skills.map(s => '- ' + s).join('\n') + '\n');
      }

      // Register with OpenClaw
      const { spawnSync } = require('child_process');
      const modelMap = { opus: 'claudemax/claude-opus-4-6', sonnet: 'claudemax/claude-sonnet-4-6', codex: 'codex/codex-mini-latest' };
      const modelId = modelMap[config.model] || config.model || modelMap.sonnet;

      // Ensure openclaw binary is on PATH regardless of server launch environment
      const ocBin = process.env.OC_BIN || require('child_process').execSync('which openclaw 2>/dev/null || echo ""').toString().trim() || '/home/apocyz_runner/.npm-global/bin/openclaw';
      const spawnEnv = { ...process.env, PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin' };

      const addResult = spawnSync(ocBin, [
        'agents', 'add', agentId,
        '--workspace', agentDir,
        '--model', modelId,
        '--non-interactive'
      ], { encoding: 'utf8', timeout: 15000, env: spawnEnv });

      if (addResult.error || addResult.status !== 0) {
        // Clean up on failure
        fs.rmSync(agentDir, { recursive: true, force: true });
        const detail = (addResult.stderr || addResult.stdout || addResult.error?.message || '').slice(0, 500);
        console.error('[agents] openclaw agents add failed:', detail, 'status:', addResult.status, 'bin:', ocBin);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'openclaw agents add failed', detail }));
        return;
      }

      // Set identity
      spawnSync(ocBin, [
        'agents', 'set-identity',
        '--agent', agentId,
        '--from-identity',
        '--workspace', agentDir
      ], { encoding: 'utf8', timeout: 10000, env: spawnEnv });

      console.log('[SpawnKit] Agent Creation v2.1.0-medieval-agents — created agent:', agentId, 'workspace:', agentDir);

      res.writeHead(201);
      res.end(JSON.stringify({ ok: true, agentId, displayName, workspace: agentDir, model: modelId }));
    } catch (e) {
      console.error('[agents] Creation error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Agent creation failed', detail: e.message }));
    }
    return;
  }

  // DELETE /api/oc/agents/:id
  const agentDeleteMatch = req.url.match(/^\/api\/oc\/agents\/([a-z0-9-]+)$/) ;
  if (agentDeleteMatch && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json');
    const agentId = agentDeleteMatch[1];
    if (agentId === 'main') {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Cannot delete main agent' }));
      return;
    }
    try {
      const { spawnSync } = require('child_process');
      const ocBinDel = process.env.OC_BIN || '/home/apocyz_runner/.npm-global/bin/openclaw';
      const spawnEnvDel = { ...process.env, PATH: (process.env.PATH || '') + ':/home/apocyz_runner/.npm-global/bin' };
      const result = spawnSync(ocBinDel, ['agents', 'delete', agentId, '--force'], { encoding: 'utf8', timeout: 10000, env: spawnEnvDel });
      // Also remove workspace
      const agentDir = path.join(AGENTS_BASE_DIR, agentId);
      if (fs.existsSync(agentDir)) fs.rmSync(agentDir, { recursive: true, force: true });
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, deleted: agentId }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/oc/agents/:id/chat — Send message to a specific agent
  const agentChatMatch = req.url.match(/^\/api\/oc\/agents\/([a-z0-9-]+)\/chat$/);
  if (agentChatMatch && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const agentId = agentChatMatch[1];
    const body = await readBody(req);
    const message = body?.message;
    if (!message) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing message' }));
      return;
    }
    try {
      const resp = await fetch(OC_GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OC_TOKEN },
        body: JSON.stringify({
          model: 'openclaw:' + agentId,
          messages: [{ role: 'user', content: message }],
          stream: false,
        }),
      });
      if (!resp.ok) {
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Gateway error', status: resp.status }));
        return;
      }
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || '(No response)';
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, reply, agentId }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ═══ END AGENT CREATION SYSTEM ═══════════════════════════════════════

    // ── MCP Server Management ────────────────────────────────────────────
  const OC_CONFIG_PATH = path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');

  function readOcConfig() {
    try { return JSON.parse(fs.readFileSync(OC_CONFIG_PATH, 'utf8')); } catch(e) { return {}; }
  }
  function writeOcConfig(config) {
    fs.writeFileSync(OC_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  }

  if (req.url === '/api/oc/mcp' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const config = readOcConfig();
      // MCP servers can live under tools.mcpServers (OpenClaw convention)
      const mcpServers = config.tools?.mcpServers || {};
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, servers: mcpServers }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.url === '/api/oc/mcp' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const { name, transport, command, url: mcpUrl, env: mcpEnv } = body || {};
    if (!name) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing server name' }));
      return;
    }
    try {
      const config = readOcConfig();
      if (!config.tools) config.tools = {};
      if (!config.tools.mcpServers) config.tools.mcpServers = {};
      const entry = { transport: transport || 'stdio' };
      if (transport === 'sse' && mcpUrl) entry.url = mcpUrl;
      else if (command) entry.command = command;
      if (mcpEnv && typeof mcpEnv === 'object' && Object.keys(mcpEnv).length > 0) entry.env = mcpEnv;
      config.tools.mcpServers[name] = entry;
      writeOcConfig(config);
      console.log('[mcp] Added MCP server:', name);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, server: name }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/oc/mcp/') && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json');
    const serverName = decodeURIComponent(req.url.replace('/api/oc/mcp/', '').split('?')[0]);
    if (!serverName) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing server name' }));
      return;
    }
    try {
      const config = readOcConfig();
      if (config.tools?.mcpServers?.[serverName]) {
        delete config.tools.mcpServers[serverName];
        writeOcConfig(config);
        console.log('[mcp] Removed MCP server:', serverName);
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, removed: serverName }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Agent Configuration ───────────────────────────────────────────────
  if (req.url.replace(/\?.*/, '') === '/api/oc/agents/config' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const config = readOcConfig();
      const agentsConfig = config.agents || {};
      const queryAgentId = new URL(req.url, 'http://localhost').searchParams.get('agentId');
      // Read per-agent files from fleet/agents/
      const agentsDir = path.join(WORKSPACE, 'fleet', 'agents');
      const agentFiles = {};
      if (fs.existsSync(agentsDir)) {
        const dirs = queryAgentId ? [queryAgentId] : fs.readdirSync(agentsDir);
        dirs.forEach(function(dir) {
          const configPath = path.join(agentsDir, dir, 'config.json');
          if (fs.existsSync(configPath)) {
            try { agentFiles[dir] = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch(e) {}
          }
        });
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, global: queryAgentId ? undefined : agentsConfig, agents: agentFiles }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.url === '/api/oc/agents/config' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const { agentId, model, skills, traits, name: agentName } = body || {};
    if (!agentId) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing agentId' }));
      return;
    }
    try {
      // Persist to fleet/agents/<agentId>/config.json
      const agentsDir = path.join(WORKSPACE, 'fleet', 'agents');
      const agentDir = path.join(agentsDir, agentId);
      if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
      const configPath = path.join(agentDir, 'config.json');
      let existing = {};
      if (fs.existsSync(configPath)) {
        try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch(e) {}
      }
      if (model) existing.model = model;
      if (skills) existing.skills = skills;
      if (traits) existing.traits = traits;
      if (agentName) existing.name = agentName;
      existing.updatedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf8');
      console.log('[agents] Updated config for:', agentId);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, agentId, config: existing }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.url.replace(/\?.*/, '') === '/api/brainstorm' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const question = body?.question;
    const complexity = body?.complexity || 'quick';
    console.log('[brainstorm] question:', (question||'').substring(0, 80), '| complexity:', complexity);
    if (!question || typeof question !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing question field' }));
      return;
    }
    try {
      // Route brainstorm to the main agent via gateway chat completions
      const brainstormPrompt = question;
      const resp = await fetch(OC_GATEWAY + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + OC_TOKEN,
        },
        body: JSON.stringify({
          model: 'openclaw:main',
          messages: [{ role: 'user', content: brainstormPrompt }],
          stream: false,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('[brainstorm] Gateway error:', resp.status, errText.substring(0, 200));
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Gateway error', status: resp.status }));
        return;
      }
      const data = await resp.json();
      const answer = data?.choices?.[0]?.message?.content || '(No response from agent)';
      console.log('[brainstorm] Answer received:', answer.substring(0, 80));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, answer, complexity }));
    } catch (e) {
      console.error('[brainstorm] Error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Brainstorm failed', detail: e.message }));
    }
    return;
  }

  // POST /api/oc/chat — Send message to OpenClaw agent via gateway
  if (req.url.replace(/\?.*/, '') === '/api/oc/chat' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    const message = body?.message;
    const targetSession = body?.sessionKey; // Optional: route to sub-agent session
    console.log('[chat-route] message:', (message||'').substring(0, 80), '| sessionKey:', targetSession || 'none');
    if (!message || typeof message !== 'string') {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing message field' }));
      return;
    }
    try {

      // If targeting a specific sub-agent session, use sessions_send
      if (targetSession && targetSession !== 'agent:main:main') {
        const resp = await fetch(OC_GATEWAY + '/api/sessions/' + encodeURIComponent(targetSession) + '/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OC_TOKEN,
          },
          body: JSON.stringify({ message }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('[chat] Session send error:', resp.status, errText);
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'Session send error', status: resp.status }));
          return;
        }
        const data = await resp.json();
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, reply: data?.reply || data?.message || '(Awaiting response...)' }));
        return;
      }

      // Detect persona prefix: [Speaking to Hunter] message
      let agentMessage = message;
      const personaMatch = message.match(/^\[Speaking to (\w+)\]\s*(.*)/s);
      console.log('[chat-route] persona match:', personaMatch ? personaMatch[1] : 'none', '| raw message start:', message.substring(0, 60));
      
      if (personaMatch) {
        // PERSONA CHAT — direct to LLM provider, bypassing OpenClaw gateway entirely
        // CLIProxyAPI (port 8317) gives us clean, stateless completions with full context.
        const personaName = personaMatch[1];
        const userText = personaMatch[2];
        const personaPath = path.join(__dirname, 'office-medieval', 'personalities', personaName.toLowerCase() + '.md');
        let personaCtx = '';
        try {
          if (fs.existsSync(personaPath)) {
            personaCtx = fs.readFileSync(personaPath, 'utf8');
          }
        } catch(e) {}

        // Load agent-specific memory from their workspace
        let memoryCtx = '';
        const isSycopa = personaName.toLowerCase() === 'sycopa';
        if (isSycopa) {
          // Sycopa = main session = read main MEMORY.md
          try { memoryCtx = fs.readFileSync(path.join(WORKSPACE, 'MEMORY.md'), 'utf8').substring(0, 3000); } catch(e) {}
        } else {
          // Other agents: read their own workspace MEMORY.md if it exists
          const AGENTS_BASE = path.join(WORKSPACE, 'fleet', 'agents');
          const agentMemPath = path.join(AGENTS_BASE, personaName.toLowerCase(), 'MEMORY.md');
          try {
            if (fs.existsSync(agentMemPath)) {
              memoryCtx = fs.readFileSync(agentMemPath, 'utf8').substring(0, 2000);
            }
          } catch(e) {}
        }

        // Fallback role descriptions if no personality file
        const KNIGHT_ROLES = {
          sycopa: 'the Lord Commander and digital alter ego of Kira (the castle lord). Cool, direct, action-oriented. No fluff.',
          forge:    'the Master Builder, responsible for code and infrastructure. Gruff, practical, proud of craftsmanship.',
          atlas:    'the Navigator, handles research and analysis. Scholarly, curious, loves maps and knowledge.',
          hunter:   'the Scout, market intelligence and opportunities. Sharp-eyed, competitive, always tracking prey.',
          echo:     'the Communicator, handles channels and messaging. Swift, reliable, carries every word faithfully.',
          sentinel: 'the Guardian, security and quality assurance. Vigilant, stern, trusts nothing without verification.',
        };
        const roleDesc = KNIGHT_ROLES[personaName.toLowerCase()] || 'a loyal knight of the castle';

        let systemPrompt = personaCtx
          ? `You are ${personaName}, a knight in a medieval castle. Respond FULLY IN CHARACTER using the personality below. Stay concise (2-5 sentences). Never break character, never mention AI.\n\n${personaCtx}`
          : `You are ${personaName}, ${roleDesc}. You serve in a medieval castle. Respond in character — concise, never break character, never mention being an AI.`;

        if (memoryCtx) {
          systemPrompt += `\n\n## Your Memory (what you know)\n${memoryCtx}`;
        }

        console.log('[chat-persona] Direct LLM call for', personaName, '| has personality file:', !!personaCtx);

        try {
          // Direct call to CLIProxyAPI — clean stateless completion
          const LLM_URL = process.env.LLM_PROXY_URL || 'http://127.0.0.1:8317';
          const LLM_MODEL = process.env.LLM_PERSONA_MODEL || 'claude-sonnet-4-6';
          
          const resp = await fetch(LLM_URL + '/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: LLM_MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
              ],
              stream: false,
              max_tokens: 300,
            }),
          });
          
          if (!resp.ok) {
            const errText = await resp.text();
            console.error('[chat-persona] LLM error:', resp.status, errText.substring(0, 200));
            res.writeHead(502);
            res.end(JSON.stringify({ error: 'LLM provider error', status: resp.status }));
            return;
          }
          
          const data = await resp.json();
          const reply = data?.choices?.[0]?.message?.content || '(The knight remains silent...)';
          console.log('[chat-persona]', personaName, 'replied:', reply.substring(0, 60));
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, reply, persona: personaName }));
          return;
        } catch (e) {
          console.error('[chat-persona] Direct LLM failed:', e.message);
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'LLM connection failed', details: e.message }));
          return;
        }
      }

      // DEFAULT: No persona — send to main session (Sycopa)
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

  // ─── Mission Houses API ──────────────────────────────────
  // Auth: reject requests from external origins (CSRF protection)
  // Accept: same-origin fetch (no Origin header), localhost, or valid Referer
  if (req.url.startsWith('/api/oc/missions') && (req.method === 'POST' || req.method === 'DELETE')) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';
    const isLocal = !origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('app.spawnkit.ai');
    const refOk = !referer || referer.includes('localhost') || referer.includes('127.0.0.1') || referer.includes('app.spawnkit.ai');
    if (!isLocal || !refOk) {
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Forbidden — invalid origin' }));
      return;
    }
  }

  // GET /api/oc/missions — list all missions
  if (req.url === '/api/oc/missions' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      res.writeHead(200);
      res.end(JSON.stringify({ missions: data }));
    } catch(e) {
      res.writeHead(200);
      res.end(JSON.stringify({ missions: [] }));
    }
    return;
  }

  // POST /api/oc/missions — save all missions (full sync)
  if (req.url === '/api/oc/missions' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > 500_000) { req.destroy(); res.writeHead(413); res.end('Payload too large'); return; }
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const missions = data.missions || data;
        if (!Array.isArray(missions)) throw new Error('missions must be an array');
        fs.writeFileSync(MISSIONS_FILE, JSON.stringify(missions, null, 2));
        console.log('[Missions] Saved', missions.length, 'missions');
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, count: missions.length }));
      } catch(e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // POST /api/oc/missions/create — append a single new mission (used by /mission Telegram command)
  if (req.url === '/api/oc/missions/create' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const body = await readBody(req);
      if (!body || !body.name) throw new Error('Missing required field: name');
      const HOUSE_COLORS = ['#6366f1','#10b981','#f43f5e','#f59e0b','#0ea5e9','#a855f7','#f97316','#14b8a6','#ec4899','#84cc16','#06b6d4','#ef4444'];
      const HOUSE_POSITIONS = [
        {x:12,z:18},{x:-12,z:18},{x:14,z:22},{x:-14,z:22},{x:10,z:24},{x:-10,z:24},
        {x:16,z:20},{x:-16,z:20},{x:12,z:26},{x:-12,z:26},{x:16,z:26},{x:-16,z:26},
      ];
      const existing = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const active = existing.filter(m => m.status !== 'archived');
      const usedPositions = active.map(m => m.position).filter(Boolean);
      const nextPos = HOUSE_POSITIONS.find(p => !usedPositions.some(u => u.x === p.x && u.z === p.z)) || HOUSE_POSITIONS[active.length % HOUSE_POSITIONS.length];
      const colorIdx = existing.length % HOUSE_COLORS.length;
      const ICONS = ['🌐','📱','🎮','🛡️','🔮','📦','🎯','⚗️','🗂️','🚀','💎','🏗️'];
      const mission = {
        id: 'mission_' + Math.random().toString(36).slice(2, 15),
        name: body.name,
        icon: body.icon || ICONS[existing.length % ICONS.length],
        status: body.status || 'active',
        color: body.color || HOUSE_COLORS[colorIdx],
        agents: body.agents || ['Sycopa'],
        description: body.description || body.name,
        goal: body.goal || body.description || body.name,
        tasks: Array.isArray(body.tasks) ? body.tasks : [],
        position: nextPos,
        source: body.source || 'telegram',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      existing.push(mission);
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(existing, null, 2));
      console.log('[Missions] Created:', mission.id, mission.name);
      res.writeHead(201);
      res.end(JSON.stringify({ ok: true, mission }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/oc/missions/:id — fetch single mission by id
  const missionGetMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)$/);
  if (missionGetMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const id = missionGetMatch[1];
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (!mission) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      res.writeHead(200);
      res.end(JSON.stringify(mission));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // PATCH /api/oc/missions/:id/tasks/:taskId — granular task update
  const missionTaskPatchMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/tasks\/([a-zA-Z0-9_.-]+)$/);
  if (missionTaskPatchMatch && req.method === 'PATCH') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    try {
      const [, id, taskId] = missionTaskPatchMatch;
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (!mission) { res.writeHead(404); res.end(JSON.stringify({ error: 'Mission not found' })); return; }
      const task = (mission.tasks || []).find(t => t.id === taskId);
      if (!task) { res.writeHead(404); res.end(JSON.stringify({ error: 'Task not found' })); return; }
      const taskAllowed = ['status', 'assignedAgent', 'subagentSessionId', 'subtasks', 'text'];
      taskAllowed.forEach(k => { if (body && k in body) task[k] = body[k]; });
      mission.updated = new Date().toISOString();
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, mission, task }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // PATCH /api/oc/missions/:id — partial update (tasks, status, name, etc.)
  const missionPatchMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)$/);
  if (missionPatchMatch && req.method === 'PATCH') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    try {
      const id = missionPatchMatch[1];
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (!mission) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
      // Apply partial updates — only allow safe fields
      const allowed = ['tasks', 'status', 'name', 'description', 'agents', 'icon', 'color', 'goal', 'metadata'];
      allowed.forEach(k => { if (body && k in body) mission[k] = body[k]; });
      mission.updated = new Date().toISOString();
      fs.writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, mission }));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // DELETE /api/oc/missions/:id — archive a mission
  const missionDeleteMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_]+)$/);
  if (missionDeleteMatch && req.method === 'DELETE') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const id = missionDeleteMatch[1];
      const data = fs.existsSync(MISSIONS_FILE) ? JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8')) : [];
      const mission = data.find(m => m.id === id);
      if (mission) {
        mission.status = 'archived';
        fs.writeFileSync(MISSIONS_FILE, JSON.stringify(data, null, 2));
      }
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, archived: id }));
    } catch(e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ─── Mission Orchestrator API ─────────────────────────────
  // POST /api/oc/missions/:id/activate — activate a mission (send briefs to agents)
  const missionActivateMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/activate$/);
  if (missionActivateMatch && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    try {
      const result = await missionOrch.activate(missionActivateMatch[1]);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/oc/missions/:id/status — live mission status with agent sessions
  const missionStatusMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/status$/);
  if (missionStatusMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const status = missionOrch.getStatus(missionStatusMatch[1]);
    if (!status) { res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return; }
    res.writeHead(200);
    res.end(JSON.stringify(status));
    return;
  }

  // POST /api/oc/missions/:id/chat — send a message in mission context
  const missionChatMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/chat$/);
  if (missionChatMatch && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    const body = await readBody(req);
    if (!body?.message) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing message' })); return; }
    try {
      const result = await missionOrch.sendChat(missionChatMatch[1], body.message, body.agent || null);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/oc/missions/:id/chat — get mission chat history
  const missionChatGetMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/chat$/);
  if (missionChatGetMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const messages = missionOrch.getChatHistory(missionChatGetMatch[1]);
    res.writeHead(200);
    res.end(JSON.stringify({ messages }));
    return;
  }

  // GET /api/oc/missions/:id/log — event log
  const missionLogMatch = req.url.match(/^\/api\/oc\/missions\/([a-zA-Z0-9_-]+)\/log$/);
  if (missionLogMatch && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const log = missionOrch.getLog(missionLogMatch[1]);
    res.writeHead(200);
    res.end(JSON.stringify({ log }));
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

  // ── Setup Wizard API ──────────────────────────────────────

  // GET /api/setup/status — aggregate status of all 6 setup steps
  if (req.url === '/api/setup/status' && req.method === 'GET') {
    cors(res);
    try {
      const fs = require('fs');
      const path = require('path');
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      const steps = [
        { id: 'cliproxy', name: 'CLIProxyAPI', status: 'pending', details: '' },
        { id: 'gateway', name: 'OpenClaw Gateway', status: 'pending', details: '' },
        { id: 'channels', name: 'Channels', status: 'pending', details: '' },
        { id: 'fleet', name: 'Fleet Nodes', status: 'pending', details: '' },
        { id: 'skills', name: 'Skills', status: 'pending', details: '' },
        { id: 'test', name: 'End-to-End Test', status: 'pending', details: 'Run manually' }
      ];

      // Step 0: CLIProxyAPI
      try {
        const response = await fetch('http://127.0.0.1:8317/v1/models');
        if (response.ok) {
          const data = await response.json();
          const modelCount = data?.data?.length || 0;
          if (modelCount > 0) {
            steps[0].status = 'done';
            steps[0].details = `${modelCount} models available`;
          } else {
            steps[0].details = 'No models found';
          }
        }
      } catch (e) {
        steps[0].details = 'Not running';
      }

      // Step 1: Gateway
      try {
        const ocToken = process.env.OC_TOKEN;
        const ocGateway = process.env.OC_GATEWAY || 'http://localhost:18789';
        if (ocToken) {
          const response = await fetch(`${ocGateway}/api/status`, {
            headers: { 'Authorization': `Bearer ${ocToken}` }
          });
          if (response.ok) {
            steps[1].status = 'done';
            steps[1].details = 'Gateway responding';
          } else {
            steps[1].details = 'Gateway not responding';
          }
        } else {
          steps[1].details = 'OC_TOKEN not set';
        }
      } catch (e) {
        steps[1].details = 'Gateway not reachable';
      }

      // Step 2: Channels
      try {
        const configPath = path.join(process.env.HOME, '.openclaw', 'config.yaml');
        if (fs.existsSync(configPath)) {
          const config = fs.readFileSync(configPath, 'utf8');
          if (config.includes('channels:') || config.includes('telegram:') || config.includes('discord:')) {
            steps[2].status = 'done';
            steps[2].details = 'Channels configured';
          } else {
            steps[2].details = 'No channels found in config';
          }
        } else {
          steps[2].details = 'Config file not found';
        }
      } catch (e) {
        steps[2].details = 'Config read error';
      }

      // Step 3: Fleet
      try {
        const sessionsPath = path.join(process.env.HOME, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
        if (fs.existsSync(sessionsPath)) {
          const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
          const nodeCount = Object.keys(sessions).filter(k => k.startsWith('node:')).length;
          if (nodeCount > 0) {
            steps[3].status = 'done';
            steps[3].details = `${nodeCount} nodes paired`;
          } else {
            steps[3].details = 'No nodes paired';
          }
        } else {
          steps[3].details = 'Sessions file not found';
        }
      } catch (e) {
        steps[3].details = 'Sessions read error';
      }

      // Step 4: Skills
      try {
        const skillsPath = path.join(process.env.HOME, '.openclaw', 'workspace', 'skills');
        if (fs.existsSync(skillsPath)) {
          const skillDirs = fs.readdirSync(skillsPath).filter(d => 
            fs.statSync(path.join(skillsPath, d)).isDirectory()
          );
          if (skillDirs.length > 0) {
            steps[4].status = 'done';
            steps[4].details = `${skillDirs.length} skills installed`;
          } else {
            steps[4].details = 'No skills found';
          }
        } else {
          steps[4].details = 'Skills directory not found';
        }
      } catch (e) {
        steps[4].details = 'Skills check error';
      }

      const completedCount = steps.filter(s => s.status === 'done').length;
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        steps, 
        completedCount, 
        totalCount: steps.length 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/setup/cliproxy — detect CLIProxyAPI status
  if (req.url === '/api/setup/cliproxy' && req.method === 'GET') {
    cors(res);
    try {
      const fs = require('fs');
      const path = require('path');
      
      let running = false;
      let models = [];
      let providers = [];
      
      try {
        const response = await fetch('http://127.0.0.1:8317/v1/models');
        if (response.ok) {
          running = true;
          const data = await response.json();
          models = (data?.data || []).map(m => ({
            id: m.id,
            provider: m.id.split('-')[0] // claude, gpt, gemini, etc.
          }));
        }
      } catch (e) {
        // CLIProxyAPI not running
      }

      // Check auth files
      const authDir = path.join(process.env.HOME, '.cli-proxy-api');
      const providerMap = { claude: 'claude', gemini: 'gemini', codex: 'codex' };
      
      Object.entries(providerMap).forEach(([name, prefix]) => {
        const modelCount = models.filter(m => m.provider === prefix).length;
        let authenticated = false;
        
        // Check for auth files (varies by provider)
        try {
          const authFiles = [
            path.join(authDir, `${name}_auth.json`),
            path.join(authDir, `${name}.json`),
            path.join(authDir, `auth_${name}.json`)
          ];
          authenticated = authFiles.some(f => fs.existsSync(f));
        } catch (e) {}
        
        providers.push({ name, authenticated, modelCount });
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        running, 
        models, 
        providers, 
        totalModels: models.length 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/setup/cliproxy/login — trigger CLIProxyAPI OAuth login
  if (req.url === '/api/setup/cliproxy/login' && req.method === 'POST') {
    cors(res);
    try {
      const body = await readBody(req);
      if (!body || !body.provider) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'provider required' }));
        return;
      }
      
      const { spawn } = require('child_process');
      const path = require('path');
      
      // Map provider to CLI flag
      const flagMap = {
        claude: '-claude-login',
        gemini: '-login',
        codex: '-codex-login'
      };
      
      const flag = flagMap[body.provider];
      if (!flag) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown provider' }));
        return;
      }
      
      const configPath = path.join(process.env.HOME, '.cli-proxy-api', 'config.yaml');
      const command = ['cliproxyapi', flag, '-config', configPath];
      
      // Start OAuth process (non-blocking)
      const child = spawn(command[0], command.slice(1), { 
        detached: true, 
        stdio: 'ignore' 
      });
      child.unref();
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        message: `OAuth flow started for ${body.provider}`,
        command: command.join(' ')
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/setup/gateway — check OpenClaw gateway status
  if (req.url === '/api/setup/gateway' && req.method === 'GET') {
    cors(res);
    try {
      const fs = require('fs');
      const path = require('path');
      
      let running = false;
      let version = '';
      let config = { defaultModel: '', channels: [] };
      
      // Check gateway status
      try {
        const ocToken = process.env.OC_TOKEN;
        const ocGateway = process.env.OC_GATEWAY || 'http://localhost:18789';
        
        if (ocToken) {
          const response = await fetch(`${ocGateway}/api/status`, {
            headers: { 'Authorization': `Bearer ${ocToken}` }
          });
          if (response.ok) {
            running = true;
            const data = await response.json();
            version = data?.version || 'unknown';
          }
        }
      } catch (e) {
        // Gateway not running
      }
      
      // Read config
      try {
        const configPath = path.join(process.env.HOME, '.openclaw', 'config.yaml');
        if (fs.existsSync(configPath)) {
          const configText = fs.readFileSync(configPath, 'utf8');
          
          // Extract default model
          const modelMatch = configText.match(/defaultModel:\s*(.+)/);
          if (modelMatch) config.defaultModel = modelMatch[1].trim();
          
          // Extract channels (simple parsing)
          const channelMatches = configText.match(/channels:\s*\n([\s\S]*?)(?=\n\w|\n$)/);
          if (channelMatches) {
            const channelText = channelMatches[1];
            const channels = [];
            if (channelText.includes('telegram:')) channels.push('telegram');
            if (channelText.includes('discord:')) channels.push('discord');
            config.channels = channels;
          }
        }
      } catch (e) {
        // Config read error
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        running, 
        version, 
        config 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // GET /api/setup/fleet — list paired nodes
  if (req.url === '/api/setup/fleet' && req.method === 'GET') {
    cors(res);
    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      
      let nodes = [];
      
      // Try openclaw command first
      try {
        const output = execSync('openclaw nodes status --json', { encoding: 'utf8' });
        const data = JSON.parse(output);
        nodes = data?.nodes || [];
      } catch (e) {
        // Fallback to reading sessions file
        try {
          const sessionsPath = path.join(process.env.HOME, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
          if (fs.existsSync(sessionsPath)) {
            const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
            nodes = Object.entries(sessions)
              .filter(([key]) => key.startsWith('node:'))
              .map(([key, data]) => ({
                id: key.replace('node:', ''),
                name: data?.name || 'Unknown',
                os: data?.os || 'Unknown',
                lastSeen: data?.lastSeen || null,
                status: data?.status || 'unknown'
              }));
          }
        } catch (e2) {
          // No nodes found
        }
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        ok: true, 
        nodes 
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/setup/test — run end-to-end test
  if (req.url === '/api/setup/test' && req.method === 'POST') {
    cors(res);
    try {
      const ocToken = process.env.OC_TOKEN;
      const ocGateway = process.env.OC_GATEWAY || 'http://localhost:18789';
      
      if (!ocToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          ok: true, 
          success: false, 
          responseTime: 0, 
          agentReply: 'OC_TOKEN not set' 
        }));
        return;
      }
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(`${ocGateway}/api/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ocToken}`
          },
          body: JSON.stringify({ message: 'ping' })
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ 
            ok: true, 
            success: true, 
            responseTime, 
            agentReply: data?.reply || 'pong'
          }));
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify({ 
            ok: true, 
            success: false, 
            responseTime, 
            agentReply: `HTTP ${response.status}`
          }));
        }
      } catch (e) {
        const responseTime = Date.now() - startTime;
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ 
          ok: true, 
          success: false, 
          responseTime, 
          agentReply: e.message
        }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ─── AI Provider Setup API ────────────────────────────────
  
  // GET /api/wizard/providers — list available provider presets
  if (req.url === '/api/wizard/providers' && req.method === 'GET') {
    const providers = [
      {
        id: 'recommended', name: '✨ Recommended', icon: '✨',
        description: 'Best AI model, automatically configured — just works',
        authType: 'auto', badge: 'Best for most users',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Smart & Fast', recommended: true }
        ],
        config: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic' },
        autoConfig: true
      },
      {
        id: 'anthropic', name: 'Anthropic', icon: '🟣', description: 'Claude models (Opus, Sonnet, Haiku)',
        authType: 'api_key', keyPlaceholder: 'sk-ant-...',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        advanced: true,
        models: [
          { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', recommended: true },
          { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
          { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5' }
        ],
        config: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic' }
      },
      {
        id: 'openai', name: 'OpenAI', icon: '🟢', description: 'GPT models (GPT-5, GPT-4o)',
        authType: 'api_key', keyPlaceholder: 'sk-...', advanced: true,
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
        authType: 'oauth', oauthUrl: '/api/wizard/providers/cliproxy/auth', advanced: true,
        models: [
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Max)', recommended: true },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Max)' },
          { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Max)' }
        ],
        config: { baseUrl: 'http://127.0.0.1:8317/v1', api: 'openai-completions' }
      },
      {
        id: 'ollama', name: 'Ollama (Local)', icon: '🦙', description: 'Run models locally — free, private, no API key needed',
        authType: 'none', advanced: true,
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
        recommended: {
          config: { api: 'anthropic' },
          baseUrl: 'https://api.anthropic.com/v1',
          authProfile: 'anthropic:default'
        },
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
          const order = parseInt((yaml.match(/^order:\s*(\d+)$/m) || [])[1]) || 99;
          const badge = (yaml.match(/^badge:\s*"?(.+?)"?\s*$/m) || [])[1] || '';
          const featuresRaw = yaml.match(/features:\n((?:\s+-\s+.+\n?)+)/);
          const features = featuresRaw ? featuresRaw[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^\s*-\s*/, '').trim()) : [];
          return { id: d, name: name.trim(), description: desc.trim(), icon: icon.trim(), version, features, order, badge: badge.trim() };
        } catch(e) { return { id: d, name: d, description: '', icon: '📦', version: '1.0.0', features: [] }; }
      });
      blueprints.sort((a, b) => (a.order || 99) - (b.order || 99));
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
const { verifyChannel } = require('./channel-verifier');
const { generateSOUL, generateIDENTITY, generateAGENTS } = require('./agent-templates');
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

  // ─── POST /api/oc/skills/create — Install a skill into workspace ────
  if (req.url === '/api/oc/skills/create' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.name || !body.skillMd) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: false, error: 'Missing name or skillMd' }));
        return;
      }
      // Sanitize name: lowercase, hyphens only, no path traversal
      const name = String(body.name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
      if (!name || name.length < 2 || name.length > 64) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: false, error: 'Invalid skill name (2-64 chars, lowercase + hyphens)' }));
        return;
      }
      const skillDir = require('path').join(WORKSPACE, 'skills', name);
      const fs = require('fs');
      // Create directories
      fs.mkdirSync(skillDir, { recursive: true });
      // Write SKILL.md
      fs.writeFileSync(require('path').join(skillDir, 'SKILL.md'), body.skillMd, 'utf8');
      // Write optional resource files
      if (body.resources) {
        const cats = ['scripts', 'references', 'assets'];
        for (const cat of cats) {
          if (body.resources[cat] && Array.isArray(body.resources[cat])) {
            const catDir = require('path').join(skillDir, cat);
            fs.mkdirSync(catDir, { recursive: true });
            for (const file of body.resources[cat]) {
              if (file.name && typeof file.content === 'string') {
                const safeName = String(file.name).replace(/[\/\\:]/g, '_');
                fs.writeFileSync(require('path').join(catDir, safeName), file.content, 'utf8');
              }
            }
          }
        }
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, name, path: skillDir }));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/oc/') && !req.url.startsWith('/api/oc/missions')) {
    res.setHeader('Content-Type', 'application/json');
    const route = req.url.replace(/\?.*/, '');
    // Auth check: all /api/oc/ routes except health require a valid token
    // Same-origin requests (from the dashboard UI served by this server) bypass auth
    const publicRoutes = ['/api/oc/health'];
    if (!publicRoutes.includes(route)) {
      const authHeader = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const origin = req.headers.origin || '';
      const referer = req.headers.referer || '';
      const selfHosts = ['app.spawnkit.ai', 'localhost:' + PORT, '127.0.0.1:' + PORT];
      const isSameOrigin = selfHosts.some(h => origin.includes(h) || referer.includes(h));
      if (OC_TOKEN && authHeader !== OC_TOKEN && !isSameOrigin) {
        res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return;
      }
    }
    
    // Handle POST requests for task creation
    if (req.method === 'POST' && route === '/api/oc/tasks') {
      try {
        const body = await readBody(req);
        const taskData = JSON.parse(body);
        
        if (!taskData.title) {
          res.writeHead(400);
          res.end(JSON.stringify({error: 'Task title is required'}));
          return;
        }
        
        // Append new task to TODO.md
        const todoFile = require('path').join(WORKSPACE, 'TODO.md');
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const priority = taskData.priority ? ` (${taskData.priority})` : '';
        const newTask = `- [ ] **${taskData.title}**${priority} — Added ${timestamp}`;
        
        try {
          // Read current content
          let content = '';
          try {
            content = require('fs').readFileSync(todoFile, 'utf8');
          } catch(e) {
            // File doesn't exist, start with basic structure
            content = '# TODO.md - What I\'m Working On\n\n';
          }
          
          // Append new task at the end
          if (!content.endsWith('\n')) content += '\n';
          content += newTask + '\n';
          
          // Write back to file
          require('fs').writeFileSync(todoFile, content, 'utf8');
          
          res.writeHead(201);
          res.end(JSON.stringify({
            ok: true,
            task: {
              title: taskData.title,
              status: 'pending',
              priority: taskData.priority || null,
              created: timestamp
            }
          }));
          return;
        } catch(e) {
          res.writeHead(500);
          res.end(JSON.stringify({error: 'Failed to write task: ' + e.message}));
          return;
        }
      } catch(e) {
        res.writeHead(400);
        res.end(JSON.stringify({error: 'Invalid JSON: ' + e.message}));
        return;
      }
    }
    
    let data;
    switch(route) {
      case '/api/oc/sessions': data = getSessions(); break;
      case '/api/oc/memory': data = getMemory(); break;
      case '/api/oc/config': data = getConfig(); break;
      case '/api/oc/crons': data = getCrons(); break;
      case '/api/oc/chat': data = getChat(); break;
      case '/api/oc/chat/history': data = getChat(); break;
      case '/api/oc/agents': data = getAgents(); break;
      case '/api/oc/tasks': data = getTasks(); break;
      case '/api/oc/skills': data = getSkills(); break;
      case '/api/oc/health': data = { ok: true, uptime: process.uptime() }; break;
      default: res.writeHead(404); res.end(JSON.stringify({error:'not found'})); return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  // POST /api/spawn-subagent — Spawn sub-agent for arena battles
  if (req.url === '/api/spawn-subagent' && req.method === 'POST') {
    if (cors(req, res)) return;
    if (!token) { res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return; }
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const result = await proxyRequest('POST', gatewayUrl + '/api/oc/sessions/spawn', token, data);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // POST /api/subagent-status — Get sub-agent status
  if (req.url === '/api/subagent-status' && req.method === 'POST') {
    if (cors(req, res)) return;
    if (!token) { res.writeHead(401); res.end(JSON.stringify({error:'unauthorized'})); return; }
    const body = await readBody(req);
    try {
      const data = JSON.parse(body);
      const result = await proxyRequest('GET', gatewayUrl + '/api/oc/sessions/' + data.sessionKey, token);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({error: e.message}));
    }
    return;
  }

  // Static files
  let filePath = req.url.split('?')[0];

  // Root → serve office-executive as the canonical entry point
  if (filePath === '/' || filePath === '') filePath = '/office-executive/index.html';

  // /office-executive without trailing slash → redirect
  if (filePath === '/office-executive') {
    res.writeHead(301, { 'Location': '/office-executive/' });
    res.end();
    return;
  }
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
        // For asset files (.js, .css, .json, .png, etc) return proper 404 — never serve HTML as JS
        const reqExt = path.extname(filePath);
        if (reqExt && reqExt !== '.html') {
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end('Not found: ' + filePath);
          return;
        }
        // SPA fallback to office-executive/index.html (only for navigation/HTML requests)
        fs.readFile(path.join(STATIC_DIR, 'office-executive', 'index.html'), (e2, html) => {
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
