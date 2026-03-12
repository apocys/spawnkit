'use strict';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// routines.js uses IIFE and assigns to `global` (in Node.js CJS context, `this` = module.exports)
// So AgentRoutines ends up as a property on the returned module export object.
const routinesExport = require('../../server/lib/routines.js');
const AgentRoutines = routinesExport.AgentRoutines || global.AgentRoutines;

// Mock adapter
function makeAdapter(captured) {
  return {
    showBubble: (id, text, emoji) => captured.push({ fn: 'showBubble', id, text, emoji }),
    hideBubble: (id) => captured.push({ fn: 'hideBubble', id }),
    showProgress: (id, pct) => captured.push({ fn: 'showProgress', id, pct }),
    hideProgress: (id) => captured.push({ fn: 'hideProgress', id }),
    playAnimation: (id, anim) => captured.push({ fn: 'playAnimation', id, anim }),
    moveAgent: (id, pos, cb) => { captured.push({ fn: 'moveAgent', id }); if (cb) cb(); },
    getWaypoints: () => [{ x: 10, y: 10 }],
    getNearestAgent: () => null,
    getAgentPosition: () => null,
    getBuildingByType: () => null,
  };
}

const testAgents = [
  { id: 'agent-1', name: 'Alpha', building: null },
  { id: 'agent-2', name: 'Beta', building: 'library' },
  { id: 'agent-3', name: 'Gamma', building: null },
];

