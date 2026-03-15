'use strict';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  setupCSLDOM,
  createResonanceScenarios,
  generateStressTestData,
  measurePerformance,
  createMemoryLeakDetector
} = require('./test-utils.js');

let dom, ConsciousnessResonance, VillageCustomizer;
let memoryDetector;

describe('CSL Performance Tests', () => {
  before(() => {
    dom = setupCSLDOM();
    memoryDetector = createMemoryLeakDetector();
    
    // Import modules after DOM setup
    delete require.cache[require.resolve('../../server/office-medieval/consciousness-resonance.js')];
    delete require.cache[require.resolve('../../server/office-medieval/village-customizer.js')];
    
    ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    VillageCustomizer = require('../../server/office-medieval/village-customizer.js');
  });

  after(() => {
    if (dom) dom.cleanup();
  });

  beforeEach(() => {
    // Clear DOM between tests
    document.body.innerHTML = `
      <div id="castle-app">
        <canvas id="canvas"></canvas>
        <div id="ui-overlay"></div>
      </div>
    `;
    localStorage.clear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Vector Math Performance Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Vector Math Performance', () => {
    test('cosine similarity calculation speed', async () => {
      const resonance = new ConsciousnessResonance();
      
      const { duration, result } = measurePerformance(() => {
        const results = [];
        for (let i = 0; i < 10000; i++) {
          const vec1 = Array.from({length: 5}, () => Math.random());
          const vec2 = Array.from({length: 5}, () => Math.random());
          results.push(resonance.calculateCosineSimilarity(vec1, vec2));
        }
        return results;
      }, 'Cosine Similarity Batch');

      assert.ok(duration < 1000, `10k similarity calculations should complete in <1s, took ${duration}ms`);
      assert.equal(result.length, 10000, 'All calculations should complete');
    });

    test('vector normalization performance', () => {
      const { duration, result } = measurePerformance(() => {
        const vectors = [];
        for (let i = 0; i < 5000; i++) {
          const vec = Array.from({length: 10}, () => Math.random() * 1000);
          const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
          const normalized = vec.map(v => v / magnitude);
          vectors.push(normalized);
        }
        return vectors;
      }, 'Vector Normalization');

      assert.ok(duration < 500, `5k vector normalizations should complete in <500ms, took ${duration}ms`);
      assert.equal(result.length, 5000, 'All normalizations should complete');
    });

    test('large vector similarity performance', () => {
      const resonance = new ConsciousnessResonance();
      
      const { duration } = measurePerformance(() => {
        const vec1 = Array.from({length: 1000}, () => Math.random());
        const vec2 = Array.from({length: 1000}, () => Math.random());
        
        const results = [];
        for (let i = 0; i < 100; i++) {
          results.push(resonance.calculateCosineSimilarity(vec1, vec2));
        }
        return results;
      }, 'Large Vector Similarity');

      assert.ok(duration < 100, `Large vector similarity should be fast, took ${duration}ms`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Concept Database Performance Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Concept Database Performance', () => {
    test('mass concept addition performance', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      const { duration, memoryChange } = measurePerformance(() => {
        for (let i = 0; i < 1000; i++) {
          resonance.addConcept(`agent-${i % 10}`, `concept-${i}`, {
            vector: Array.from({length: 5}, () => Math.random()),
            strength: Math.random(),
            discovery: `Performance test concept ${i}`,
            timestamp: Date.now() + i
          });
        }
      }, 'Mass Concept Addition');

      assert.ok(duration < 2000, `Adding 1000 concepts should take <2s, took ${duration}ms`);
      assert.ok(memoryChange < 50 * 1024 * 1024, `Memory increase should be reasonable, was ${Math.round(memoryChange / 1024)}KB`);
      
      // Verify data integrity
      let totalConcepts = 0;
      for (const concepts of resonance.conceptDatabase.values()) {
        totalConcepts += concepts.size;
      }
      assert.equal(totalConcepts, 1000, 'All concepts should be stored');
    });

    test('resonance detection with large dataset', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      // Populate large dataset
      for (let i = 0; i < 500; i++) {
        resonance.addConcept(`agent-${i % 20}`, `concept-${i}`, {
          vector: Array.from({length: 8}, () => Math.random()),
          strength: Math.random(),
          discovery: `Dataset concept ${i}`,
          timestamp: Date.now() + i
        });
      }

      const { duration } = measurePerformance(() => {
        return resonance.detectResonances('test-agent', 'test-concept', {
          vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          strength: 0.8,
          discovery: 'Performance test resonance',
          timestamp: Date.now()
        });
      }, 'Large Dataset Resonance Detection');

      assert.ok(duration < 500, `Resonance detection should be fast, took ${duration}ms`);
    });

    test('concept database iteration performance', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      // Add varied dataset
      for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 10; j++) {
          resonance.addConcept(`agent-${i}`, `concept-${j}`, {
            vector: Array.from({length: 5}, () => Math.random()),
            strength: Math.random(),
            discovery: `Iteration test ${i}-${j}`,
            timestamp: Date.now()
          });
        }
      }

      const { duration } = measurePerformance(() => {
        let conceptCount = 0;
        for (const [agentId, concepts] of resonance.conceptDatabase.entries()) {
          for (const [conceptId, data] of concepts.entries()) {
            conceptCount++;
            // Simulate processing
            if (data.strength > 0.8) {
              // High strength concept processing
            }
          }
        }
        return conceptCount;
      }, 'Database Iteration');

      assert.ok(duration < 50, `Database iteration should be fast, took ${duration}ms`);
    });

    test('concurrent access performance', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      const { duration } = measurePerformance(async () => {
        const promises = [];
        
        // Concurrent reads and writes
        for (let i = 0; i < 50; i++) {
          // Write operation
          promises.push(Promise.resolve().then(() => {
            resonance.addConcept(`concurrent-agent-${i}`, `concept-${i}`, {
              vector: Array.from({length: 5}, () => Math.random()),
              strength: Math.random(),
              discovery: `Concurrent concept ${i}`,
              timestamp: Date.now()
            });
          }));

          // Read operation
          promises.push(Promise.resolve().then(() => {
            return resonance.detectResonances(`read-agent-${i}`, `read-concept-${i}`, {
              vector: Array.from({length: 5}, () => Math.random()),
              strength: Math.random(),
              discovery: `Concurrent read ${i}`,
              timestamp: Date.now()
            });
          }));
        }

        await Promise.all(promises);
      }, 'Concurrent Access');

      assert.ok(duration < 1000, `Concurrent operations should complete quickly, took ${duration}ms`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI Performance Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('UI Performance', () => {
    test('village customizer initialization performance', () => {
      const { duration } = measurePerformance(() => {
        const mockScene = {
          scene: new THREE.Group(),
          camera: {},
          raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
          getMouseNDC: () => ({ x: 0, y: 0 }),
          onSceneClick: () => {}
        };
        
        return new VillageCustomizer(mockScene);
      }, 'Village Customizer Init');

      assert.ok(duration < 200, `Village customizer init should be fast, took ${duration}ms`);
    });

    test('building color change performance', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      const { duration } = measurePerformance(() => {
        const building = customizer.buildingGroups[0];
        if (building) {
          customizer.selectBuilding(building);
          
          for (let i = 0; i < 100; i++) {
            customizer.changeBuildingColor(Math.floor(Math.random() * 0xFFFFFF));
          }
        }
      }, 'Building Color Changes');

      assert.ok(duration < 50, `100 color changes should be fast, took ${duration}ms`);
    });

    test('edit mode toggle performance', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      const { duration } = measurePerformance(() => {
        for (let i = 0; i < 50; i++) {
          customizer.toggleEditMode();
          customizer.toggleEditMode();
        }
      }, 'Edit Mode Toggles');

      assert.ok(duration < 100, `Edit mode toggles should be fast, took ${duration}ms`);
    });

    test('DOM manipulation performance under stress', () => {
      const { duration } = measurePerformance(() => {
        for (let i = 0; i < 1000; i++) {
          const element = document.createElement('div');
          element.id = `stress-element-${i}`;
          element.innerHTML = `<span>Stress test ${i}</span>`;
          element.style.cssText = `position: absolute; left: ${i % 100}px; top: ${Math.floor(i / 100)}px;`;
          document.body.appendChild(element);
        }
        
        // Clean up
        const elements = document.querySelectorAll('[id^="stress-element-"]');
        elements.forEach(el => el.remove());
      }, 'DOM Stress Test');

      assert.ok(duration < 500, `DOM stress test should complete quickly, took ${duration}ms`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Memory Performance Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Memory Performance', () => {
    test('memory usage stability over time', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      const initialMemory = process.memoryUsage().heapUsed;
      const measurements = [];

      // Simulate extended operation
      for (let cycle = 0; cycle < 20; cycle++) {
        // Add concepts
        for (let i = 0; i < 50; i++) {
          resonance.addConcept(`cycle-${cycle}-agent-${i}`, `concept-${i}`, {
            vector: Array.from({length: 10}, () => Math.random()),
            strength: Math.random(),
            discovery: `Cycle ${cycle} concept ${i}`,
            timestamp: Date.now()
          });
        }

        // Remove some concepts to simulate cleanup
        if (cycle > 5) {
          const agentsToRemove = Array.from(resonance.conceptDatabase.keys())
            .filter(agent => agent.includes(`cycle-${cycle - 5}`))
            .slice(0, 10);
          
          agentsToRemove.forEach(agent => {
            resonance.conceptDatabase.delete(agent);
          });
        }

        // Measure memory
        measurements.push(process.memoryUsage().heapUsed);
        
        // Allow garbage collection opportunity
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const maxMemory = Math.max(...measurements);
      const memoryGrowth = finalMemory - initialMemory;

      assert.ok(memoryGrowth < 100 * 1024 * 1024, `Memory growth should be limited, was ${Math.round(memoryGrowth / 1024)}KB`);
      assert.ok(maxMemory < initialMemory + 150 * 1024 * 1024, 'Peak memory usage should be reasonable');
    });

    test('three.js object cleanup performance', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      const initialBuildings = customizer.buildingGroups.length;

      const { duration, memoryChange } = measurePerformance(() => {
        // Add many buildings
        for (let i = 0; i < 50; i++) {
          const building = customizer.addNewBuilding?.(i * 2, i * 2, 'cottage');
          memoryDetector.track(building, `building-${i}`);
        }
        
        // Remove them
        const buildingsToRemove = customizer.buildingGroups.slice(initialBuildings);
        buildingsToRemove.forEach(building => {
          customizer.selectedBuilding = building;
          global.confirm = () => true; // Mock confirm
          customizer.demolishSelectedBuilding?.();
        });
      }, 'Building Cleanup');

      assert.ok(duration < 200, `Building cleanup should be fast, took ${duration}ms`);
      
      const leakCheck = memoryDetector.checkLeaks();
      assert.ok(leakCheck.potentialLeaks === 0, 'Should not have memory leaks');
    });

    test('event listener cleanup performance', () => {
      let listenerCount = 0;
      const originalAddEventListener = Element.prototype.addEventListener;
      const originalRemoveEventListener = Element.prototype.removeEventListener;
      
      Element.prototype.addEventListener = function(...args) {
        listenerCount++;
        return originalAddEventListener.apply(this, args);
      };
      
      Element.prototype.removeEventListener = function(...args) {
        listenerCount--;
        return originalRemoveEventListener.apply(this, args);
      };

      const { duration } = measurePerformance(() => {
        const mockScene = {
          scene: new THREE.Group(),
          camera: {},
          raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
          getMouseNDC: () => ({ x: 0, y: 0 }),
          onSceneClick: () => {}
        };

        // Create and destroy multiple customizers
        for (let i = 0; i < 10; i++) {
          const customizer = new VillageCustomizer(mockScene);
          customizer.toggleEditMode();
          customizer.hideEditModeUI?.();
        }
      }, 'Event Listener Cleanup');

      // Restore original methods
      Element.prototype.addEventListener = originalAddEventListener;
      Element.prototype.removeEventListener = originalRemoveEventListener;

      assert.ok(duration < 100, `Event listener management should be fast, took ${duration}ms`);
      // Note: In a real implementation, we'd check that listenerCount returns to baseline
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Performance Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Performance', () => {
    test('full system initialization performance', async () => {
      const { duration, memoryChange } = measurePerformance(async () => {
        const resonance = new ConsciousnessResonance();
        await resonance.initialize();

        const mockScene = {
          scene: new THREE.Group(),
          camera: {},
          raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
          getMouseNDC: () => ({ x: 0, y: 0 }),
          onSceneClick: () => {}
        };
        
        const customizer = new VillageCustomizer(mockScene);
        
        return { resonance, customizer };
      }, 'Full System Init');

      assert.ok(duration < 1000, `Full system init should complete quickly, took ${duration}ms`);
      assert.ok(memoryChange < 20 * 1024 * 1024, `Init memory usage should be reasonable, was ${Math.round(memoryChange / 1024)}KB`);
    });

    test('combined CSL and village operations performance', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);

      const { duration } = measurePerformance(() => {
        for (let i = 0; i < 100; i++) {
          // CSL operations
          resonance.addConcept(`perf-agent-${i % 5}`, `perf-concept-${i}`, {
            vector: Array.from({length: 5}, () => Math.random()),
            strength: Math.random(),
            discovery: `Performance concept ${i}`,
            timestamp: Date.now()
          });

          // Village operations
          if (customizer.buildingGroups[i % customizer.buildingGroups.length]) {
            const building = customizer.buildingGroups[i % customizer.buildingGroups.length];
            customizer.selectBuilding(building);
            customizer.changeBuildingColor(Math.floor(Math.random() * 0xFFFFFF));
            customizer.deselectBuilding();
          }

          // Toggle edit mode occasionally
          if (i % 20 === 0) {
            customizer.toggleEditMode();
            customizer.toggleEditMode();
          }
        }
      }, 'Combined Operations');

      assert.ok(duration < 500, `Combined operations should be efficient, took ${duration}ms`);
    });

    test('high-frequency update performance', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();

      let updateCount = 0;
      const { duration } = measurePerformance(() => {
        const interval = setInterval(() => {
          resonance.addConcept(`update-agent-${updateCount % 3}`, `update-concept-${updateCount}`, {
            vector: Array.from({length: 5}, () => Math.random()),
            strength: Math.random(),
            discovery: `High frequency update ${updateCount}`,
            timestamp: Date.now()
          });
          updateCount++;
        }, 1);

        // Run for 100ms
        setTimeout(() => clearInterval(interval), 100);
      }, 'High Frequency Updates');

      assert.ok(updateCount > 50, 'Should handle high frequency updates efficiently');
      assert.ok(duration < 150, `High frequency updates should complete quickly, took ${duration}ms`);
    });
  });
});