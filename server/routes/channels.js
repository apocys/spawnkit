'use strict';
const fs = require('fs');
const path = require('path');
const { verifyChannel } = require('../channel-verifier');

module.exports = async function channelsRoutes(req, res, ctx) {
  const { readBody, WORKSPACE, getConfig } = ctx;

  // ─── Channel Storage Functions ──────────────────────────────
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
      return true;
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
    return true;
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
    return true;
  }

  // POST /api/oc/channels/save — Persist channel config
  if (req.url === '/api/oc/channels/save' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.channel) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: 'Missing channel' }));
      return true;
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
    return true;
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
    return true;
  }

  // ─── Local API routes ────────────────────────────────────


  return false; // no route matched
};
