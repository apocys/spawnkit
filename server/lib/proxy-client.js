'use strict';
/**
 * proxy-client.js — HTTP proxy helpers and CORS utilities
 * Extracted from server.js for testability and modularity.
 */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve(null); } });
  });
}

async function proxyRequest(method, url, token, bodyObj) {
  // Mock fleet relay if MOCK_FLEET env var is set
  if (process.env.MOCK_FLEET === '1' && url.includes('18790')) {
    return { ok: true, status: 200, data: getMockFleetData(url) };
  }

  const lib = url.startsWith('https') ? require('https') : require('http');
  const parsed = new (require('url').URL)(url);
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
  return new Promise((resolve) => {
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port,
      path: parsed.pathname + parsed.search, method,
      headers, timeout: 12000,
    }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try { resolve({ ok: resp.statusCode < 400, status: resp.statusCode, data: JSON.parse(data), raw: data }); }
        catch(e) { resolve({ ok: false, status: resp.statusCode, data: null, raw: data }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function getMockFleetData(url) {
  if (url.includes('/api/fleet/peers')) return { peers: ['apocyz_runner', 'dev-mac'] };
  if (url.includes('/api/fleet/stats')) return { activePeers: 2, totalMessages: 42, uptime: 1337 };
  if (url.includes('/api/fleet/mailbox')) return { messages: [], total: 0 };
  if (url.includes('/api/remote/offices')) return { offices: [], recentMessages: [] };
  return { mock: true };
}

async function proxyFetch(url, token) {
  // Mock fleet relay if MOCK_FLEET env var is set
  if (process.env.MOCK_FLEET === '1' && url.includes('18790')) {
    return { ok: true, status: 200, data: getMockFleetData(url) };
  }

  const lib = url.startsWith('https') ? require('https') : require('http');
  return new Promise((resolve) => {
    const req = lib.get(url, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      timeout: 8000,
    }, (resp) => {
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

module.exports = { cors, readBody, proxyRequest, proxyFetch };