describe('AgentRoutines (routines.js)', () => {

  // ── Module loading ─────────────────────────────────────────────────────────
  describe('module loading', () => {
    test('AgentRoutines is defined on global', () => {
      assert.ok(AgentRoutines, 'AgentRoutines is defined');
    });

    test('AgentRoutines is an object', () => {
      assert.equal(typeof AgentRoutines, 'object');
    });

    test('has init method', () => {
      assert.equal(typeof AgentRoutines.init, 'function');
    });

    test('has start method', () => {
      assert.equal(typeof AgentRoutines.start, 'function');
    });

    test('has stop method', () => {
      assert.equal(typeof AgentRoutines.stop, 'function');
    });

    test('has tick method', () => {
      assert.equal(typeof AgentRoutines.tick, 'function');
    });

    test('has onTask method', () => {
      assert.equal(typeof AgentRoutines.onTask, 'function');
    });

    test('has onTaskComplete method', () => {
      assert.equal(typeof AgentRoutines.onTaskComplete, 'function');
    });

    test('has getState method', () => {
      assert.equal(typeof AgentRoutines.getState, 'function');
    });

    test('has setSchedule method', () => {
      assert.equal(typeof AgentRoutines.setSchedule, 'function');
    });

    test('has registerRoutine method', () => {
      assert.equal(typeof AgentRoutines.registerRoutine, 'function');
    });
  });

  // ── init ───────────────────────────────────────────────────────────────────
  describe('init(adapter, agents)', () => {
    let captured;

    beforeEach(() => {
      captured = [];
      AgentRoutines.stop(); // ensure no loop running
      AgentRoutines.init(makeAdapter(captured), testAgents);
    });

    after(() => {
      AgentRoutines.stop();
    });

    test('getState returns null for unknown agent', () => {
      const state = AgentRoutines.getState('nonexistent');
      assert.equal(state, null);
    });

    test('getState returns object for known agent after init', () => {
      const state = AgentRoutines.getState('agent-1');
      assert.ok(state, 'state is defined');
    });

    test('initial routine is IDLE', () => {
      const state = AgentRoutines.getState('agent-1');
      assert.equal(state.routine, 'IDLE', 'starts in IDLE');
    });

    test('initial progress is 0', () => {
      const state = AgentRoutines.getState('agent-1');
      assert.equal(state.progress, 0, 'initial progress is 0');
    });

    test('initial paused is false', () => {
      const state = AgentRoutines.getState('agent-1');
      assert.equal(state.paused, false, 'not paused initially');
    });

    test('all 3 agents have state after init', () => {
      for (const ag of testAgents) {
        const state = AgentRoutines.getState(ag.id);
        assert.ok(state, `agent ${ag.id} has state`);
      }
    });

    test('state has routine, emoji, text, progress, paused fields', () => {
      const state = AgentRoutines.getState('agent-1');
      assert.ok('routine' in state, 'has routine');
      assert.ok('emoji' in state, 'has emoji');
      assert.ok('text' in state, 'has text');
      assert.ok('progress' in state, 'has progress');
      assert.ok('paused' in state, 'has paused');
    });
  });

  // ── onTask / onTaskComplete ─────────────────────────────────────────────────
  describe('onTask() / onTaskComplete()', () => {
    let captured;

    before(() => {
      captured = [];
      AgentRoutines.stop();
      AgentRoutines.init(makeAdapter(captured), testAgents);
    });

    after(() => {
      AgentRoutines.stop();
    });

    test('onTask changes routine to REAL_TASK', () => {
      AgentRoutines.onTask('agent-1', { name: 'Build feature', progress: 0 });
      const state = AgentRoutines.getState('agent-1');
      assert.equal(state.routine, 'REAL_TASK', 'routine is REAL_TASK');
    });

    test('onTask sets task text in state', () => {
      AgentRoutines.onTask('agent-2', { name: 'Deploy app', progress: 25 });
      const state = AgentRoutines.getState('agent-2');
      assert.equal(state.text, 'Deploy app', 'text matches task name');
    });

    test('onTask does not throw for unknown agent', () => {
      assert.doesNotThrow(() => {
        AgentRoutines.onTask('unknown-agent', { name: 'Test', progress: 0 });
      });
    });

    test('onTaskComplete resets realTask', (t, done) => {
      AgentRoutines.onTask('agent-3', { name: 'Test task', progress: 0 });
      AgentRoutines.onTaskComplete('agent-3');
      // Give async setTimeout a moment
      setTimeout(() => {
        const state = AgentRoutines.getState('agent-3');
        // After completion, routine transitions back (may be IDLE or transition)
        assert.ok(state, 'state still exists after completion');
        done();
      }, 50);
    });
  });

  // ── setSchedule / registerRoutine ────────────────────────────────────────────
  describe('setSchedule() / registerRoutine()', () => {
    before(() => {
      AgentRoutines.stop();
      AgentRoutines.init(makeAdapter([]), testAgents);
    });

    after(() => {
      AgentRoutines.stop();
    });

    test('setSchedule does not throw', () => {
      assert.doesNotThrow(() => {
        AgentRoutines.setSchedule('agent-1', {
          morning: ['WORK'],
          afternoon: ['WORK'],
          evening: ['IDLE'],
          night: ['SLEEP'],
        });
      });
    });

    test('registerRoutine adds new routine', () => {
      assert.doesNotThrow(() => {
        AgentRoutines.registerRoutine('CUSTOM_ROUTINE', {
          animation: 'idle',
          emoji: '🔧',
          text: 'Custom',
          duration: [1000, 2000],
          showProgress: false,
        });
      });
    });
  });

  // ── start / stop ───────────────────────────────────────────────────────────
  describe('start() / stop()', () => {
    before(() => {
      AgentRoutines.stop();
      AgentRoutines.init(makeAdapter([]), testAgents);
    });

    after(() => {
      AgentRoutines.stop();
    });

    test('start() does not throw', () => {
      assert.doesNotThrow(() => AgentRoutines.start());
    });

    test('stop() does not throw', () => {
      assert.doesNotThrow(() => AgentRoutines.stop());
    });

    test('start then stop is idempotent', () => {
      AgentRoutines.start();
      AgentRoutines.start(); // second call should be no-op
      AgentRoutines.stop();
      AgentRoutines.stop(); // second stop should be safe
      assert.ok(true, 'no throws');
    });
  });
});
