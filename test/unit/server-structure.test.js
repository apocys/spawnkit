'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '../../server');

describe('server-structure', () => {

  // ── server.js imports ──────────────────────────────────────────────────────
  describe('server.js requires', () => {
    let content;

    test('server.js exists', () => {
      const serverPath = path.join(SERVER_DIR, 'server.js');
      assert.ok(fs.existsSync(serverPath), 'server.js must exist');
      content = fs.readFileSync(serverPath, 'utf8');
    });

    test("server.js requires './lib/oc-reader'", () => {
      if (!content) content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      assert.ok(content.includes("require('./lib/oc-reader')"), "server.js must require('./lib/oc-reader')");
    });

    test("server.js requires './lib/proxy-client'", () => {
      if (!content) content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      assert.ok(content.includes("require('./lib/proxy-client')"), "server.js must require('./lib/proxy-client')");
    });

    test('server.js destructures getAgents from oc-reader', () => {
      if (!content) content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      assert.ok(content.includes('getAgents'), 'server.js references getAgents');
    });

    test('server.js destructures getSessions from oc-reader', () => {
      if (!content) content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      assert.ok(content.includes('getSessions'), 'server.js references getSessions');
    });

    test('server.js destructures cors from proxy-client', () => {
      if (!content) content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      assert.ok(content.includes('cors'), 'server.js references cors');
    });

    test('server.js destructures readBody from proxy-client', () => {
      if (!content) content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      assert.ok(content.includes('readBody'), 'server.js references readBody');
    });
  });

  // ── oc-reader.js exports ───────────────────────────────────────────────────
  describe('oc-reader.js exports', () => {
    let ocReader;

    test('oc-reader.js can be required', () => {
      ocReader = require('../../server/lib/oc-reader');
      assert.ok(ocReader, 'module loaded');
    });

    test('exports getAgents', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getAgents, 'function', 'getAgents is function');
    });

    test('exports getSessions', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getSessions, 'function', 'getSessions is function');
    });

    test('exports getMemory', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getMemory, 'function', 'getMemory is function');
    });

    test('exports getChat', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getChat, 'function', 'getChat is function');
    });

    test('exports getConfig', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getConfig, 'function', 'getConfig is function');
    });

    test('exports getCrons', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getCrons, 'function', 'getCrons is function');
    });

    test('exports getLocalVersion', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getLocalVersion, 'function', 'getLocalVersion is function');
    });

    test('exports getLatestVersion', () => {
      if (!ocReader) ocReader = require('../../server/lib/oc-reader');
      assert.equal(typeof ocReader.getLatestVersion, 'function', 'getLatestVersion is function');
    });
  });

  // ── proxy-client.js exports ────────────────────────────────────────────────
  describe('proxy-client.js exports', () => {
    let proxyClient;

    test('proxy-client.js can be required', () => {
      proxyClient = require('../../server/lib/proxy-client');
      assert.ok(proxyClient, 'module loaded');
    });

    test('exports proxyRequest', () => {
      if (!proxyClient) proxyClient = require('../../server/lib/proxy-client');
      assert.equal(typeof proxyClient.proxyRequest, 'function', 'proxyRequest is function');
    });

    test('exports proxyFetch', () => {
      if (!proxyClient) proxyClient = require('../../server/lib/proxy-client');
      assert.equal(typeof proxyClient.proxyFetch, 'function', 'proxyFetch is function');
    });

    test('exports cors', () => {
      if (!proxyClient) proxyClient = require('../../server/lib/proxy-client');
      assert.equal(typeof proxyClient.cors, 'function', 'cors is function');
    });

    test('exports readBody', () => {
      if (!proxyClient) proxyClient = require('../../server/lib/proxy-client');
      assert.equal(typeof proxyClient.readBody, 'function', 'readBody is function');
    });
  });

  // ── line count checks ──────────────────────────────────────────────────────
  describe('line count checks (modularization succeeded)', () => {
    test('oc-reader.js line count < 400', () => {
      const content = fs.readFileSync(path.join(SERVER_DIR, 'lib/oc-reader.js'), 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines < 400, `oc-reader.js has ${lines} lines, expected < 400`);
    });

    test('proxy-client.js line count < 100', () => {
      const content = fs.readFileSync(path.join(SERVER_DIR, 'lib/proxy-client.js'), 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines < 100, `proxy-client.js has ${lines} lines, expected < 100`);
    });

    test('server.js line count < 2100 after modularization', () => {
      const content = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      const lines = content.split('\n').length;
      assert.ok(lines < 2100, `server.js has ${lines} lines, expected < 2100`);
    });

    test('total lib files are present', () => {
      const libDir = path.join(SERVER_DIR, 'lib');
      const files = fs.readdirSync(libDir).filter(f => f.endsWith('.js'));
      assert.ok(files.includes('oc-reader.js'), 'oc-reader.js in lib/');
      assert.ok(files.includes('proxy-client.js'), 'proxy-client.js in lib/');
    });
  });
});
