/**
 * API Smoke Tests — verify all critical endpoints respond correctly.
 * Run against a live server: API_URL=http://localhost:8765 node --test test/smoke/api-endpoints.test.js
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');

const API_URL = process.env.API_URL || 'http://127.0.0.1:8765';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

async function api(method, path, body) {
  const headers = {
    'Content-Type': 'application/json',
    'Referer': API_URL + '/',
  };
  if (AUTH_TOKEN) headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_URL + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, data };
}

describe('API Smoke Tests', () => {
  // ── Health ──
  test('GET /api/oc/health → 200 + ok:true', async () => {
    const { status, data } = await api('GET', '/api/oc/health');
    assert.strictEqual(status, 200);
    assert.strictEqual(data.ok, true);
  });

  // ── Sessions ──
  test('GET /api/oc/sessions → 200 + array', async () => {
    const { status, data } = await api('GET', '/api/oc/sessions');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data) || Array.isArray(data.sessions), 'Expected sessions array');
  });

  // ── Agents ──
  test('GET /api/oc/agents → 200', async () => {
    const { status, data } = await api('GET', '/api/oc/agents');
    assert.strictEqual(status, 200);
    assert.ok(data, 'Expected agents data');
  });

  // ── Skills ──
  test('GET /api/oc/skills → 200 + skills array', async () => {
    const { status, data } = await api('GET', '/api/oc/skills');
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data.skills), 'Expected skills array');
  });

  // ── Crons ──
  test('GET /api/oc/crons → 200', async () => {
    const { status, data } = await api('GET', '/api/oc/crons');
    assert.strictEqual(status, 200);
    assert.ok(data, 'Expected crons data');
  });

  // ── Memory ──
  test('GET /api/oc/memory → 200', async () => {
    const { status, data } = await api('GET', '/api/oc/memory');
    assert.strictEqual(status, 200);
    assert.ok(data, 'Expected memory data');
  });

  // ── MCP CRUD ──
  describe('MCP Server Management', () => {
    const testServerName = '__smoke_test_mcp_' + Date.now();

    test('GET /api/oc/mcp → 200 + servers object', async () => {
      const { status, data } = await api('GET', '/api/oc/mcp');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(typeof data.servers === 'object', 'Expected servers object');
    });

    test('POST /api/oc/mcp → creates MCP server', async () => {
      const { status, data } = await api('POST', '/api/oc/mcp', {
        name: testServerName,
        transport: 'stdio',
        command: 'echo test',
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.server, testServerName);
    });

    test('DELETE /api/oc/mcp/:name → removes MCP server', async () => {
      const { status, data } = await api('DELETE', '/api/oc/mcp/' + testServerName);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.removed, testServerName);
    });
  });

  // ── Agent Config ──
  describe('Agent Configuration', () => {
    test('GET /api/oc/agents/config → 200', async () => {
      const { status, data } = await api('GET', '/api/oc/agents/config');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
    });

    test('POST /api/oc/agents/config → saves agent config', async () => {
      const { status, data } = await api('POST', '/api/oc/agents/config', {
        agentId: '__smoke_test_agent',
        model: 'claude-sonnet-4',
        traits: 'test-trait',
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.agentId, '__smoke_test_agent');
    });

    test('GET /api/oc/agents/config?agentId= → scoped response', async () => {
      const { status, data } = await api('GET', '/api/oc/agents/config?agentId=__smoke_test_agent');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.agents['__smoke_test_agent'], 'Expected scoped agent config');
      assert.strictEqual(data.global, undefined, 'Should not expose global config when scoped');
    });
  });

  // ── Brainstorm ──
  test('POST /api/brainstorm with missing question → 400', async () => {
    const { status, data } = await api('POST', '/api/brainstorm', {});
    assert.strictEqual(status, 400);
  });

  // ── Chat ──
  test('POST /api/oc/chat with missing message → 400', async () => {
    const { status, data } = await api('POST', '/api/oc/chat', {});
    assert.strictEqual(status, 400);
  });

  // ── Missions ──
  test('GET /api/oc/missions → 200', async () => {
    const { status, data } = await api('GET', '/api/oc/missions');
    assert.strictEqual(status, 200);
  });

  // ── Static files ──
  test('GET /office-executive/ → 200 HTML', async () => {
    const res = await fetch(API_URL + '/office-executive/');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<!DOCTYPE html') || html.includes('<html'), 'Expected HTML response');
  });
});
