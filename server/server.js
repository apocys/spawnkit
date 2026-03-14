#!/usr/bin/env node
/**
 * Executive Office Production Server
 * Serves static files + API bridge on a single port
 * MODULARIZED VERSION - routes extracted to routes/ modules
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.PORT || '8765');
const WORKSPACE = process.env.WORKSPACE || process.env.HOME + '/.openclaw/workspace';
const SESSIONS_FILE = process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json';
const MISSIONS_FILE = path.join(WORKSPACE, '.spawnkit-missions.json');
const STATIC_DIR = __dirname;
const MissionOrchestrator = require('./mission-orchestrator');
const registerDashboardRoutes = require('./dashboard-api').registerDashboardRoutes || require('./dashboard-api');
const { getAgents, getSessions, getMemory, getChat, getConfig, getCrons, getTasks, getSkills, getLocalVersion, getLatestVersion } = require('./lib/oc-reader');
const { proxyRequest, proxyFetch, cors, readBody } = require('./lib/proxy-client');

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

// ── MIME Types ──────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

// ── Import Route Modules ────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const fleetRoutes = require('./routes/fleet');
const agentRoutes = require('./routes/agents');
const missionRoutes = require('./routes/missions');
const chatRoutes = require('./routes/chat');
const deployRoutes = require('./routes/deploy');
const ocDataRoutes = require('./routes/oc-data');

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Context object shared with all route modules
  const ctx = {
    OC_GATEWAY,
    OC_TOKEN,
    WORKSPACE,
    missionOrch,
    MISSIONS_FILE,
    SESSIONS_FILE,
    PORT,
    readBody,
    proxyFetch,
    proxyRequest,
    getAgents,
    getSessions,
    getMemory,
    getChat,
    getConfig,
    getCrons,
    getTasks,
    getSkills,
    getLocalVersion,
    getLatestVersion,
  };

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

  // ─── Route to Modular Handlers ─────────────────────────────
  try {
    if (req.url.startsWith('/api/auth')) {
      const handled = await authRoutes(req, res, ctx);
      if (handled !== false) return;
    }

    if (req.url.startsWith('/api/fleet')) {
      const handled = await fleetRoutes(req, res, ctx);
      if (handled !== false) return;
    }

    if (req.url.startsWith('/api/oc/missions')) {
      const handled = await missionRoutes(req, res, ctx);
      if (handled !== false) return;
    }

    if (req.url.startsWith('/api/oc/agents') || req.url.startsWith('/api/oc/mcp')) {
      const handled = await agentRoutes(req, res, ctx);
      if (handled !== false) return;
    }

    if (req.url.startsWith('/api/oc/chat')) {
      const handled = await chatRoutes(req, res, ctx);
      if (handled !== false) return;
    }

    if (req.url.startsWith('/api/deploy')) {
      const handled = await deployRoutes(req, res, ctx);
      if (handled !== false) return;
    }

    if (req.url.startsWith('/api/oc/')) {
      const handled = await ocDataRoutes(req, res, ctx);
      if (handled !== false) return;
    }
  } catch (error) {
    console.error('[server] Route handler error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return;
  }

  // ─── Version & Update endpoints ───────────────────────────────
  if (req.url === '/api/oc/version' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    const versionInfo = getLatestVersion();
    res.writeHead(200);
    res.end(JSON.stringify(versionInfo));
    return;
  }

  // ─── Static Files ─────────────────────────────────────────
  let filePath = req.url.split('?')[0];

  // Root → serve office-executive as the canonical entry point
  if (filePath === '/' || filePath === '') filePath = '/office-executive/index.html';

  // /office-executive without trailing slash → redirect
  if (filePath === '/office-executive') {
    res.writeHead(301, { 'Location': '/office-executive/' });
    res.end();
    return;
  }
  // Directory URLs: append index.html
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
        // For asset files (.js, .css, .json, .png, etc) return proper 404
        const reqExt = path.extname(filePath);
        if (reqExt && reqExt !== '.html') {
          res.writeHead(404, {'Content-Type': 'text/plain'});
          res.end('Not found: ' + filePath);
          return;
        }
        // SPA fallback to office-executive/index.html
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
});