'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Core functionality tests with proper JSDOM setup
describe('CSL Core Functionality Tests', () => {
  let dom, window, document;
  let ConsciousnessResonance, VillageCustomizer;

  before(() => {
    // Set up JSDOM environment before requiring modules
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>CSL Test</title></head>
        <body>
          <div id="castle-app">
            <canvas id="canvas"></canvas>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:8766/',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Set up globals BEFORE importing modules
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Event = dom.window.Event;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    global.localStorage = {
      data: {},
      getItem(key) { return this.data[key] || null; },
      setItem(key, value) { this.data[key] = String(value); },
      removeItem(key) { delete this.data[key]; },
      clear() { this.data = {}; }
    };

    // Mock THREE.js
    global.THREE = {
      Group: class {
        constructor() {
          this.children = [];
          this.position = { x: 0, y: 0, z: 0 };
          this.userData = {};
        }
        add(obj) { this.children.push(obj); }
        remove(obj) {
          const idx = this.children.indexOf(obj);
          if (idx > -1) this.children.splice(idx, 1);
        }
        traverse(fn) { fn(this); }
      },
      Mesh: class {
        constructor() {
          this.material = { color: { setHex: () => {} } };
          this.position = { x: 0, y: 0, z: 0 };
          this.userData = {};
        }
      },
      BoxGeometry: class {},
      MeshStandardMaterial: class {
        constructor() {
          this.color = { setHex: () => {} };
        }
      }
    };

    // Mock fetch
    global.fetch = async () => ({ ok: true });

    // Now we can safely import the modules
    ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    VillageCustomizer = require('../../server/office-medieval/village-customizer.js');
  });

  after(() => {
    if (dom) {
      dom.window.close();
    }
    // Clean up globals
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.HTMLElement;
    delete global.Element;
    delete global.Event;
    delete global.requestAnimationFrame;
    delete global.localStorage;
    delete global.THREE;
    delete global.fetch;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Functionality Tests
  // ═══════════════════════════════════════════════════════════════════════════

  test('ConsciousnessResonance can be instantiated', () => {
    const resonance = new ConsciousnessResonance();
    
    assert.ok(resonance.crystalField instanceof Map, 'Should have crystalField Map');
    assert.ok(Array.isArray(resonance.resonanceHistory), 'Should have resonanceHistory array');
    assert.ok(resonance.conceptDatabase instanceof Map, 'Should have conceptDatabase Map');
    assert.equal(resonance.isActive, false, 'Should start inactive');
  });

  test('Vector similarity calculation works correctly', () => {
    const resonance = new ConsciousnessResonance();
    
    // Test identical vectors
    const sim1 = resonance.calculateCosineSimilarity([1, 0, 0], [1, 0, 0]);
    assert.equal(sim1, 1, 'Identical vectors should have similarity 1');
    
    // Test orthogonal vectors  
    const sim2 = resonance.calculateCosineSimilarity([1, 0, 0], [0, 1, 0]);
    assert.equal(sim2, 0, 'Orthogonal vectors should have similarity 0');
    
    // Test opposite vectors
    const sim3 = resonance.calculateCosineSimilarity([1, 0, 0], [-1, 0, 0]);
    assert.equal(sim3, -1, 'Opposite vectors should have similarity -1');
  });

  test('Concept addition and storage works', () => {
    const resonance = new ConsciousnessResonance();
    
    const conceptData = {
      vector: [0.8, 0.6, 0.7, 0.5, 0.9],
      strength: 0.8,
      discovery: 'Test concept for storage',
      timestamp: Date.now()
    };
    
    resonance.addConcept('test-agent', 'test-concept', conceptData);
    
    assert.ok(resonance.conceptDatabase.has('test-agent'), 'Should create agent entry');
    assert.ok(resonance.conceptDatabase.get('test-agent').has('test-concept'), 'Should store concept');
    
    const stored = resonance.conceptDatabase.get('test-agent').get('test-concept');
    assert.deepEqual(stored, conceptData, 'Should preserve concept data exactly');
  });

  test('Resonance detection works correctly', () => {
    const resonance = new ConsciousnessResonance();
    
    // Add a base concept
    resonance.addConcept('agent1', 'base-concept', {
      vector: [0.9, 0.1, 0.1, 0.1, 0.1],
      strength: 0.8,
      discovery: 'Base concept for resonance test',
      timestamp: Date.now()
    });
    
    // Test high similarity (should resonate)
    const highSimilarityResonances = resonance.detectResonances('agent2', 'similar-concept', {
      vector: [0.88, 0.12, 0.08, 0.08, 0.08], // Very similar to base
      strength: 0.8,
      discovery: 'Highly similar concept',
      timestamp: Date.now()
    });
    
    assert.ok(highSimilarityResonances.length > 0, 'Should detect high similarity resonance');
    assert.ok(highSimilarityResonances[0].similarity > 0.7, 'Similarity should be above threshold');
    assert.equal(highSimilarityResonances[0].agent, 'agent1', 'Should reference correct source agent');
    
    // Test low similarity (should not resonate)
    const lowSimilarityResonances = resonance.detectResonances('agent3', 'different-concept', {
      vector: [0.1, 0.1, 0.1, 0.1, 0.9], // Very different from base
      strength: 0.8,
      discovery: 'Very different concept',
      timestamp: Date.now()
    });
    
    assert.equal(lowSimilarityResonances.length, 0, 'Should not detect low similarity resonance');
  });

  test('Multiple agents and concepts work correctly', () => {
    const resonance = new ConsciousnessResonance();
    
    // Add concepts from multiple agents
    const agents = ['alice', 'bob', 'charlie'];
    const concepts = ['math', 'art', 'science'];
    
    agents.forEach((agent, i) => {
      concepts.forEach((concept, j) => {
        resonance.addConcept(agent, `${concept}-${i}`, {
          vector: Array.from({length: 5}, () => Math.random()),
          strength: 0.5 + Math.random() * 0.5,
          discovery: `${agent}'s insight about ${concept}`,
          timestamp: Date.now() + i * 1000 + j
        });
      });
    });
    
    // Verify all agents and concepts were stored
    assert.equal(resonance.conceptDatabase.size, 3, 'Should have all three agents');
    
    agents.forEach(agent => {
      assert.ok(resonance.conceptDatabase.has(agent), `Should have agent ${agent}`);
      assert.equal(resonance.conceptDatabase.get(agent).size, 3, `Agent ${agent} should have 3 concepts`);
    });
  });

  test('VillageCustomizer can be instantiated with mock scene', () => {
    const mockScene = {
      scene: new THREE.Group(),
      camera: {},
      raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
      getMouseNDC: () => ({ x: 0, y: 0 }),
      onSceneClick: () => {}
    };
    
    const customizer = new VillageCustomizer(mockScene);
    
    assert.equal(customizer.scene, mockScene, 'Should store scene reference');
    assert.ok(Array.isArray(customizer.buildingGroups), 'Should have building groups array');
    assert.ok(Array.isArray(customizer.colorPalette), 'Should have color palette');
    assert.equal(customizer.isEditMode, false, 'Should start in view mode');
  });

  test('VillageCustomizer creates buildings', () => {
    const mockScene = {
      scene: new THREE.Group(),
      camera: {},
      raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
      getMouseNDC: () => ({ x: 0, y: 0 }),
      onSceneClick: () => {}
    };
    
    const customizer = new VillageCustomizer(mockScene);
    
    assert.ok(customizer.buildingGroups.length > 0, 'Should create buildings');
    
    // Check first building has proper structure
    const building = customizer.buildingGroups[0];
    assert.ok(building.userData.buildingData, 'Building should have data');
    assert.ok(building.userData.buildingName, 'Building should have name');
    assert.ok(building.userData.buildingType, 'Building should have type');
  });

  test('Error handling for invalid inputs', () => {
    const resonance = new ConsciousnessResonance();
    
    // Should not throw on null/undefined inputs
    assert.doesNotThrow(() => {
      resonance.addConcept(null, 'test', {});
      resonance.addConcept('test', null, {});
      resonance.addConcept('test', 'test', null);
    }, 'Should handle null inputs gracefully');
    
    assert.doesNotThrow(() => {
      resonance.calculateCosineSimilarity([], []);
      resonance.calculateCosineSimilarity(null, [1, 2, 3]);
      resonance.calculateCosineSimilarity([1, 2], [1, 2, 3]); // Mismatched lengths
    }, 'Should handle invalid vectors gracefully');
  });

  test('Performance with moderate dataset', () => {
    const resonance = new ConsciousnessResonance();
    
    const startTime = Date.now();
    
    // Add 100 concepts across 10 agents
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        resonance.addConcept(`agent-${i}`, `concept-${j}`, {
          vector: Array.from({length: 5}, () => Math.random()),
          strength: Math.random(),
          discovery: `Performance test concept ${i}-${j}`,
          timestamp: Date.now()
        });
      }
    }
    
    const addTime = Date.now() - startTime;
    assert.ok(addTime < 1000, `Adding 100 concepts should be fast, took ${addTime}ms`);
    
    // Test resonance detection with this dataset
    const detectionStart = Date.now();
    const resonances = resonance.detectResonances('perf-agent', 'perf-concept', {
      vector: [0.5, 0.5, 0.5, 0.5, 0.5],
      strength: 0.8,
      discovery: 'Performance test detection',
      timestamp: Date.now()
    });
    
    const detectionTime = Date.now() - detectionStart;
    assert.ok(detectionTime < 100, `Resonance detection should be fast, took ${detectionTime}ms`);
    assert.ok(Array.isArray(resonances), 'Should return resonance array');
  });

  test('Memory usage with concept cleanup', () => {
    const resonance = new ConsciousnessResonance();
    
    // Add concepts
    for (let i = 0; i < 50; i++) {
      resonance.addConcept(`temp-agent-${i}`, `temp-concept`, {
        vector: Array.from({length: 10}, () => Math.random()),
        strength: Math.random(),
        discovery: `Temporary concept ${i}`,
        timestamp: Date.now()
      });
    }
    
    assert.equal(resonance.conceptDatabase.size, 50, 'Should have 50 agents');
    
    // Remove concepts (simulate cleanup)
    for (let i = 0; i < 25; i++) {
      resonance.conceptDatabase.delete(`temp-agent-${i}`);
    }
    
    assert.equal(resonance.conceptDatabase.size, 25, 'Should have 25 agents after cleanup');
  });
});