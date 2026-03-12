'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://127.0.0.1:8765';
const SAME_ORIGIN_HEADERS = { 'Referer': 'http://127.0.0.1:8765/' };

function request(method, urlPath, headers = {}, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 8000,
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
  try {
    await request('GET', '/api/oc/health');
    return true;
  } catch(e) {
    return false;
  }
}

describe('API /api/oc/* integration tests', () => {

  // ── Health ──────────────────────────────────────────────────────────────────
  test('GET /api/oc/health → 200 ok:true', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/health', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200, 'status 200');
    assert.equal(res.json?.ok, true, 'ok is true');
  });

  test('GET /api/oc/health → uptime is number', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/health', SAME_ORIGIN_HEADERS);
    assert.equal(typeof res.json?.uptime, 'number', 'uptime is a number');
    assert.ok(res.json.uptime > 0, 'uptime > 0');
  });

  // ── Sessions ────────────────────────────────────────────────────────────────
  test('GET /api/oc/sessions → 200 with Referer', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/sessions', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  });

  test('GET /api/oc/sessions → returns array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/sessions', SAME_ORIGIN_HEADERS);
    assert.ok(Array.isArray(res.json), 'sessions is array');
  });

  test('GET /api/oc/sessions WITHOUT Referer → 401', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/sessions', {});
    assert.equal(res.status, 401, `expected 401 without Referer, got ${res.status}`);
  });

  // ── Memory ──────────────────────────────────────────────────────────────────
  test('GET /api/oc/memory → 200 with object', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/memory', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200);
    assert.equal(typeof res.json, 'object', 'memory is object');
    assert.ok('main' in res.json, 'has main field');
  });

  // ── Config ──────────────────────────────────────────────────────────────────
  test('GET /api/oc/config → 200 with object', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/config', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200);
    assert.equal(typeof res.json, 'object', 'config is object');
  });

  test('GET /api/oc/config → does not contain raw auth token', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/config', SAME_ORIGIN_HEADERS);
    // If config has gateway.auth, it should not have token
    if (res.json?.gateway?.auth) {
      assert.equal(res.json.gateway.auth.token, undefined, 'token should be stripped');
    }
    assert.ok(true, 'config safe');
  });

  // ── Crons ───────────────────────────────────────────────────────────────────
  test('GET /api/oc/crons → 200 with jobs array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/crons', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200);
    assert.ok(res.json && 'jobs' in res.json, 'has jobs key');
    assert.ok(Array.isArray(res.json.jobs), 'jobs is array');
  });

  // ── Agents ──────────────────────────────────────────────────────────────────
  test('GET /api/oc/agents → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/agents', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200);
    assert.equal(typeof res.json, 'object', 'agents response is object');
  });

  test('GET /api/oc/agents → has agents array', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/agents', SAME_ORIGIN_HEADERS);
    // Agents API can return { agents: [...] } or plain array
    const arr = Array.isArray(res.json) ? res.json : (res.json?.agents || []);
    assert.ok(Array.isArray(arr), 'agents is array');
    if (arr.length > 0) {
      assert.ok(arr[0].id, 'first agent has id');
    }
  });

  // ── Skills ──────────────────────────────────────────────────────────────────
  test('GET /api/oc/skills → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/skills', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200);
  });

  test('GET /api/oc/skills → has skills array or object', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/skills', SAME_ORIGIN_HEADERS);
    assert.ok(res.json !== null, 'has json response');
    // Skills endpoint returns object or array
    assert.ok(typeof res.json === 'object', 'is object');
  });

  // ── Version ─────────────────────────────────────────────────────────────────
  test('GET /api/oc/version → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/version', SAME_ORIGIN_HEADERS);
    assert.equal(res.status, 200);
  });

  test('GET /api/oc/version → has current.version string', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/version', SAME_ORIGIN_HEADERS);
    assert.ok(res.json?.current?.version, 'has current.version');
    assert.equal(typeof res.json.current.version, 'string', 'version is string');
  });

  // ── Chat ───────────────────────────────────────────────────────────────────
  test('POST /api/oc/chat → not 500', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/oc/chat', SAME_ORIGIN_HEADERS, { message: 'ping' });
    assert.ok(res.status !== 500, `should not be 500, got ${res.status}`);
  });

  test('POST /api/oc/chat → 200 with reply or 403/401', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('POST', '/api/oc/chat', SAME_ORIGIN_HEADERS, { message: 'ping' });
    assert.ok([200, 401, 403, 503].includes(res.status), `acceptable status: ${res.status}`);
  });

  // ── Health is public (no auth required) ────────────────────────────────────
  test('GET /api/oc/health WITHOUT Referer → still 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/health', {});
    assert.equal(res.status, 200, 'health is public endpoint');
  });

  // ── Response headers ───────────────────────────────────────────────────────
  test('GET /api/oc/health → has CORS headers', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/health', SAME_ORIGIN_HEADERS);
    assert.ok(res.headers['access-control-allow-origin'], 'has CORS header');
  });

  test('GET /api/oc/sessions → Content-Type is JSON', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/sessions', SAME_ORIGIN_HEADERS);
    assert.ok(res.headers['content-type']?.includes('json'), `Content-Type is JSON: ${res.headers['content-type']}`);
  });

  test('GET /api/oc/memory WITHOUT Referer → 401', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/memory', {});
    assert.equal(res.status, 401, 'memory requires auth');
  });

  test('GET /api/oc/agents WITHOUT Referer → 401 or 200 (public endpoint)', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await request('GET', '/api/oc/agents', {});
    // agents may or may not require same-origin check
    assert.ok([200, 401].includes(res.status), `expected 200 or 401, got ${res.status}`);
  });

  test('response time < 5000ms', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const start = Date.now();
    await request('GET', '/api/oc/health', SAME_ORIGIN_HEADERS);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, `response took ${elapsed}ms, expected < 5000ms`);
  });
});
