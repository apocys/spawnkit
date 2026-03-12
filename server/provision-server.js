/**
 * provision-server.js — SpawnKit Deploy Provisioning Backend
 * Runs on port 3456. Proxied by server.js at /api/deploy/*.
 *
 * Routes:
 *   POST /api/deploy/provision        — Provision a new agent instance
 *   GET  /api/deploy/status/:id       — Get instance status
 *   POST /api/deploy/stop/:id         — Stop an instance
 *   GET  /api/deploy/list             — List all active instances
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.PROVISION_PORT || '3456', 10);
const AUTH_TOKEN = process.env.PROVISION_TOKEN || 'sk-provision-dev';

// In-memory instance store
const instances = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomBytes(8).toString('hex').replace(/(.{4})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(json);
}

function checkAuth(req) {
  const header = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return header === AUTH_TOKEN;
}

function parsePath(url) {
  return url.split('?')[0].replace(/\/$/, '');
}

// ── Request handler ───────────────────────────────────────────────────────────

async function handler(req, res) {
  const method = req.method.toUpperCase();
  const path = parsePath(req.url);

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  // Auth check
  if (!checkAuth(req)) {
    return send(res, 401, { ok: false, error: 'Unauthorized' });
  }

  try {
    // POST /api/deploy/provision
    if (method === 'POST' && path === '/api/deploy/provision') {
      const body = await parseBody(req);
      const { agentId, config, token } = body;

      if (!agentId) return send(res, 400, { ok: false, error: 'agentId is required' });

      const instanceId = 'inst-' + uuid();
      const startedAt = new Date().toISOString();
      const wsUrl = `ws://localhost:${PORT}/ws/${instanceId}`;
      const instanceToken = 'sk-inst-' + crypto.randomBytes(12).toString('hex');

      instances.set(instanceId, {
        instanceId,
        agentId,
        config: config || {},
        status: 'running',
        startedAt,
        token: instanceToken,
        wsUrl
      });

      console.log(`[provision] New instance: ${instanceId} for agent ${agentId}`);
      return send(res, 200, { ok: true, instanceId, wsUrl, token: instanceToken, startedAt });
    }

    // GET /api/deploy/status/:instanceId
    const statusMatch = path.match(/^\/api\/deploy\/status\/(.+)$/);
    if (method === 'GET' && statusMatch) {
      const instanceId = statusMatch[1];
      const inst = instances.get(instanceId);
      if (!inst) return send(res, 404, { ok: false, error: 'Instance not found' });

      const uptime = Math.floor((Date.now() - new Date(inst.startedAt).getTime()) / 1000);
      return send(res, 200, {
        instanceId: inst.instanceId,
        agentId: inst.agentId,
        status: inst.status,
        startedAt: inst.startedAt,
        uptime,
        wsUrl: inst.wsUrl
      });
    }

    // POST /api/deploy/stop/:instanceId
    const stopMatch = path.match(/^\/api\/deploy\/stop\/(.+)$/);
    if (method === 'POST' && stopMatch) {
      const instanceId = stopMatch[1];
      if (!instances.has(instanceId)) return send(res, 404, { ok: false, error: 'Instance not found' });

      instances.delete(instanceId);
      console.log(`[provision] Stopped instance: ${instanceId}`);
      return send(res, 200, { ok: true, instanceId, stopped: true });
    }

    // GET /api/deploy/list
    if (method === 'GET' && path === '/api/deploy/list') {
      const list = Array.from(instances.values()).map(inst => ({
        instanceId: inst.instanceId,
        agentId: inst.agentId,
        status: inst.status,
        startedAt: inst.startedAt,
        uptime: Math.floor((Date.now() - new Date(inst.startedAt).getTime()) / 1000)
      }));
      return send(res, 200, { ok: true, instances: list, total: list.length });
    }

    // 404
    return send(res, 404, { ok: false, error: 'Not found', path });

  } catch (err) {
    console.error('[provision] Error:', err.message);
    return send(res, 500, { ok: false, error: err.message });
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

const server = http.createServer(handler);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[provision] SpawnKit Provision Server running on http://127.0.0.1:${PORT}`);
  console.log(`[provision] Auth token: ${AUTH_TOKEN}`);
});

server.on('error', err => {
  console.error('[provision] Server error:', err.message);
  process.exit(1);
});
