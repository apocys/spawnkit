#!/usr/bin/env node
/**
 * Executive Office Production Server
 * Serves static files + API bridge on a single port
 * Routes extracted to routes/ modules for maintainability.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8765');
const WORKSPACE = process.env.WORKSPACE || process.env.HOME + '/.openclaw/workspace';
const SESSIONS_FILE = process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';
const MISSIONS_FILE = path.join(WORKSPACE, '.spawnkit-missions.json');
const STATIC_DIR = __dirname;
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

// ── Dependencies ────────────────────────────────────────────────────────
const MissionOrchestrator = require('./mission-orchestrator');
const registerDashboardRoutes = require('./dashboard-api').registerDashboardRoutes || require('./dashboard-api');
const { getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getTasks, getSkills, getLocalVersion, getLatestVersion } = require('./lib/oc-reader');
const { proxyRequest, proxyFetch, cors, readBody } = require('./lib/proxy-client');

const missionOrch = new MissionOrchestrator({
  workspace: WORKSPACE,
  gatewayUrl: OC_GATEWAY,
  gatewayToken: OC_TOKEN,
  sessionsFile: SESSIONS_FILE,
});
missionOrch.resumeActivePolling();

// ── Route modules ───────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const fleetRoutes = require('./routes/fleet');
const deployRoutes = require('./routes/deploy');
const channelRoutes = require('./routes/channels');
const agentRoutes = require('./routes/agents');
const chatRoutes = require('./routes/chat');
const missionRoutes = require('./routes/missions');
const setupRoutes = require('./routes/setup');
const ocDataRoutes = require('./routes/oc-data');
const subagentRoutes = require('./routes/subagent');

// ── Version Management ──────────────────────────────────────────────────
function performUpdate() {
  const log = [];
  try {
    log.push('Pulling latest from git...');
    const pullOut = execSync('git -C ' + REPO_DIR + ' pull --ff-only 2>&1', { encoding: 'utf8', timeout: 30000 });
    log.push(pullOut.trim());
    log.push('Syncing to live directory...');
    const syncCmds = [
      `rsync -a --delete "${REPO_DIR}/server/" "${STATIC_DIR}/" --exclude='auto-sync.sh' --exclude='caddy-patch.sh' --exclude='_old_root/'`,
    ];
    for (const cmd of syncCmds) {
      try { execSync(cmd, { timeout: 15000 }); } catch(e) { log.push('Warning: ' + e.message); }
    }
    const commit = execSync('git -C ' + REPO_DIR + ' rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim();
    fs.writeFileSync('/tmp/.last-deploy-commit', commit);
    log.push(`Deployed commit: ${commit.substring(0, 8)}`);
    log.push('Update complete! Server will restart...');
    setTimeout(() => { process.exit(0); }, 1500);
    return { ok: true, log };
  } catch(e) {
    log.push('ERROR: ' + e.message);
    return { ok: false, log, error: e.message };
  }
}

// ── Shared context for route modules ────────────────────────────────────
function readJSON(fp) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch(e) { return null; } }

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

const ctx = {
  OC_GATEWAY, OC_TOKEN, WORKSPACE, SESSIONS_FILE, MISSIONS_FILE, PORT,
  readBody, proxyRequest, proxyFetch, readJSON,
  missionOrch,
  getAgents, getSessions, getMemory, getChat, getConfig, getCrons,
  getTasks, getSkills, getLocalVersion, getLatestVersion,
  performUpdate, UPDATE_TOKEN,
};

// ── HTTP Server ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // Dashboard API (already modular)
    if (req.url.startsWith('/api/dashboard/')) {
      const handled = await registerDashboardRoutes(req, res, {
        ocGateway: OC_GATEWAY, ocToken: OC_TOKEN,
        workspace: WORKSPACE, missionsFile: MISSIONS_FILE,
      });
      if (handled) return;
    }

    // Version & Update (small enough to keep inline)
    if (req.url === '/api/oc/version' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(getLatestVersion()));
      return;
    }
    if (req.url === '/api/oc/update' && req.method === 'POST') {
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

    // Route to modules (order matters — more specific prefixes first)
    if (req.url.startsWith('/api/auth'))       { if (await authRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/fleet') ||
        req.url.startsWith('/api/arena') ||
        req.url.startsWith('/api/remote'))     { if (await fleetRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/deploy'))      { if (await deployRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/oc/channels')) { if (await channelRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/oc/agents') ||
        req.url.startsWith('/api/oc/mcp'))     { if (await agentRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/oc/missions')) { if (await missionRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/oc/chat') ||
        req.url.startsWith('/api/brainstorm')) { if (await chatRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/setup') ||
        req.url.startsWith('/api/wizard'))     { if (await setupRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/spawn') ||
        req.url.startsWith('/api/subagent'))   { if (await subagentRoutes(req, res, ctx) !== false) return; }
    if (req.url.startsWith('/api/oc/'))        { if (await ocDataRoutes(req, res, ctx) !== false) return; }

  } catch (error) {
    console.error('[server] Route handler error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // ── Static Files ────────────────────────────────────────────────────
  let filePath = req.url.split('?')[0];
  if (filePath === '/' || filePath === '') filePath = '/office-executive/index.html';
  if (filePath === '/office-executive') { res.writeHead(301, { 'Location': '/office-executive/' }); res.end(); return; }
  if (filePath.endsWith('/')) filePath += 'index.html';

  const fullPath = path.join(STATIC_DIR, filePath);
  if (!fullPath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const dirIndex = path.join(STATIC_DIR, filePath, 'index.html');
        if (dirIndex.startsWith(STATIC_DIR) && fs.existsSync(dirIndex)) {
          fs.readFile(dirIndex, (e3, html) => {
            if (e3) { res.writeHead(500); res.end('Error'); return; }
            res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-store, no-cache, must-revalidate'}); res.end(html);
          });
          return;
        }
        const reqExt = path.extname(filePath);
        if (reqExt && reqExt !== '.html') {
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end('Not found: ' + filePath);
          return;
        }
        fs.readFile(path.join(STATIC_DIR, 'office-executive', 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(500); res.end('Error'); return; }
          res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-store, no-cache, must-revalidate'}); res.end(html);
        });
      } else { res.writeHead(500); res.end('Error'); }
      return;
    }
    const ext = path.extname(fullPath);
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
  console.log(`   Routes: ${['auth','fleet','deploy','channels','agents','chat','missions','setup','oc-data','subagent'].join(', ')}`);
});
