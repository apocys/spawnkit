const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BASE = 'http://127.0.0.1:8765';
// Same-origin header so /api/oc/* auth bypass triggers (server checks referer)
const SAME_ORIGIN_HEADERS = { 'Referer': `${BASE}/`, 'Origin': BASE };

describe('API Integration — /api/oc/*', () => {

  it('GET /api/oc/health → { ok: true }', async () => {
    const res = await fetch(`${BASE}/api/oc/health`);
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  it('GET /api/oc/sessions → array', async () => {
    const res = await fetch(`${BASE}/api/oc/sessions`, { headers: SAME_ORIGIN_HEADERS });
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    assert.ok(Array.isArray(body), 'expected array (may be empty on cold start)');
  });

  it('POST /api/oc/chat → { reply: string }', async () => {
    const res = await fetch(`${BASE}/api/oc/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ping' })
    });
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    assert.equal(typeof body.reply, 'string', 'reply should be a string');
  });

  it('GET /api/oc/crons → array', async () => {
    const res = await fetch(`${BASE}/api/oc/crons`, { headers: SAME_ORIGIN_HEADERS });
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    // crons endpoint returns { jobs: [] } or plain array
    const arr = body.jobs || body.crons || (Array.isArray(body) ? body : null);
    assert.ok(Array.isArray(arr), 'expected array of crons');
  });

  it('GET /api/oc/memory → object with keys', async () => {
    const res = await fetch(`${BASE}/api/oc/memory`, { headers: SAME_ORIGIN_HEADERS });
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    assert.equal(typeof body, 'object');
    assert.ok(body !== null);
    assert.ok(Object.keys(body).length > 0, 'expected at least one key');
  });

  it('GET /api/oc/agents → array', async () => {
    const res = await fetch(`${BASE}/api/oc/agents`, { headers: SAME_ORIGIN_HEADERS });
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    const arr = Array.isArray(body) ? body : (body.agents || []);
    assert.ok(Array.isArray(arr), 'expected array of agents');
  });

  it('GET /api/oc/version → object with current.version', async () => {
    const res = await fetch(`${BASE}/api/oc/version`, { headers: SAME_ORIGIN_HEADERS });
    assert.equal(res.ok, true, `status ${res.status}`);
    const body = await res.json();
    assert.equal(typeof body, 'object');
    assert.ok(body.current, 'expected current field');
    assert.equal(typeof body.current.version, 'string', 'version should be a string');
  });

});
