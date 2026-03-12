'use strict';
const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// We need to override HOME for the module to pick up our temp dirs.
// Since oc-reader reads process.env.HOME at module load time, we mock via env before requiring.

let tmpDir;
let origHome;
let origWorkspace;
let origSessionsFile;

function setupEnv() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-reader-test-'));
  origHome = process.env.HOME;
  origWorkspace = process.env.WORKSPACE;
  // Set up ~/.openclaw structure
  const ocDir = path.join(tmpDir, '.openclaw');
  const agentsDir = path.join(ocDir, 'agents', 'main', 'sessions');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.mkdirSync(path.join(ocDir, 'workspace'), { recursive: true });
  process.env.HOME = tmpDir;
  process.env.WORKSPACE = path.join(tmpDir, '.openclaw', 'workspace');
}

function teardownEnv() {
  process.env.HOME = origHome;
  process.env.WORKSPACE = origWorkspace;
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('oc-reader module', () => {
  let reader;

  before(() => {
    setupEnv();
    // Clear module cache so it re-reads env
    delete require.cache[require.resolve('../../server/lib/oc-reader')];
    reader = require('../../server/lib/oc-reader');
  });

  after(() => {
    teardownEnv();
  });

  // ── getAgents ──────────────────────────────────────────────────────────────
  describe('getAgents()', () => {
    test('returns object with agents array when no agents.json', () => {
      const result = reader.getAgents();
      assert.ok(result, 'result is defined');
      assert.ok(Array.isArray(result.agents), 'result.agents is array');
    });

    test('default agents array is non-empty', () => {
      const result = reader.getAgents();
      assert.ok(result.agents.length > 0, 'has at least one agent');
    });

    test('default agents have id, name, role, status fields', () => {
      const result = reader.getAgents();
      const agent = result.agents[0];
      assert.ok(agent.id, 'has id');
      assert.ok(agent.name, 'has name');
      assert.ok(agent.role, 'has role');
      assert.ok(agent.status, 'has status');
    });

    test('reads agents.json when present', () => {
      const workspace = process.env.WORKSPACE;
      const agentsFile = path.join(workspace, 'agents.json');
      const customAgents = { agents: [
        { id: 'test1', name: 'Test1', role: 'Tester', status: 'active' },
        { id: 'test2', name: 'Test2', role: 'Builder', status: 'active' },
      ]};
      fs.writeFileSync(agentsFile, JSON.stringify(customAgents));
      // Reload module
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getAgents();
      assert.equal(result.agents.length, 2, 'reads 2 agents from file');
      assert.equal(result.agents[0].id, 'test1');
      assert.equal(result.agents[1].id, 'test2');
      fs.unlinkSync(agentsFile);
    });

    test('returns default when agents.json has invalid JSON', () => {
      const workspace = process.env.WORKSPACE;
      const agentsFile = path.join(workspace, 'agents.json');
      fs.writeFileSync(agentsFile, 'NOT JSON {{{{');
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getAgents();
      assert.ok(Array.isArray(result.agents), 'falls back to default array');
      fs.unlinkSync(agentsFile);
    });
  });

  // ── getSessions ────────────────────────────────────────────────────────────
  describe('getSessions()', () => {
    test('returns [] when sessions.json does not exist', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getSessions();
      assert.ok(Array.isArray(result), 'is array');
      assert.equal(result.length, 0, 'empty when no file');
    });

    test('returns [] when sessions.json has malformed JSON', () => {
      const sessFile = path.join(tmpDir, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
      fs.writeFileSync(sessFile, 'NOT VALID JSON');
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getSessions();
      assert.ok(Array.isArray(result), 'is array even with bad JSON');
      assert.equal(result.length, 0);
      fs.unlinkSync(sessFile);
    });

    test('returns session array with correct shape', () => {
      const sessFile = path.join(tmpDir, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
      const now = Date.now();
      const sessions = {
        sessions: {
          'agent:main:main': { label: 'main session', updatedAt: now, model: 'claude', totalTokens: 100 },
          'agent:main:subagent:abc': { label: 'build feature', updatedAt: now - 600000, model: 'gpt', totalTokens: 50 },
        }
      };
      fs.writeFileSync(sessFile, JSON.stringify(sessions));
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getSessions();
      assert.equal(result.length, 2, 'returns 2 sessions');
      const main = result.find(s => s.key === 'agent:main:main');
      assert.ok(main, 'finds main session');
      assert.equal(main.kind, 'main', 'correct kind');
      assert.equal(main.status, 'active', 'active session');
      const sub = result.find(s => s.key === 'agent:main:subagent:abc');
      assert.ok(sub, 'finds subagent session');
      assert.equal(sub.kind, 'subagent', 'correct subagent kind');
      assert.equal(sub.status, 'idle', 'old session is idle');
      fs.unlinkSync(sessFile);
    });

    test('session with build label has coding action', () => {
      const sessFile = path.join(tmpDir, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
      const now = Date.now();
      const sessions = { sessions: { 'agent:main:main': { label: 'build feature xyz', updatedAt: now, model: 'claude' } } };
      fs.writeFileSync(sessFile, JSON.stringify(sessions));
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getSessions();
      assert.equal(result[0].action, 'coding');
      fs.unlinkSync(sessFile);
    });

    test('session with review label has reviewing action', () => {
      const sessFile = path.join(tmpDir, '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
      const now = Date.now();
      const sessions = { sessions: { 'agent:main:main': { label: 'review PR', updatedAt: now, model: 'claude' } } };
      fs.writeFileSync(sessFile, JSON.stringify(sessions));
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getSessions();
      assert.equal(result[0].action, 'reviewing');
      fs.unlinkSync(sessFile);
    });
  });

  // ── getMemory ──────────────────────────────────────────────────────────────
  describe('getMemory()', () => {
    test('returns { main: "", todo: "", files: [] } when no files exist', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getMemory();
      assert.ok(typeof result === 'object', 'is object');
      assert.equal(result.main, '', 'main is empty string');
      assert.ok(Array.isArray(result.files), 'files is array');
    });

    test('returns main content when MEMORY.md exists', () => {
      const workspace = process.env.WORKSPACE;
      const memFile = path.join(workspace, 'MEMORY.md');
      fs.writeFileSync(memFile, '# Memory\nHello world');
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getMemory();
      assert.equal(result.main, '# Memory\nHello world');
      fs.unlinkSync(memFile);
    });

    test('returns todo content when TODO.md exists', () => {
      const workspace = process.env.WORKSPACE;
      const todoFile = path.join(workspace, 'TODO.md');
      fs.writeFileSync(todoFile, '- task 1\n- task 2');
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getMemory();
      assert.equal(result.todo, '- task 1\n- task 2');
      fs.unlinkSync(todoFile);
    });

    test('files array includes files from memory dir', () => {
      const workspace = process.env.WORKSPACE;
      const memDir = path.join(workspace, 'memory');
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(path.join(memDir, 'note1.md'), 'note content');
      fs.writeFileSync(path.join(memDir, 'note2.md'), 'other note');
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getMemory();
      assert.ok(result.files.length >= 2, 'has memory files');
      const names = result.files.map(f => f.name);
      assert.ok(names.includes('note1.md'), 'includes note1.md');
      assert.ok(names.includes('note2.md'), 'includes note2.md');
      fs.rmSync(memDir, { recursive: true });
    });
  });

  // ── getCrons ───────────────────────────────────────────────────────────────
  describe('getCrons()', () => {
    test('returns { jobs: [] } when openclaw binary not found', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      // On this test env, openclaw may or may not exist; just check shape
      const result = r.getCrons();
      assert.ok(typeof result === 'object', 'is object');
      assert.ok(Array.isArray(result.jobs), 'jobs is array');
    });

    test('getCrons returns jobs key', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getCrons();
      assert.ok('jobs' in result, 'has jobs key');
    });
  });

  // ── getLocalVersion ────────────────────────────────────────────────────────
  describe('getLocalVersion()', () => {
    test('returns object with version field', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getLocalVersion();
      assert.ok(typeof result === 'object', 'is object');
      assert.ok('version' in result, 'has version field');
    });

    test('version is a string', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getLocalVersion();
      assert.equal(typeof result.version, 'string', 'version is string');
    });
  });

  // ── getConfig ──────────────────────────────────────────────────────────────
  describe('getConfig()', () => {
    test('returns object (possibly empty)', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getConfig();
      assert.ok(typeof result === 'object', 'is object');
    });

    test('strips gateway auth token from config', () => {
      const ocFile = path.join(tmpDir, '.openclaw', 'openclaw.json');
      fs.writeFileSync(ocFile, JSON.stringify({
        gateway: { auth: { token: 'SECRET_TOKEN', other: 'keep' }, url: 'http://localhost' },
        channels: { telegram: { botToken: 'TG_TOKEN', chatId: '123' } },
        name: 'test-config'
      }));
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      const result = r.getConfig();
      assert.equal(result.gateway.auth.token, undefined, 'token stripped');
      assert.equal(result.channels.telegram.botToken, undefined, 'botToken stripped');
      assert.equal(result.name, 'test-config', 'other fields kept');
      fs.unlinkSync(ocFile);
    });
  });

  // ── module exports ─────────────────────────────────────────────────────────
  describe('module exports', () => {
    test('exports getAgents', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getAgents, 'function');
    });
    test('exports getSessions', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getSessions, 'function');
    });
    test('exports getMemory', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getMemory, 'function');
    });
    test('exports getChat', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getChat, 'function');
    });
    test('exports getConfig', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getConfig, 'function');
    });
    test('exports getCrons', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getCrons, 'function');
    });
    test('exports getLocalVersion', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getLocalVersion, 'function');
    });
    test('exports getLatestVersion', () => {
      delete require.cache[require.resolve('../../server/lib/oc-reader')];
      const r = require('../../server/lib/oc-reader');
      assert.equal(typeof r.getLatestVersion, 'function');
    });
  });
});
