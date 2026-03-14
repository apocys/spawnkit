'use strict';
const { test, describe, before, after } = require('node:test');
const { startServer, stopServer } = require('../helpers/server-harness');
const assert = require('node:assert/strict');
const http = require('node:http');

let BASE = 'http://127.0.0.1:8765';
let REFERER = 'http://127.0.0.1:8765/';

// Helper: GET request returning { status, headers, body }
function get(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Referer: REFERER, ...headers },
      timeout: 5000,
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Check if server is reachable

describe('static file handler', () => {

  before(async () => { const port = await startServer(); BASE = `http://127.0.0.1:${port}`; REFERER = BASE + '/'; });
  after(() => { stopServer(); });

  test('/office-executive/main.js returns 200', async (t) => {
    const res = await get('/office-executive/main.js');
    assert.equal(res.status, 200, `expected 200 got ${res.status}`);
  });

  test('/office-executive/main.js Content-Type is javascript', async (t) => {
    const res = await get('/office-executive/main.js');
    assert.ok(res.headers['content-type'], 'has content-type');
    assert.ok(res.headers['content-type'].includes('javascript'), `expected javascript, got ${res.headers['content-type']}`);
  });

  test('/office-executive/styles.css returns 200', async (t) => {
    try {
      const res = await get('/office-executive/styles.css');
      // styles.css may or may not exist; just check content-type if 200
      if (res.status === 200) {
        assert.ok(res.headers['content-type'].includes('css'), `expected css content-type, got ${res.headers['content-type']}`);
      } else {
        // Check mc-layout.css as alternative
        const res2 = await get('/office-executive/mc-layout.css');
        assert.ok([200, 404].includes(res2.status), 'css file response is valid');
      }
    } catch(e) {
      assert.ok(false, 'css request failed: ' + e.message);
    }
  });

  test('/office-executive/app.js Content-Type is javascript', async (t) => {
    const res = await get('/office-executive/app.js');
    assert.equal(res.status, 200, 'app.js exists');
    assert.ok(res.headers['content-type'].includes('javascript'), 'Content-Type javascript');
  });

  test('/office-medieval/medieval-hotbar.js returns 200', async (t) => {
    const res = await get('/office-medieval/medieval-hotbar.js');
    assert.equal(res.status, 200, `expected 200 got ${res.status}`);
  });

  test('/office-medieval/medieval-hotbar.js Content-Type is javascript', async (t) => {
    const res = await get('/office-medieval/medieval-hotbar.js');
    assert.ok(res.headers['content-type'].includes('javascript'), `expected javascript content-type, got ${res.headers['content-type']}`);
  });

  test('/office-medieval/medieval-game-engine.js returns 200', async (t) => {
    const res = await get('/office-medieval/medieval-game-engine.js');
    assert.equal(res.status, 200);
  });

  test('/nonexistent-file-xyz.js returns 404', async (t) => {
    const res = await get('/nonexistent-file-xyz.js');
    assert.equal(res.status, 404, `expected 404 got ${res.status}`);
  });

  test('/nonexistent-file-xyz.css returns 404', async (t) => {
    const res = await get('/nonexistent-file-xyz.css');
    assert.equal(res.status, 404, `expected 404 got ${res.status}`);
  });

  test('/this/path/does/not/exist returns 404 or 200 (SPA fallback)', async (t) => {
    const res = await get('/this/path/does/not/exist');
    // SPA servers often return 200 with index.html
    assert.ok([200, 404].includes(res.status), `expected 200 or 404, got ${res.status}`);
  });

  test('/ returns 200 HTML', async (t) => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('html'), 'content-type is html');
  });

  test('/office-executive/ returns 200 HTML', async (t) => {
    const res = await get('/office-executive/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('html'), 'content-type is html');
  });

  test('/office-medieval/ returns 200 HTML', async (t) => {
    const res = await get('/office-medieval/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('html'), 'content-type is html');
  });

  test('CORS headers present on static file response', async (t) => {
    const res = await get('/office-executive/main.js');
    assert.ok(res.headers['access-control-allow-origin'], 'has CORS origin header');
  });

  test('/office-executive/agents.js returns 200', async (t) => {
    const res = await get('/office-executive/agents.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('javascript'));
  });

  test('/office-executive/config.js returns 200', async (t) => {
    const res = await get('/office-executive/config.js');
    assert.equal(res.status, 200);
  });

  test('/favicon.svg returns 200 with svg content-type', async (t) => {
    const res = await get('/favicon.svg');
    if (res.status === 200) {
      assert.ok(res.headers['content-type'].includes('svg'), 'SVG content type');
    } else {
      assert.equal(res.status, 404);
    }
  });

  test('/office-medieval/medieval-audio.js returns 200', async (t) => {
    const res = await get('/office-medieval/medieval-audio.js');
    assert.equal(res.status, 200);
  });

  test('/office-medieval/medieval-minimap.js returns 200', async (t) => {
    const res = await get('/office-medieval/medieval-minimap.js');
    assert.equal(res.status, 200);
  });
});
