/**
 * dashboard-api.js — Real-time dashboard API routes
 * Plugs into server.js via: require('./dashboard-api')(req, res, deps)
 *
 * Routes:
 *   GET /api/dashboard/snapshot  — agents + missions + metrics in one call
 *   GET /api/dashboard/agents    — agent list with live status
 *   GET /api/dashboard/missions  — missions with progress
 *   GET /api/dashboard/metrics   — system metrics (cpu/mem/uptime/etc)
 */

'use strict';

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const http = require('http');

// ── CPU sampling ──────────────────────────────────────────────────────────────

let _cpuSample = { idle: 0, total: 0, pct: 0 };

function _sampleCPU() {
  const cpus = os.cpus();
  let idleT = 0, totalT = 0;
  for (const c of cpus) {
    for (const type of Object.keys(c.times)) {
      totalT += c.times[type];
      if (type === 'idle') idleT += c.times[type];
    }
  }
  const idleDiff  = idleT  - _cpuSample.idle;
  const totalDiff = totalT - _cpuSample.total;
  _cpuSample.pct   = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 1000) / 10 : 0;
  _cpuSample.idle  = idleT;
  _cpuSample.total = totalT;
}

// Initial sample + recurring
_sampleCPU();
setInterval(_sampleCPU, 3000);

// ── Helpers ───────────────────────────────────────────────────────────────────

function _json(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(data));
}

function _readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch(e) { return null; }
}

// ── Agents ────────────────────────────────────────────────────────────────────

function _buildAgents(deps) {
  // deps.sessionsFile, deps.ocGateway, deps.ocToken
  let sessions = [];

  // Try sessions.json
  if (deps.sessionsFile && fs.existsSync(deps.sessionsFile)) {
    const raw = _readJSON(deps.sessionsFile);
    if (raw) {
      const sessObj = raw.sessions || raw;
      if (typeof sessObj === 'object' && !Array.isArray(sessObj)) {
        sessions = Object.entries(sessObj).map(([key, s]) => {
          const channel = s.lastChannel || s.channel
            || (s.deliveryContext && s.deliveryContext.channel)
            || 'default';
          const displayName = s.displayName || s.label
            || (s.origin && s.origin.label) || key;
          const lastActive = s.lastActive || s.updatedAt || s.lastSeen || 0;
          return {
            key,
            kind:        s.kind || 'main',
            label:       displayName,
            displayName: displayName,
            status:      s.action === 'running' ? 'active' : (s.status || 'idle'),
            model:       s.model || 'unknown',
            totalTokens: (s.inputTokens || 0) + (s.outputTokens || 0) || s.totalTokens || 0,
            lastActive,
            channel,
            task:        s.task || null,
          };
        });
      }
    }
  }

  // Supplement with fleet relay agents if available
  // (will merge in snapshot builder)

  return sessions;
}

// ── Missions ──────────────────────────────────────────────────────────────────

