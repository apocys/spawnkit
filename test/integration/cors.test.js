'use strict';
const { test, describe, before, after } = require('node:test');
const { startServer, stopServer } = require('../helpers/server-harness');
const assert = require('node:assert/strict');
const http = require('node:http');

let BASE = 'http://127.0.0.1:8765';

function options(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type',
        ...headers,
      },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}


describe('CORS integration tests', () => {

  before(async () => { const port = await startServer(); BASE = `http://127.0.0.1:${port}`; });
  after(() => { stopServer(); });


  test('OPTIONS / → 204 No Content', async (t) => {
    const res = await options('/');
    assert.equal(res.status, 204, `expected 204, got ${res.status}`);
  });

  test('OPTIONS / → has Access-Control-Allow-Origin', async (t) => {
    const res = await options('/');
    assert.ok(res.headers['access-control-allow-origin'], 'has Access-Control-Allow-Origin header');
  });

  test('OPTIONS / → Access-Control-Allow-Origin is *', async (t) => {
    const res = await options('/');
    assert.equal(res.headers['access-control-allow-origin'], '*', 'CORS allows all origins');
  });

  test('OPTIONS / → has Access-Control-Allow-Methods', async (t) => {
    const res = await options('/');
    assert.ok(res.headers['access-control-allow-methods'], 'has Allow-Methods header');
    assert.ok(res.headers['access-control-allow-methods'].includes('GET'), 'allows GET');
    assert.ok(res.headers['access-control-allow-methods'].includes('POST'), 'allows POST');
  });

  test('OPTIONS / → has Access-Control-Allow-Headers', async (t) => {
    const res = await options('/');
    assert.ok(res.headers['access-control-allow-headers'], 'has Allow-Headers header');
    assert.ok(res.headers['access-control-allow-headers'].includes('Content-Type'), 'allows Content-Type');
  });

  test('OPTIONS /api/oc/health → 204 No Content', async (t) => {
    const res = await options('/api/oc/health');
    assert.equal(res.status, 204, `expected 204 for health endpoint, got ${res.status}`);
  });

  test('OPTIONS /api/oc/health → has CORS headers', async (t) => {
    const res = await options('/api/oc/health');
    assert.ok(res.headers['access-control-allow-origin'], 'health endpoint has CORS header');
  });

  test('OPTIONS /api/oc/sessions → 204 with CORS headers', async (t) => {
    const res = await options('/api/oc/sessions');
    assert.equal(res.status, 204, `expected 204, got ${res.status}`);
    assert.ok(res.headers['access-control-allow-origin'], 'has CORS header');
  });

  test('OPTIONS /api/oc/chat → 204 with CORS headers', async (t) => {
    const res = await options('/api/oc/chat');
    assert.equal(res.status, 204, `expected 204, got ${res.status}`);
    assert.ok(res.headers['access-control-allow-origin'], 'has CORS header');
  });

  test('OPTIONS response body is empty', async (t) => {
    const res = await options('/');
    assert.equal(res.body, '', 'OPTIONS response body should be empty');
  });
});
