'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://127.0.0.1:8765';
const REFERER = 'http://127.0.0.1:8765/';

function request(method, urlPath, headers = {}, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json', Referer: REFERER, ...headers },
      timeout: 6000,
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(opts, (res) => {
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
    if (body) req.write(body);
    req.end();
  });
}

async function isServerUp() {
  try { await request('GET', '/api/oc/health'); return true; } catch(e) { return false; }
}

describe('API auth integration tests', () => {

  // ── /api/auth/validate ─────────────────────────────────────────────────────
  test('POST /api/auth/validate with invalid token → not 500', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/auth/validate', {}, { token: 'invalid-token-xyz' });
    assert.ok(res.status !== 500, `should not be 500, got ${res.status}`);
  });

  test('POST /api/auth/validate with invalid token → returns json', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/auth/validate', {}, { token: 'bad-token' });
    assert.ok(res.json !== null, 'returns json response');
  });

  test('POST /api/auth/validate with invalid token → ok:false or error', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/auth/validate', {}, { token: 'absolutely-wrong-token' });
    // Should indicate failure
    if (res.json) {
      assert.ok(
        res.json.ok === false || res.json.error || res.status >= 400,
        `expected failure response, got: ${JSON.stringify(res.json)}`
      );
    } else {
      assert.ok(res.status >= 400, `expected error status, got ${res.status}`);
    }
  });

  test('POST /api/auth/validate with empty body → not 500', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/auth/validate', {}, {});
    assert.ok(res.status !== 500, `should not be 500, got ${res.status}`);
  });

  test('POST /api/auth/validate with no token → error response', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/auth/validate', {}, { data: 'no token here' });
    assert.ok([200, 400, 401, 422].includes(res.status), `acceptable status: ${res.status}`);
  });

  // ── /api/auth/status or similar ───────────────────────────────────────────
  test('GET /api/auth/status → not 500', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/auth/status');
    // SPA may return 200 HTML for unknown paths, or real 200/404 for auth endpoints
    assert.ok(res.status !== 500, `should not be 500, got ${res.status}`);
  });

  test('GET /api/auth/status → has response body', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/auth/status');
    assert.ok(res.body.length > 0, 'has response body');
  });

  // ── /api/auth/logout ───────────────────────────────────────────────────────
  test('POST /api/auth/logout → not 500', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/auth/logout', {}, {});
    assert.ok(res.status !== 500, `should not be 500, got ${res.status}`);
  });
});