function _buildMissions(deps) {
  const file = deps.missionsFile;
  if (!file || !fs.existsSync(file)) return [];
  const raw = _readJSON(file);
  if (!raw) return [];
  return Array.isArray(raw) ? raw : (raw.missions || []);
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function _buildMetrics(deps) {
  const totalMem  = os.totalmem();
  const freeMem   = os.freemem();
  const usedMem   = totalMem - freeMem;
  const memPct    = Math.round((usedMem / totalMem) * 1000) / 10;
  const uptimeSec = Math.floor(os.uptime());
  const loadAvg   = os.loadavg();

  // Disk usage via /proc/mounts or statfs — read /proc/mounts best-effort
  let diskUsedPct = 0;
  try {
    const dfLine = require('child_process').execSync("df / | tail -1 2>/dev/null", { encoding: 'utf8', timeout: 2000 });
    const match  = dfLine.match(/(\d+)%/);
    if (match) diskUsedPct = parseInt(match[1], 10);
  } catch(e) {}

  // Services status
  const SERVICES = [
    { id: 'openclaw-gateway',  name: 'OpenClaw',     port: 18789 },
    { id: 'fleet-relay',       name: 'Fleet Relay',  port: 18790 },
    { id: 'spawnkit-server',   name: 'SpawnKit App', port: deps.serverPort || 8765 },
    { id: 'remember-api',      name: 'Remember API', port: 3457 },
    { id: 'cliproxyapi',       name: 'CLIProxy',     port: 8317 },
  ];
  const services = SERVICES.map(s => ({
    ...s,
    running: _isPortOpen(s.port),
  }));

  // Count active sessions
  let activeSessions = 0;
  if (deps.sessionsFile && fs.existsSync(deps.sessionsFile)) {
    try {
      const raw  = _readJSON(deps.sessionsFile);
      const sess = raw ? (raw.sessions || raw) : {};
      if (typeof sess === 'object') {
        activeSessions = Object.values(sess).filter(s =>
          s.action === 'running' || s.status === 'active'
        ).length;
      }
    } catch(e) {}
  }

  // Fleet peers
  let fleetPeers = 0;
  try {
    const frRaw = _readJSON(path.join(process.env.HOME || '', 'fleet-relay', 'peers.json'));
    if (frRaw && frRaw.peers) fleetPeers = Object.keys(frRaw.peers).length;
  } catch(e) {}

  return {
    cpu:            _cpuSample.pct,
    memory:         memPct,
    memoryUsedMb:   Math.round(usedMem  / 1024 / 1024),
    memoryTotalMb:  Math.round(totalMem / 1024 / 1024),
    uptimeSeconds:  uptimeSec,
    activeSessions,
    fleetPeers,
    loadAvg,
    diskUsedPct,
    services,
    timestamp:      Date.now(),
  };
}

// ── Port probe (sync, best-effort) ───────────────────────────────────────────

function _isPortOpen(port) {
  try {
    // Check via /proc/net/tcp or /proc/net/tcp6
    const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
    const tcp  = fs.readFileSync('/proc/net/tcp',  'utf8');
    const tcp6 = fs.existsSync('/proc/net/tcp6') ? fs.readFileSync('/proc/net/tcp6', 'utf8') : '';
    return (tcp + tcp6).includes(':' + hexPort + ' ');
  } catch(e) {
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 * @param {object} deps — { sessionsFile, missionsFile, serverPort, ocGateway, ocToken }
 * @returns {boolean} true if handled, false if not our route
 */
function handleDashboardRequest(req, res, rawDeps) {
  if (!req.url.startsWith('/api/dashboard/')) return false;

  // Normalize deps — server.js passes { ocGateway, ocToken, workspace, missionsFile }
  const deps = {
    sessionsFile: rawDeps.sessionsFile
      || (process.env.HOME + '/.openclaw/agents/main/sessions/sessions.json'),
    missionsFile: rawDeps.missionsFile
      || path.join(rawDeps.workspace || '', '.spawnkit-missions.json'),
    serverPort:   rawDeps.serverPort || parseInt(process.env.PORT || '8765'),
    ocGateway:    rawDeps.ocGateway  || rawDeps.gatewayUrl || '',
    ocToken:      rawDeps.ocToken    || rawDeps.gatewayToken || '',
  };

  const route = req.url.split('?')[0];

  if (route === '/api/dashboard/metrics') {
    _json(res, _buildMetrics(deps));
    return true;
  }

  if (route === '/api/dashboard/agents') {
    _json(res, { agents: _buildAgents(deps) });
    return true;
  }

  if (route === '/api/dashboard/missions') {
    _json(res, { missions: _buildMissions(deps) });
    return true;
  }

  if (route === '/api/dashboard/snapshot') {
    _json(res, {
      agents:   _buildAgents(deps),
      missions: _buildMissions(deps),
      metrics:  _buildMetrics(deps),
      ts:       Date.now(),
    });
    return true;
  }

  return false; // route not handled
}

module.exports = handleDashboardRequest;
module.exports.registerDashboardRoutes = handleDashboardRequest;
