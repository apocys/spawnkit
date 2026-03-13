/**
 * Phase 1: Core Feature Tests — Happy Path
 * Tests: Fleet relay wiring, per-agent chat, mission desk header
 * Run: node test/phase1-core-features.test.js
 */

const http = require('http');
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8765';

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  return fn().then(function () {
    passed++;
    console.log('  ✅ ' + name);
  }).catch(function (err) {
    failed++;
    console.log('  ❌ ' + name + ': ' + err.message);
  });
}

function apiGet(path) {
  return new Promise(function (resolve, reject) {
    http.get(API_BASE + path, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    }).on('error', reject);
  });
}

function apiPost(path, body) {
  return new Promise(function (resolve, reject) {
    const postData = JSON.stringify(body);
    const opts = {
      method: 'POST',
      hostname: new URL(API_BASE).hostname,
      port: new URL(API_BASE).port,
      path: path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const req = http.request(opts, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('\n🧪 Phase 1: Core Feature Tests\n');

  // ── Fleet Relay Routes ──────────────────────────────────────
  console.log('Fleet Relay Routes:');

  await test('GET /api/fleet/status returns JSON (200 or 502)', async function () {
    const r = await apiGet('/api/fleet/status');
    if (r.status !== 200) throw new Error("Expected 200, got " + r.status);
    if (typeof r.data !== 'object') throw new Error('Expected JSON object');
  });

  await test('GET /api/fleet/status returns instances array when relay up', async function () {
    const r = await apiGet('/api/fleet/status');
    if (r.status === 502) return; // Skip if relay is down
    if (!Array.isArray(r.data.instances)) throw new Error('Missing instances array');
  });

  await test('GET /api/fleet/mailbox returns JSON (200 or 502)', async function () {
    const r = await apiGet('/api/fleet/mailbox');
    if (r.status !== 200) throw new Error("Expected 200, got " + r.status);
    if (typeof r.data !== 'object') throw new Error('Expected JSON object');
  });

  await test('GET /api/fleet/mailbox returns messages array when relay up', async function () {
    const r = await apiGet('/api/fleet/mailbox');
    if (r.status === 502) return; // Skip if relay is down
    if (!r.data.messages) throw new Error('Missing messages field');
  });

  await test('GET /api/fleet/peers returns JSON', async function () {
    const r = await apiGet('/api/fleet/peers');
    if (r.status !== 200) throw new Error("Expected 200, got " + r.status);
  });

  // ── Chat API ────────────────────────────────────────────────
  console.log('\nChat API:');

  await test('GET /api/oc/chat returns messages array', async function () {
    const r = await apiGet('/api/oc/chat');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
    if (!r.data.messages && !Array.isArray(r.data)) throw new Error('Missing messages');
  });

  await test('POST /api/oc/chat rejects missing message', async function () {
    const r = await apiPost('/api/oc/chat', {});
    if (r.status !== 400) throw new Error('Expected 400, got ' + r.status);
  });

  await test('POST /api/oc/chat with persona prefix sends correctly', async function () {
    // We just verify the endpoint accepts the message format
    const r = await apiPost('/api/oc/chat', { message: '[Speaking to Atlas] Hello Atlas' });
    // 200 = gateway responded, 502 = gateway not running (both valid)
    if (r.status !== 200) throw new Error("Expected 200, got " + r.status);
  });

  // ── Other Core APIs ─────────────────────────────────────────
  console.log('\nCore APIs:');

  await test('GET /api/oc/sessions returns data', async function () {
    const r = await apiGet('/api/oc/sessions');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
  });

  await test('GET /api/oc/agents returns agent list', async function () {
    const r = await apiGet('/api/oc/agents');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
    if (!r.data.agents && !Array.isArray(r.data)) throw new Error('Missing agents');
  });

  await test('GET /api/oc/crons returns jobs', async function () {
    const r = await apiGet('/api/oc/crons');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
    if (!r.data.jobs && !Array.isArray(r.data)) throw new Error('Missing jobs');
  });

  await test('GET /api/oc/memory returns data', async function () {
    const r = await apiGet('/api/oc/memory');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
  });

  await test('GET /api/oc/health returns ok', async function () {
    const r = await apiGet('/api/oc/health');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
    if (!r.data.ok) throw new Error('Health check failed');
  });

  await test('GET /api/oc/skills returns skills array', async function () {
    const r = await apiGet('/api/oc/skills');
    if (r.status !== 200) throw new Error('Expected 200, got ' + r.status);
    if (!r.data.skills) throw new Error('Missing skills');
  });

  // ── Static Serving ──────────────────────────────────────────
  console.log('\nStatic Serving:');

  await test('GET / returns HTML', async function () {
    return new Promise(function (resolve, reject) {
      http.get(API_BASE + '/', function (res) {
        let data = '';
        res.on('data', function (c) { data += c; });
        res.on('end', function () {
          if (res.statusCode !== 200) return reject(new Error('Expected 200, got ' + res.statusCode));
          if (!data.includes('<!DOCTYPE html') && !data.includes('<html')) return reject(new Error('Not HTML'));
          resolve();
        });
      }).on('error', reject);
    });
  });

  await test('GET /office-medieval/ returns HTML', async function () {
    return new Promise(function (resolve, reject) {
      http.get(API_BASE + '/office-medieval/', function (res) {
        let data = '';
        res.on('data', function (c) { data += c; });
        res.on('end', function () {
          if (res.statusCode !== 200) return reject(new Error('Expected 200, got ' + res.statusCode));
          if (!data.includes('<html') && !data.includes('<!DOCTYPE')) return reject(new Error('Not HTML'));
          resolve();
        });
      }).on('error', reject);
    });
  });

  // ── Results ─────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(40));
  console.log('Results: ' + passed + '/' + total + ' passed' + (failed ? ', ' + failed + ' failed' : ''));
  console.log('─'.repeat(40) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function (e) {
  console.error('Fatal:', e);
  process.exit(1);
});
