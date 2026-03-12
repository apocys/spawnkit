'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MissionOrchestrator = require('../../server/mission-orchestrator.js');

let tmpDir;
let orch;

function makeOrch() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-test-'));
  const workspace = path.join(tmpDir, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  orch = new MissionOrchestrator({
    workspace,
    gatewayUrl: 'http://127.0.0.1:9999', // non-existent, tests won't call it
    gatewayToken: 'test-token',
    sessionsFile: path.join(tmpDir, 'sessions.json'),
  });
  return orch;
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('MissionOrchestrator', () => {
  before(() => {
    makeOrch();
  });

  after(() => {
    teardown();
  });

  // ── Constructor ────────────────────────────────────────────────────────────
  describe('constructor', () => {
    test('is a function/class', () => {
      assert.equal(typeof MissionOrchestrator, 'function', 'exports function');
    });

    test('creates missionsDir', () => {
      const workspace = path.join(tmpDir, 'workspace');
      assert.ok(fs.existsSync(path.join(workspace, '.spawnkit-missions')), 'creates missions dir');
    });

    test('has getMissions method', () => {
      assert.equal(typeof orch.getMissions, 'function');
    });

    test('has saveMissions method', () => {
      assert.equal(typeof orch.saveMissions, 'function');
    });

    test('has getMission method', () => {
      assert.equal(typeof orch.getMission, 'function');
    });

    test('has updateMission method', () => {
      assert.equal(typeof orch.updateMission, 'function');
    });
  });

  // ── getMissions ────────────────────────────────────────────────────────────
  describe('getMissions()', () => {
    test('returns [] when no missions file', () => {
      const result = orch.getMissions();
      assert.ok(Array.isArray(result), 'is array');
    });

    test('returns empty array initially', () => {
      const result = orch.getMissions();
      assert.equal(result.length, 0, 'no missions initially');
    });
  });

  // ── saveMissions / getMissions round-trip ──────────────────────────────────
  describe('saveMissions() / getMissions() round-trip', () => {
    test('saves and retrieves missions', () => {
      const missions = [
        { id: 'mission-1', name: 'Test Mission', status: 'pending', tasks: [] },
        { id: 'mission-2', name: 'Another Mission', status: 'active', tasks: [] },
      ];
      orch.saveMissions(missions);
      const loaded = orch.getMissions();
      assert.equal(loaded.length, 2, 'loaded 2 missions');
      assert.equal(loaded[0].id, 'mission-1');
      assert.equal(loaded[1].id, 'mission-2');
    });

    test('saved missions persist to disk', () => {
      const missions = [{ id: 'persist-1', name: 'Persisted', status: 'pending', tasks: [] }];
      orch.saveMissions(missions);
      // Raw read from disk
      const raw = JSON.parse(fs.readFileSync(orch.missionsFile, 'utf8'));
      assert.equal(raw.length, 1);
      assert.equal(raw[0].id, 'persist-1');
    });
  });

  // ── getMission ─────────────────────────────────────────────────────────────
  describe('getMission(id)', () => {
    before(() => {
      orch.saveMissions([
        { id: 'm-alpha', name: 'Alpha', status: 'pending', tasks: [] },
        { id: 'm-beta', name: 'Beta', status: 'active', tasks: [] },
      ]);
    });

    test('returns mission by id', () => {
      const m = orch.getMission('m-alpha');
      assert.ok(m, 'found mission');
      assert.equal(m.name, 'Alpha');
    });

    test('returns null for unknown id', () => {
      const m = orch.getMission('nonexistent-id');
      assert.equal(m, null, 'returns null for unknown id');
    });

    test('returns correct mission among multiple', () => {
      const m = orch.getMission('m-beta');
      assert.equal(m.status, 'active');
    });
  });

  // ── updateMission ──────────────────────────────────────────────────────────
  describe('updateMission(id, updates)', () => {
    before(() => {
      orch.saveMissions([
        { id: 'upd-1', name: 'Update Test', status: 'pending', tasks: [], progress: 0 },
      ]);
    });

    test('updates mission fields', () => {
      const result = orch.updateMission('upd-1', { status: 'active', progress: 50 });
      assert.ok(result, 'returns updated mission');
      assert.equal(result.status, 'active');
      assert.equal(result.progress, 50);
    });

    test('updated mission persists', () => {
      const m = orch.getMission('upd-1');
      assert.equal(m.status, 'active', 'status persisted');
    });

    test('returns null for unknown id', () => {
      const result = orch.updateMission('does-not-exist', { status: 'done' });
      assert.equal(result, null, 'returns null for missing mission');
    });

    test('adds updated timestamp', () => {
      const result = orch.updateMission('upd-1', { progress: 75 });
      assert.ok(result.updated, 'has updated timestamp');
    });
  });

  // ── logEvent ───────────────────────────────────────────────────────────────
  describe('logEvent()', () => {
    test('has logEvent method', () => {
      assert.equal(typeof orch.logEvent, 'function');
    });

    test('logEvent writes to mission log file', () => {
      // Create a mission first
      orch.saveMissions([{ id: 'log-test', name: 'Log Test', status: 'pending', tasks: [] }]);
      orch.logEvent('log-test', 'test_event', { message: 'hello' });
      const logFile = path.join(orch.missionsDir, 'log-test.log.jsonl');
      assert.ok(fs.existsSync(logFile), 'log file created');
      const line = JSON.parse(fs.readFileSync(logFile, 'utf8').trim().split('\n')[0]);
      assert.equal(line.type, 'test_event');
      assert.equal(line.message, 'hello');
    });
  });

  // ── resumeActivePolling ────────────────────────────────────────────────────
  describe('resumeActivePolling()', () => {
    test('has resumeActivePolling method', () => {
      assert.equal(typeof orch.resumeActivePolling, 'function');
    });

    test('does not throw when no active missions', () => {
      orch.saveMissions([{ id: 'idle-1', name: 'Idle', status: 'pending', tasks: [] }]);
      assert.doesNotThrow(() => orch.resumeActivePolling());
    });
  });
});
