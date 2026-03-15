'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Simple test to verify basic CSL functionality without complex JSDOM setup
describe('Simple CSL Tests', () => {
  test('can import consciousness-resonance module', () => {
    // Test that the module can be loaded
    assert.doesNotThrow(() => {
      const ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
      assert.ok(typeof ConsciousnessResonance === 'function', 'Should export a class/function');
    });
  });

  test('can import village-customizer module', () => {
    // Test that the module can be loaded  
    assert.doesNotThrow(() => {
      const VillageCustomizer = require('../../server/office-medieval/village-customizer.js');
      assert.ok(typeof VillageCustomizer === 'function', 'Should export a class/function');
    });
  });

  test('consciousness resonance constructor works', () => {
    // Mock minimal globals needed
    global.window = { location: { pathname: 'medieval', port: '8766' } };
    global.document = { 
      readyState: 'complete',
      addEventListener: () => {},
      createElement: () => ({ 
        style: {}, 
        innerHTML: '', 
        onclick: null,
        querySelector: () => null,
        addEventListener: () => {}
      }),
      querySelector: () => null,
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    };
    global.console = { log: () => {} };

    const ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    
    assert.doesNotThrow(() => {
      const resonance = new ConsciousnessResonance();
      assert.ok(resonance.crystalField instanceof Map, 'Should have crystalField Map');
      assert.ok(Array.isArray(resonance.resonanceHistory), 'Should have resonanceHistory array');
      assert.ok(resonance.conceptDatabase instanceof Map, 'Should have conceptDatabase Map');
    });

    // Cleanup
    delete global.window;
    delete global.document;
    delete global.console;
  });

  test('basic vector similarity calculation', () => {
    // Mock minimal environment
    global.window = { location: { pathname: 'medieval', port: '8766' } };
    global.document = { 
      readyState: 'complete',
      addEventListener: () => {},
      createElement: () => ({ style: {}, innerHTML: '', onclick: null }),
      querySelector: () => null,
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    };
    global.console = { log: () => {} };

    const ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    const resonance = new ConsciousnessResonance();

    // Test basic similarity calculation
    const similarity1 = resonance.calculateCosineSimilarity([1, 0, 0], [1, 0, 0]);
    assert.equal(similarity1, 1, 'Identical vectors should have similarity 1');

    const similarity2 = resonance.calculateCosineSimilarity([1, 0, 0], [0, 1, 0]);
    assert.equal(similarity2, 0, 'Orthogonal vectors should have similarity 0');

    const similarity3 = resonance.calculateCosineSimilarity([1, 0, 0], [-1, 0, 0]);
    assert.equal(similarity3, -1, 'Opposite vectors should have similarity -1');

    // Cleanup
    delete global.window;
    delete global.document;
    delete global.console;
  });

  test('basic concept addition', () => {
    // Mock minimal environment
    global.window = { location: { pathname: 'medieval', port: '8766' } };
    global.document = { 
      readyState: 'complete',
      addEventListener: () => {},
      createElement: () => ({ style: {}, innerHTML: '', onclick: null }),
      querySelector: () => null,
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    };
    global.console = { log: () => {} };

    const ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    const resonance = new ConsciousnessResonance();

    // Test adding a concept
    const testData = {
      vector: [0.8, 0.6, 0.7, 0.5, 0.9],
      strength: 0.8,
      discovery: 'Test concept',
      timestamp: Date.now()
    };

    resonance.addConcept('test-agent', 'test-concept', testData);

    assert.ok(resonance.conceptDatabase.has('test-agent'), 'Should create agent entry');
    assert.ok(resonance.conceptDatabase.get('test-agent').has('test-concept'), 'Should store concept');
    
    const storedData = resonance.conceptDatabase.get('test-agent').get('test-concept');
    assert.deepEqual(storedData, testData, 'Should preserve concept data');

    // Cleanup
    delete global.window;
    delete global.document;
    delete global.console;
  });

  test('basic resonance detection', () => {
    // Mock minimal environment
    global.window = { location: { pathname: 'medieval', port: '8766' } };
    global.document = { 
      readyState: 'complete',
      addEventListener: () => {},
      createElement: () => ({ style: {}, innerHTML: '', onclick: null }),
      querySelector: () => null,
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    };
    global.console = { log: () => {} };

    const ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    const resonance = new ConsciousnessResonance();

    // Add a base concept
    resonance.addConcept('agent1', 'concept1', {
      vector: [0.9, 0.1, 0.1, 0.1, 0.1],
      strength: 0.8,
      discovery: 'Base concept',
      timestamp: Date.now()
    });

    // Test high resonance detection
    const resonances = resonance.detectResonances('agent2', 'concept2', {
      vector: [0.88, 0.12, 0.08, 0.08, 0.08], // Very similar to concept1
      strength: 0.8,
      discovery: 'Similar concept',
      timestamp: Date.now()
    });

    assert.ok(resonances.length > 0, 'Should detect resonance');
    assert.ok(resonances[0].similarity > 0.7, 'Should be above threshold');
    assert.equal(resonances[0].agent, 'agent1', 'Should reference correct agent');

    // Cleanup
    delete global.window;
    delete global.document;
    delete global.console;
  });
});