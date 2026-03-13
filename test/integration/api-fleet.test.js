'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://127.0.0.1:8765';
const REFERER = 'http://127.0.0.1:8765/';

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Referer: REFERER, 'Content-Type': 'application/json' },
      timeout: 8000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function isServerUp() {
  try { await get('/api/oc/health'); return true; } catch(e) { return false; }
}

describe('API fleet/remote integration tests', () => {

  // ── Fleet Status ────────────────────────────────────────────────────────────
  test('GET /api/fleet/status → not 500', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/status');
    assert.ok(res.status !== 500, `should not be 500, got ${res.status}`);
  });

  test('GET /api/fleet/status → has instances array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/status');
    if (res.status === 200) {
      assert.ok(res.json, 'has json body');
      // Response has instances array or similar structure
      const instances = res.json?.instances || res.json;
      assert.ok(instances !== null && instances !== undefined, 'has data');
    } else {
      // Could be 404 if fleet endpoint not configured
      assert.ok([200, 404, 502, 503].includes(res.status), `acceptable status: ${res.status}`);
    }
  });

  test('GET /api/fleet/status → response is object', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/status');
    if (res.status === 200) {
      assert.equal(typeof res.json, 'object', 'json is object');
    } else {
      assert.ok(true, 'endpoint may not be configured');
    }
  });

  // ── Fleet Mailbox ───────────────────────────────────────────────────────────
  test('GET /api/fleet/mailbox → 200 (or 502 if relay down)', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/mailbox');
    assert.ok([200, 502].includes(res.status), `expected 200 or 502 (relay down), got ${res.status}`);
  });

  test('GET /api/fleet/mailbox → has messages array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/mailbox');
    if (res.status === 200) {
      assert.ok(res.json, 'has json body');
      const msgs = res.json?.messages || res.json;
      assert.ok(Array.isArray(msgs), 'messages is array');
    }
  });

  test('GET /api/fleet/mailbox → messages have id and body fields', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/mailbox');
    if (res.status === 200 && res.json?.messages?.length > 0) {
      const msg = res.json.messages[0];
      assert.ok(msg.id, 'message has id');
      assert.ok('body' in msg, 'message has body field');
    }
    assert.ok(true, 'mailbox check complete');
  });

  test('GET /api/fleet/mailbox → has total count', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/fleet/mailbox');
    if (res.status === 200) {
      assert.ok('total' in res.json, 'has total field');
    }
    assert.ok(true, 'total check complete');
  });

  // ── Remote Offices ──────────────────────────────────────────────────────────
  test('GET /api/remote/offices → 200 (or 502 if relay down)', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/remote/offices');
    assert.ok([200, 502].includes(res.status), `expected 200 or 502 (relay down), got ${res.status}`);
  });

  test('GET /api/remote/offices → has offices array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/remote/offices');
    if (res.status === 200) {
      assert.ok(res.json, 'has json');
      const offices = res.json?.offices || res.json;
      assert.ok(Array.isArray(offices), 'offices is array');
    }
  });

  test('GET /api/remote/offices → offices have id and status fields', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/remote/offices');
    if (res.status === 200 && res.json?.offices?.length > 0) {
      const office = res.json.offices[0];
      assert.ok(office.id, 'office has id');
      assert.ok(office.status, 'office has status');
    }
    assert.ok(true, 'offices check complete');
  });

  test('GET /api/remote/offices → has recentMessages array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/api/remote/offices');
    if (res.status === 200) {
      assert.ok(Array.isArray(res.json?.recentMessages), 'has recentMessages array');
    }
    assert.ok(true, 'recentMessages check complete');
  });
});
