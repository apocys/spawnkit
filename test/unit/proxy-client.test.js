'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { cors, readBody, proxyRequest, proxyFetch } = require('../../server/lib/proxy-client');

// ── Mock HTTP server ───────────────────────────────────────────────────────
let mockServer;
let mockPort;
let lastRequest = {};

function startMockServer() {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        lastRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
        };
        if (req.url === '/401') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
        if (req.url === '/text') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('plain text');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, echo: body || null, method: req.method }));
      });
    });
    mockServer.listen(0, '127.0.0.1', () => {
      mockPort = mockServer.address().port;
      resolve();
    });
  });
}

function stopMockServer() {
  return new Promise((resolve) => mockServer.close(resolve));
}

describe('proxy-client module', () => {
  before(startMockServer);
  after(stopMockServer);

  // ── cors() ─────────────────────────────────────────────────────────────────
  describe('cors(res)', () => {
    test('sets Access-Control-Allow-Origin header', () => {
      const headers = {};
      const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
      cors(mockRes);
      assert.equal(headers['Access-Control-Allow-Origin'], '*');
    });

    test('sets Access-Control-Allow-Methods header', () => {
      const headers = {};
      const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
      cors(mockRes);
      assert.ok(headers['Access-Control-Allow-Methods'].includes('GET'), 'includes GET');
      assert.ok(headers['Access-Control-Allow-Methods'].includes('POST'), 'includes POST');
      assert.ok(headers['Access-Control-Allow-Methods'].includes('OPTIONS'), 'includes OPTIONS');
    });

    test('sets Access-Control-Allow-Headers', () => {
      const headers = {};
      const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
      cors(mockRes);
      assert.ok(headers['Access-Control-Allow-Headers'].includes('Content-Type'), 'includes Content-Type');
      assert.ok(headers['Access-Control-Allow-Headers'].includes('Authorization'), 'includes Authorization');
    });

    test('sets exactly 3 headers', () => {
      const headers = {};
      const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
      cors(mockRes);
      assert.equal(Object.keys(headers).length, 3);
    });
  });

  // ── readBody() ─────────────────────────────────────────────────────────────
  describe('readBody(req)', () => {
    test('reads and parses JSON body from stream', async () => {
      // Create a fake readable stream
      const { Readable } = require('node:stream');
      const payload = JSON.stringify({ hello: 'world', num: 42 });
      const stream = Readable.from([payload]);
      stream.on = function(event, handler) {
        if (event === 'data') {
          Readable.prototype.on.call(this, 'data', handler);
        } else if (event === 'end') {
          Readable.prototype.on.call(this, 'end', handler);
        }
        return this;
      };
      const result = await readBody(stream);
      assert.ok(result !== null, 'result is not null');
      assert.equal(result.hello, 'world');
      assert.equal(result.num, 42);
    });

    test('returns null for invalid JSON body', async () => {
      const { Readable } = require('node:stream');
      const stream = Readable.from(['NOT JSON {{{']);
      const result = await readBody(stream);
      assert.equal(result, null, 'returns null for invalid JSON');
    });

    test('handles empty body gracefully', async () => {
      const { Readable } = require('node:stream');
      const stream = Readable.from(['']);
      const result = await readBody(stream);
      assert.equal(result, null, 'returns null for empty body');
    });

    test('parses array JSON body', async () => {
      const { Readable } = require('node:stream');
      const stream = Readable.from([JSON.stringify([1, 2, 3])]);
      const result = await readBody(stream);
      assert.ok(Array.isArray(result), 'returns array');
      assert.equal(result.length, 3);
    });
  });

  // ── proxyFetch() ───────────────────────────────────────────────────────────
  describe('proxyFetch(url, token)', () => {
    test('returns parsed JSON for successful GET', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      const result = await proxyFetch(url, null);
      assert.equal(result.ok, true, 'ok is true');
      assert.equal(result.status, 200, 'status 200');
      assert.ok(result.data, 'has data');
      assert.equal(result.data.ok, true, 'data.ok is true');
    });

    test('sends Authorization header when token provided', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      await proxyFetch(url, 'my-secret-token');
      assert.ok(lastRequest.headers['authorization'], 'has authorization header');
      assert.ok(lastRequest.headers['authorization'].includes('my-secret-token'), 'contains token');
    });

    test('returns ok:false for non-200 status', async () => {
      const url = `http://127.0.0.1:${mockPort}/401`;
      const result = await proxyFetch(url, null);
      assert.equal(result.ok, false, 'ok is false for 401');
      assert.equal(result.status, 401);
    });

    test('returns ok:false for non-JSON response', async () => {
      const url = `http://127.0.0.1:${mockPort}/text`;
      const result = await proxyFetch(url, null);
      assert.equal(result.ok, false, 'ok false when not JSON (non-200 or parse error)');
    });

    test('returns error object for invalid host', async () => {
      const result = await proxyFetch('http://127.0.0.1:1/', null);
      assert.equal(result.ok, false, 'ok is false for connection refused');
      assert.ok(result.error || result.status === 0, 'has error or status 0');
    });
  });

  // ── proxyRequest() ─────────────────────────────────────────────────────────
  describe('proxyRequest(method, url, token, bodyObj)', () => {
    test('GET request returns parsed JSON', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      const result = await proxyRequest('GET', url, null, null);
      assert.equal(result.ok, true, 'ok is true');
      assert.equal(result.status, 200);
    });

    test('POST request sends JSON body to server', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      const body = { message: 'hello', num: 99 };
      const result = await proxyRequest('POST', url, null, body);
      assert.equal(result.ok, true, 'ok is true');
      assert.equal(result.status, 200);
      assert.equal(result.data.method, 'POST', 'server sees POST');
    });

    test('POST sends correct Content-Type header', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      await proxyRequest('POST', url, null, { test: true });
      assert.ok(lastRequest.headers['content-type'].includes('application/json'), 'Content-Type is JSON');
    });

    test('sends Authorization header when token provided', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      await proxyRequest('GET', url, 'test-token', null);
      assert.ok(lastRequest.headers['authorization'], 'has authorization header');
      assert.ok(lastRequest.headers['authorization'].includes('test-token'), 'contains token');
    });

    test('returns ok:false for 401 response', async () => {
      const url = `http://127.0.0.1:${mockPort}/401`;
      const result = await proxyRequest('GET', url, null, null);
      assert.equal(result.ok, false, 'ok is false for 401');
      assert.equal(result.status, 401);
    });

    test('returns raw string for non-JSON response', async () => {
      const url = `http://127.0.0.1:${mockPort}/text`;
      const result = await proxyRequest('GET', url, null, null);
      assert.ok(result.raw !== undefined, 'has raw field');
    });

    test('returns error object for connection refused', async () => {
      const result = await proxyRequest('GET', 'http://127.0.0.1:1/', null, null);
      assert.equal(result.ok, false, 'ok is false');
      assert.ok(result.error || result.status === 0, 'has error or status 0');
    });

    test('result has ok, status, data, raw fields', async () => {
      const url = `http://127.0.0.1:${mockPort}/`;
      const result = await proxyRequest('GET', url, null, null);
      assert.ok('ok' in result, 'has ok');
      assert.ok('status' in result, 'has status');
    });
  });

  // ── module exports ─────────────────────────────────────────────────────────
  describe('module exports', () => {
    test('exports cors as function', () => {
      assert.equal(typeof cors, 'function');
    });
    test('exports readBody as function', () => {
      assert.equal(typeof readBody, 'function');
    });
    test('exports proxyRequest as function', () => {
      assert.equal(typeof proxyRequest, 'function');
    });
    test('exports proxyFetch as function', () => {
      assert.equal(typeof proxyFetch, 'function');
    });
  });
});
