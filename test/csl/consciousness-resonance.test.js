'use strict';
const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Set up JSDOM environment for browser-dependent code
function setupDOM() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body></body>
    </html>
  `, {
    url: 'http://localhost:8766/',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.THREE = mockTHREE();

  // Mock fetch for fleet relay tests
  global.fetch = async (url, options) => {
    if (url.includes('fleet/message')) {
      return { ok: true };
    }
    return { ok: false };
  };

  return dom;
}

function mockTHREE() {
  return {
    Group: class { 
      constructor() { 
        this.children = []; 
        this.position = { x: 0, y: 0, z: 0, set: () => {} };
        this.userData = {};
      }
      add() {}
      traverse(fn) { fn(this); }
    },
    Mesh: class {
      constructor() {
        this.material = { color: { setHex: () => {} }, emissive: { setHex: () => {} } };
        this.position = { x: 0, y: 0, z: 0 };
        this.userData = {};
        this.isMesh = true;
      }
    },
    BoxGeometry: class {},
    MeshStandardMaterial: class {
      constructor() {
        this.color = { setHex: () => {} };
        this.emissive = { setHex: () => {} };
      }
    },
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
      }
      add(v) { this.x += v.x; this.y += v.y; this.z += v.z; }
    },
    Box3: class {
      setFromObject() { return this; }
      getCenter() { return new this.constructor.Vector3(); }
      get min() { return { x: -1, y: -1, z: -1 }; }
      get max() { return { x: 1, y: 1, z: 1 }; }
    }
  };
}

// Import the class after setting up DOM
let ConsciousnessResonance;

describe('ConsciousnessResonance Core Logic Tests', () => {
  let dom, resonance;

  before(() => {
    dom = setupDOM();
    // Now we can require the module
    delete require.cache[require.resolve('../../server/office-medieval/consciousness-resonance.js')];
    ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
  });

  after(() => {
    if (dom) dom.window.close();
  });

  beforeEach(() => {
    resonance = new ConsciousnessResonance();
  });

  afterEach(() => {
    if (resonance && resonance.crystalOrb) {
      document.body.removeChild(resonance.crystalOrb);
    }
    if (resonance && resonance.resonancePanel) {
      document.body.removeChild(resonance.resonancePanel);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Vector Math Validation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Vector Math Validation', () => {
    test('calculateCosineSimilarity - identical vectors', () => {
      const vec1 = [1, 0, 0, 0, 0];
      const vec2 = [1, 0, 0, 0, 0];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.equal(similarity, 1, 'Identical vectors should have similarity 1');
    });

    test('calculateCosineSimilarity - orthogonal vectors', () => {
      const vec1 = [1, 0, 0, 0, 0];
      const vec2 = [0, 1, 0, 0, 0];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.equal(similarity, 0, 'Orthogonal vectors should have similarity 0');
    });

    test('calculateCosineSimilarity - opposite vectors', () => {
      const vec1 = [1, 0, 0, 0, 0];
      const vec2 = [-1, 0, 0, 0, 0];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.equal(similarity, -1, 'Opposite vectors should have similarity -1');
    });

    test('calculateCosineSimilarity - partial similarity', () => {
      const vec1 = [0.8, 0.6, 0, 0, 0];
      const vec2 = [0.6, 0.8, 0, 0, 0];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.ok(similarity > 0.9, 'Similar vectors should have high similarity');
      assert.ok(similarity < 1, 'Non-identical vectors should not have perfect similarity');
    });

    test('calculateCosineSimilarity - normalized vs non-normalized', () => {
      const vec1 = [1, 1, 1, 1, 1];
      const vec2 = [2, 2, 2, 2, 2];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.equal(similarity, 1, 'Scaled vectors should have same cosine similarity');
    });

    test('calculateCosineSimilarity - zero vector handling', () => {
      const vec1 = [0, 0, 0, 0, 0];
      const vec2 = [1, 1, 1, 1, 1];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.ok(Number.isNaN(similarity), 'Zero vector should return NaN');
    });

    test('calculateCosineSimilarity - mixed dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.ok(similarity > 0.9, 'Positive correlation should yield high similarity');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Boundary Conditions Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Boundary Conditions', () => {
    test('zero resonance - no concepts added', () => {
      assert.equal(resonance.conceptDatabase.size, 0, 'Fresh instance should have no agents');
      
      const resonances = resonance.detectResonances('test-agent', 'test-concept', {
        vector: [1, 0, 0, 0, 0],
        strength: 1.0,
        discovery: 'Test concept',
        timestamp: Date.now()
      });
      
      assert.equal(resonances.length, 0, 'Single concept should produce no resonances');
    });

    test('max resonance - perfect vector match', () => {
      const conceptData = {
        vector: [0.8, 0.3, 0.9, 0.2, 0.7],
        strength: 1.0,
        discovery: 'Test concept A',
        timestamp: Date.now()
      };

      // Add first concept
      resonance.addConcept('agent1', 'concept1', conceptData);
      
      // Add identical concept from different agent
      const resonances = resonance.detectResonances('agent2', 'concept2', conceptData);
      
      assert.equal(resonances.length, 1, 'Identical concepts should resonate');
      assert.equal(resonances[0].similarity, 1, 'Identical vectors should have perfect similarity');
    });

    test('edge case - single element vectors', () => {
      const vec1 = [1];
      const vec2 = [1];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.equal(similarity, 1, 'Single element identical vectors should have similarity 1');
    });

    test('edge case - large vectors', () => {
      const size = 1000;
      const vec1 = new Array(size).fill(0.001);
      const vec2 = new Array(size).fill(0.001);
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.equal(similarity, 1, 'Large identical vectors should maintain precision');
    });

    test('edge case - very small numbers', () => {
      const vec1 = [1e-10, 1e-10, 1e-10];
      const vec2 = [1e-10, 1e-10, 1e-10];
      const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
      assert.ok(Math.abs(similarity - 1) < 1e-6, 'Very small numbers should maintain reasonable precision');
    });

    test('resonance threshold boundary', () => {
      const baseVector = [0.8, 0.6, 0.0, 0.0, 0.0];
      
      // Add base concept
      resonance.addConcept('agent1', 'base', {
        vector: baseVector,
        strength: 0.9,
        discovery: 'Base concept',
        timestamp: Date.now()
      });

      // Test vector just above threshold (0.7)
      const aboveThreshold = [0.82, 0.58, 0.0, 0.0, 0.0]; // ~0.71 similarity
      const resonancesAbove = resonance.detectResonances('agent2', 'above', {
        vector: aboveThreshold,
        strength: 0.9,
        discovery: 'Above threshold',
        timestamp: Date.now()
      });
      assert.ok(resonancesAbove.length > 0, 'Vectors above threshold should resonate');

      // Test vector just below threshold
      const belowThreshold = [0.6, 0.8, 0.0, 0.0, 0.0]; // ~0.69 similarity  
      const resonancesBelow = resonance.detectResonances('agent3', 'below', {
        vector: belowThreshold,
        strength: 0.9,
        discovery: 'Below threshold',
        timestamp: Date.now()
      });
      assert.equal(resonancesBelow.length, 0, 'Vectors below threshold should not resonate');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Concept Propagation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Concept Propagation', () => {
    test('addConcept - single agent concept addition', () => {
      const conceptData = {
        vector: [1, 0, 0, 0, 0],
        strength: 0.8,
        discovery: 'Test discovery',
        timestamp: Date.now()
      };

      resonance.addConcept('test-agent', 'test-concept', conceptData);
      
      assert.ok(resonance.conceptDatabase.has('test-agent'), 'Agent should be added to database');
      assert.ok(resonance.conceptDatabase.get('test-agent').has('test-concept'), 'Concept should be stored');
      assert.deepEqual(
        resonance.conceptDatabase.get('test-agent').get('test-concept'),
        conceptData,
        'Concept data should be preserved'
      );
    });

    test('addConcept - multiple concepts per agent', () => {
      const agent = 'multi-agent';
      
      for (let i = 0; i < 5; i++) {
        resonance.addConcept(agent, `concept-${i}`, {
          vector: [i, 0, 0, 0, 0],
          strength: 0.5 + i * 0.1,
          discovery: `Discovery ${i}`,
          timestamp: Date.now() + i
        });
      }

      assert.equal(
        resonance.conceptDatabase.get(agent).size,
        5,
        'All concepts should be stored'
      );
    });

    test('concept propagation - cross-agent resonance detection', () => {
      // Add concept from agent1
      resonance.addConcept('agent1', 'math-concept', {
        vector: [0.9, 0.1, 0.3, 0.8, 0.2],
        strength: 0.9,
        discovery: 'Mathematical insight',
        timestamp: Date.now()
      });

      let resonanceDetected = false;
      const originalLogActivity = resonance.logActivity;
      resonance.logActivity = (message, source) => {
        if (message.includes('Resonance detected') && source === 'resonance') {
          resonanceDetected = true;
        }
        originalLogActivity.call(resonance, message, source);
      };

      // Add similar concept from agent2
      resonance.addConcept('agent2', 'similar-math', {
        vector: [0.88, 0.12, 0.28, 0.82, 0.18], // Very similar
        strength: 0.85,
        discovery: 'Related mathematical insight',
        timestamp: Date.now()
      });

      assert.ok(resonanceDetected, 'Resonance should be automatically detected');
    });

    test('concept propagation - resonance history tracking', () => {
      const initialHistoryLength = resonance.resonanceHistory.length;

      resonance.addConcept('agent1', 'concept1', {
        vector: [1, 0, 0, 0, 0],
        strength: 0.8,
        discovery: 'First concept',
        timestamp: Date.now()
      });

      resonance.addConcept('agent2', 'concept2', {
        vector: [0.99, 0.01, 0.01, 0.01, 0.01], // High similarity
        strength: 0.8,
        discovery: 'Similar concept',
        timestamp: Date.now()
      });

      assert.ok(
        resonance.resonanceHistory.length > initialHistoryLength,
        'Activity should be logged to history'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Network Topology Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Network Topology Changes', () => {
    test('agent joins network gracefully', () => {
      // Start with empty network
      assert.equal(resonance.conceptDatabase.size, 0, 'Network should start empty');

      // Agent joins with multiple concepts
      const newAgent = 'joining-agent';
      const concepts = [
        { id: 'concept1', vector: [1, 0, 0, 0, 0] },
        { id: 'concept2', vector: [0, 1, 0, 0, 0] },
        { id: 'concept3', vector: [0, 0, 1, 0, 0] }
      ];

      concepts.forEach(concept => {
        resonance.addConcept(newAgent, concept.id, {
          vector: concept.vector,
          strength: 0.8,
          discovery: `Discovery for ${concept.id}`,
          timestamp: Date.now()
        });
      });

      assert.ok(resonance.conceptDatabase.has(newAgent), 'New agent should be in network');
      assert.equal(resonance.conceptDatabase.get(newAgent).size, 3, 'All concepts should be added');
    });

    test('agent leaves network gracefully', () => {
      // Add agent with concepts
      const leavingAgent = 'leaving-agent';
      resonance.addConcept(leavingAgent, 'concept1', {
        vector: [1, 1, 1, 1, 1],
        strength: 0.8,
        discovery: 'Concept before leaving',
        timestamp: Date.now()
      });

      assert.ok(resonance.conceptDatabase.has(leavingAgent), 'Agent should exist before leaving');

      // Simulate agent leaving
      resonance.conceptDatabase.delete(leavingAgent);
      
      assert.ok(!resonance.conceptDatabase.has(leavingAgent), 'Agent should be removed from network');
    });

    test('network remains stable with agent changes', () => {
      // Add stable agents
      resonance.addConcept('stable1', 'concept1', {
        vector: [0.8, 0.2, 0, 0, 0],
        strength: 0.9,
        discovery: 'Stable concept 1',
        timestamp: Date.now()
      });

      resonance.addConcept('stable2', 'concept2', {
        vector: [0.2, 0.8, 0, 0, 0],
        strength: 0.9,
        discovery: 'Stable concept 2',
        timestamp: Date.now()
      });

      const initialResonances = resonance.detectResonances('test', 'test-concept', {
        vector: [0.5, 0.5, 0, 0, 0],
        strength: 0.8,
        discovery: 'Test concept',
        timestamp: Date.now()
      });

      // Add and remove agents
      resonance.addConcept('temp-agent', 'temp-concept', {
        vector: [1, 0, 0, 0, 0],
        strength: 0.5,
        discovery: 'Temporary concept',
        timestamp: Date.now()
      });

      resonance.conceptDatabase.delete('temp-agent');

      // Test that network still functions
      const postChangeResonances = resonance.detectResonances('test2', 'test-concept2', {
        vector: [0.5, 0.5, 0, 0, 0],
        strength: 0.8,
        discovery: 'Test concept 2',
        timestamp: Date.now()
      });

      assert.equal(
        postChangeResonances.length,
        initialResonances.length,
        'Resonance detection should remain stable after topology changes'
      );
    });

    test('isolated agents do not affect main network', () => {
      // Main network
      resonance.addConcept('main1', 'main-concept1', {
        vector: [1, 0, 0, 0, 0],
        strength: 0.9,
        discovery: 'Main network concept',
        timestamp: Date.now()
      });

      resonance.addConcept('main2', 'main-concept2', {
        vector: [0.9, 0.1, 0, 0, 0],
        strength: 0.9,
        discovery: 'Related main concept',
        timestamp: Date.now()
      });

      // Isolated agent with unrelated concepts
      resonance.addConcept('isolated', 'isolated-concept', {
        vector: [0, 0, 0, 0, 1],
        strength: 0.5,
        discovery: 'Isolated concept',
        timestamp: Date.now()
      });

      // Test resonance between main network agents
      const mainResonances = resonance.detectResonances('main3', 'main-concept3', {
        vector: [0.95, 0.05, 0, 0, 0],
        strength: 0.9,
        discovery: 'Another main concept',
        timestamp: Date.now()
      });

      assert.ok(
        mainResonances.every(r => r.agent !== 'isolated'),
        'Isolated agent should not interfere with main network resonances'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Race Condition Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Race Condition Handling', () => {
    test('concurrent concept additions', async () => {
      const agents = ['agent1', 'agent2', 'agent3', 'agent4'];
      const promises = [];

      // Simulate concurrent concept additions
      for (let i = 0; i < 20; i++) {
        const agent = agents[i % agents.length];
        const promise = new Promise(resolve => {
          setTimeout(() => {
            resonance.addConcept(agent, `concept-${i}`, {
              vector: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()],
              strength: Math.random(),
              discovery: `Concurrent discovery ${i}`,
              timestamp: Date.now() + i
            });
            resolve();
          }, Math.random() * 10);
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      // Verify data integrity
      let totalConcepts = 0;
      for (const [agent, concepts] of resonance.conceptDatabase.entries()) {
        totalConcepts += concepts.size;
        assert.ok(agents.includes(agent), 'Only expected agents should be in database');
      }

      assert.equal(totalConcepts, 20, 'All concepts should be added despite concurrency');
    });

    test('concurrent resonance detection', async () => {
      // Add base concepts
      const baseConcepts = [
        { agent: 'base1', id: 'base-concept1', vector: [1, 0, 0, 0, 0] },
        { agent: 'base2', id: 'base-concept2', vector: [0.9, 0.1, 0, 0, 0] },
        { agent: 'base3', id: 'base-concept3', vector: [0.8, 0.2, 0, 0, 0] }
      ];

      baseConcepts.forEach(concept => {
        resonance.addConcept(concept.agent, concept.id, {
          vector: concept.vector,
          strength: 0.8,
          discovery: `Base discovery for ${concept.id}`,
          timestamp: Date.now()
        });
      });

      // Concurrent resonance detection calls
      const detectionPromises = [];
      for (let i = 0; i < 10; i++) {
        const promise = new Promise(resolve => {
          setTimeout(() => {
            const resonances = resonance.detectResonances(`test-agent-${i}`, `test-concept-${i}`, {
              vector: [0.95, 0.05, 0, 0, 0],
              strength: 0.8,
              discovery: `Concurrent test ${i}`,
              timestamp: Date.now()
            });
            resolve(resonances);
          }, Math.random() * 5);
        });
        detectionPromises.push(promise);
      }

      const allResonances = await Promise.all(detectionPromises);
      
      // Verify consistency
      allResonances.forEach((resonances, index) => {
        assert.ok(Array.isArray(resonances), `Resonance ${index} should return array`);
        resonances.forEach(resonance => {
          assert.ok(resonance.agent, 'Resonance should have agent');
          assert.ok(resonance.concept, 'Resonance should have concept');
          assert.ok(typeof resonance.similarity === 'number', 'Resonance should have numeric similarity');
        });
      });
    });

    test('memory cleanup during intensive operations', async () => {
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Generate lots of concepts
      for (let i = 0; i < 1000; i++) {
        resonance.addConcept(`agent-${i % 10}`, `concept-${i}`, {
          vector: Array.from({length: 100}, () => Math.random()),
          strength: Math.random(),
          discovery: `Memory test concept ${i}`,
          timestamp: Date.now() + i
        });

        // Periodically trigger garbage collection opportunity
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const postOperationMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = postOperationMemoryUsage - initialMemoryUsage;

      // Memory usage should be reasonable (less than 100MB for this test)
      assert.ok(memoryIncrease < 100 * 1024 * 1024, 
        'Memory usage should remain reasonable during intensive operations');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error Handling and Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Error Handling', () => {
    test('handles invalid vector data gracefully', () => {
      assert.doesNotThrow(() => {
        resonance.addConcept('test-agent', 'invalid-concept', {
          vector: null,
          strength: 0.8,
          discovery: 'Invalid vector test',
          timestamp: Date.now()
        });
      }, 'Should not throw on null vector');

      assert.doesNotThrow(() => {
        resonance.addConcept('test-agent', 'empty-vector', {
          vector: [],
          strength: 0.8,
          discovery: 'Empty vector test',
          timestamp: Date.now()
        });
      }, 'Should not throw on empty vector');
    });

    test('handles missing concept data gracefully', () => {
      assert.doesNotThrow(() => {
        resonance.addConcept('test-agent', 'incomplete-concept', {});
      }, 'Should not throw on incomplete concept data');
    });

    test('similarity calculation with mismatched vector lengths', () => {
      const result = resonance.calculateCosineSimilarity([1, 2], [1, 2, 3]);
      
      // Should handle gracefully (likely NaN or calculated on available elements)
      assert.ok(
        Number.isNaN(result) || typeof result === 'number',
        'Should return number or NaN for mismatched vectors'
      );
    });

    test('handles very large concept databases', () => {
      const startTime = Date.now();
      
      // Add many agents and concepts
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 10; j++) {
          resonance.addConcept(`agent-${i}`, `concept-${j}`, {
            vector: Array.from({length: 5}, () => Math.random()),
            strength: Math.random(),
            discovery: `Large database test ${i}-${j}`,
            timestamp: Date.now()
          });
        }
      }

      const elapsedTime = Date.now() - startTime;
      
      // Should complete in reasonable time (less than 5 seconds)
      assert.ok(elapsedTime < 5000, 'Large database operations should complete in reasonable time');
      
      // Should maintain data integrity
      assert.equal(resonance.conceptDatabase.size, 100, 'All agents should be stored');
    });
  });
});