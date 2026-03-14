'use strict';

module.exports = async function fleetRoutes(req, res, ctx) {
  const { readBody, proxyFetch, proxyRequest, OC_GATEWAY, OC_TOKEN, WORKSPACE } = ctx;

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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
  }

  if (req.url.startsWith('/api/remote/') && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.url || !body.endpoint) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'Missing url or endpoint' }));
      return true;
    }
    const gatewayUrl = body.url.replace(/\/+$/, '');
    const token = body.token || '';
    const result = await proxyFetch(gatewayUrl + body.endpoint, token);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(result.ok ? 200 : 502);
    res.end(JSON.stringify(result.ok ? result.data : { error: result.error || 'Remote fetch failed' }));
    return true;
  }



  return false; // no route matched
};
