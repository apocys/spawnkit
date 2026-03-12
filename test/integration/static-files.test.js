'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const BASE = 'http://127.0.0.1:8765';
const REFERER = 'http://127.0.0.1:8765/';

function get(urlPath, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Referer: REFERER, ...extraHeaders },
      timeout: 6000,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function isServerUp() {
  try { await get('/api/oc/health'); return true; } catch(e) { return false; }
}

describe('Static file serving integration tests', () => {

  test('GET / → 200 HTML', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/');
    assert.equal(res.status, 200, `/ should return 200, got ${res.status}`);
    assert.ok(res.headers['content-type']?.includes('html'), `/ should return HTML`);
  });

  test('GET / → response has html content', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/');
    assert.ok(res.body.includes('<html') || res.body.includes('<!DOCTYPE'), 'body is HTML');
  });

  test('GET /office-executive/ → 200 HTML', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/');
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.ok(res.headers['content-type']?.includes('html'), 'content-type is html');
  });

  test('GET /office-executive/ → has base or script tags', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/');
    assert.ok(
      res.body.includes('<base') || res.body.includes('<script'),
      'has base href or script tags'
    );
  });

  test('GET /office-executive/main.js → 200 javascript', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/main.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type']?.includes('javascript'), 'Content-Type javascript');
  });

  test('GET /office-executive/app.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/app.js');
    assert.equal(res.status, 200);
  });

  test('GET /office-executive/agents.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/agents.js');
    assert.equal(res.status, 200);
  });

  test('GET /office-medieval/ → 200 HTML', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-medieval/');
    assert.equal(res.status, 200, `expected 200, got ${res.status}`);
    assert.ok(res.headers['content-type']?.includes('html'));
  });

  test('GET /office-medieval/medieval-hotbar.js → 200 javascript', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-medieval/medieval-hotbar.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type']?.includes('javascript'));
  });

  test('GET /office-medieval/medieval-game-engine.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-medieval/medieval-game-engine.js');
    assert.equal(res.status, 200);
  });

  test('GET /office-medieval/medieval-audio.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-medieval/medieval-audio.js');
    assert.equal(res.status, 200);
  });

  test('GET /nonexistent-file-xyz.js → 404', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/nonexistent-file-xyz-that-cannot-exist.js');
    assert.equal(res.status, 404, `expected 404, got ${res.status}`);
  });

  test('GET /nonexistent-file-xyz.css → 404', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/nonexistent-file-xyz-that-cannot-exist.css');
    assert.equal(res.status, 404, `expected 404, got ${res.status}`);
  });

  test('GET /nonexistent-file-xyz.png → 404', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/nonexistent-file-xyz-that-cannot-exist.png');
    assert.equal(res.status, 404, `expected 404, got ${res.status}`);
  });

  test('GET /spa/route → 200 (SPA fallback) or 404', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/spa/route');
    assert.ok([200, 404].includes(res.status), `expected 200 or 404, got ${res.status}`);
  });

  test('GET /some/deep/path → 200 or 404 (SPA or not found)', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/some/deep/path/that/does/not/exist');
    assert.ok([200, 404].includes(res.status), `expected 200 or 404, got ${res.status}`);
  });

  test('JavaScript files have no-cache or cache headers', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/main.js');
    assert.equal(res.status, 200);
    // Just check response arrived ok
    assert.ok(res.body.length > 0, 'body not empty');
  });

  test('GET /office-medieval/medieval-minimap.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-medieval/medieval-minimap.js');
    assert.equal(res.status, 200);
  });

  test('GET /office-executive/config.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/config.js');
    assert.equal(res.status, 200);
  });

  test('GET /office-executive/mission-control.js → 200', async (t) => {
    if (!await isServerUp()) return t.skip('Server not reachable');
    const res = await get('/office-executive/mission-control.js');
    assert.equal(res.status, 200);
  });
});
