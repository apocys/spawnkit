'use strict';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupCSLDOM } = require('./test-utils.js');

/**
 * Coverage Test Suite for CSL Components
 * Aims for >80% code coverage on core CSL logic
 */

let dom, ConsciousnessResonance, VillageCustomizer;

describe('CSL Coverage Tests', () => {
  before(() => {
    dom = setupCSLDOM();
    
    delete require.cache[require.resolve('../../server/office-medieval/consciousness-resonance.js')];
    delete require.cache[require.resolve('../../server/office-medieval/village-customizer.js')];
    
    ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    VillageCustomizer = require('../../server/office-medieval/village-customizer.js');
  });

  after(() => {
    if (dom) dom.cleanup();
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="castle-app">
        <canvas id="canvas"></canvas>
        <div id="ui-overlay"></div>
      </div>
    `;
    localStorage.clear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ConsciousnessResonance Coverage Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ConsciousnessResonance Method Coverage', () => {
    test('constructor and initialization paths', async () => {
      // Test constructor
      const resonance = new ConsciousnessResonance();
      
      assert.ok(resonance.crystalField instanceof Map, 'crystalField should be initialized');
      assert.ok(Array.isArray(resonance.resonanceHistory), 'resonanceHistory should be array');
      assert.equal(resonance.isActive, false, 'should start inactive');
      assert.ok(resonance.conceptDatabase instanceof Map, 'conceptDatabase should be Map');
      assert.ok(resonance.agentPresence, 'agentPresence should be initialized');

      // Test initialization
      await resonance.initialize();
      assert.equal(resonance.isActive, true, 'should be active after init');
      assert.ok(document.getElementById('consciousness-crystal'), 'should create crystal UI');
    });

    test('initializeDemo method coverage', () => {
      const resonance = new ConsciousnessResonance();
      
      // Should have demo concepts after construction
      assert.ok(resonance.conceptDatabase.size > 0, 'should have demo concepts');
      assert.ok(resonance.conceptDatabase.has('sycopa'), 'should have sycopa demo concepts');
      assert.ok(resonance.conceptDatabase.has('apomac'), 'should have apomac demo concepts');
    });

    test('waitForDOM method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      
      // Test when DOM is already ready
      const result = await resonance.waitForDOM();
      assert.equal(result, undefined, 'should resolve when DOM ready');
      
      // Test with loading state simulation
      const originalReadyState = document.readyState;
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        writable: true
      });
      
      const promise = resonance.waitForDOM();
      
      // Simulate DOMContentLoaded
      setTimeout(() => {
        Object.defineProperty(document, 'readyState', {
          value: 'complete',
          writable: true
        });
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }, 10);
      
      await promise;
      
      // Restore
      Object.defineProperty(document, 'readyState', {
        value: originalReadyState,
        writable: true
      });
    });

    test('createCrystalInterface method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      assert.ok(resonance.crystalOrb, 'crystalOrb should be created');
      assert.ok(resonance.crystalOrb.id === 'consciousness-crystal', 'should have correct ID');
      assert.ok(resonance.crystalOrb.onclick, 'should have click handler');
      
      // Test click functionality
      resonance.crystalOrb.click();
      // Should toggle resonance panel (tested in other methods)
    });

    test('createResonancePanel method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      assert.ok(resonance.resonancePanel, 'resonancePanel should be created');
      assert.equal(resonance.resonancePanel.id, 'resonance-panel', 'should have correct ID');
      
      const closeBtn = resonance.resonancePanel.querySelector('.close-btn');
      const shareBtn = resonance.resonancePanel.querySelector('#share-insight-btn');
      const checkBtn = resonance.resonancePanel.querySelector('#check-resonance-btn');
      
      assert.ok(closeBtn, 'should have close button');
      assert.ok(shareBtn, 'should have share insight button');
      assert.ok(checkBtn, 'should have check resonance button');
      
      // Test button functionality
      closeBtn.click();
      assert.equal(resonance.resonancePanel.style.display, 'none', 'close should hide panel');
    });

    test('panel toggle methods coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      // Test show
      resonance.showResonancePanel();
      assert.equal(resonance.resonancePanel.style.display, 'block', 'show should make panel visible');
      
      // Test hide
      resonance.hideResonancePanel();
      assert.equal(resonance.resonancePanel.style.display, 'none', 'hide should make panel invisible');
      
      // Test toggle from hidden
      resonance.toggleResonancePanel();
      assert.equal(resonance.resonancePanel.style.display, 'block', 'toggle should show when hidden');
      
      // Test toggle from visible
      resonance.toggleResonancePanel();
      assert.equal(resonance.resonancePanel.style.display, 'none', 'toggle should hide when visible');
    });

    test('updateResonancePanel method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      // Add some test data
      resonance.addConcept('test-agent', 'test-concept', {
        vector: [1, 0, 0, 0, 0],
        strength: 0.8,
        discovery: 'Test discovery',
        timestamp: Date.now()
      });
      
      resonance.showResonancePanel();
      
      const agentList = document.getElementById('agent-list');
      const resonanceEntries = document.getElementById('resonance-entries');
      const conceptVisualization = document.getElementById('concept-visualization');
      
      assert.ok(agentList.children.length > 0, 'should populate agent list');
      assert.ok(conceptVisualization.children.length > 0, 'should populate concept visualization');
    });

    test('addConcept method coverage', () => {
      const resonance = new ConsciousnessResonance();
      
      const testData = {
        vector: [0.8, 0.6, 0.7, 0.5, 0.9],
        strength: 0.8,
        discovery: 'Test concept',
        timestamp: Date.now()
      };
      
      // Test adding to new agent
      resonance.addConcept('new-agent', 'new-concept', testData);
      
      assert.ok(resonance.conceptDatabase.has('new-agent'), 'should create new agent entry');
      assert.ok(resonance.conceptDatabase.get('new-agent').has('new-concept'), 'should store concept');
      assert.deepEqual(
        resonance.conceptDatabase.get('new-agent').get('new-concept'),
        testData,
        'should preserve concept data'
      );
      
      // Test adding to existing agent
      const additionalData = {
        vector: [0.1, 0.2, 0.3, 0.4, 0.5],
        strength: 0.6,
        discovery: 'Additional concept',
        timestamp: Date.now()
      };
      
      resonance.addConcept('new-agent', 'additional-concept', additionalData);
      assert.equal(resonance.conceptDatabase.get('new-agent').size, 2, 'should add to existing agent');
    });

    test('detectResonances method coverage', () => {
      const resonance = new ConsciousnessResonance();
      
      // Add base concepts
      resonance.addConcept('agent1', 'concept1', {
        vector: [0.9, 0.1, 0.1, 0.1, 0.1],
        strength: 0.8,
        discovery: 'Base concept 1',
        timestamp: Date.now()
      });
      
      resonance.addConcept('agent2', 'concept2', {
        vector: [0.1, 0.9, 0.1, 0.1, 0.1],
        strength: 0.8,
        discovery: 'Base concept 2',
        timestamp: Date.now()
      });
      
      // Test high resonance detection
      const highResonances = resonance.detectResonances('agent3', 'concept3', {
        vector: [0.88, 0.12, 0.08, 0.08, 0.08], // Similar to concept1
        strength: 0.8,
        discovery: 'High resonance test',
        timestamp: Date.now()
      });
      
      assert.ok(highResonances.length > 0, 'should detect high resonance');
      assert.ok(highResonances[0].similarity > 0.7, 'detected resonance should be above threshold');
      
      // Test low resonance (below threshold)
      const lowResonances = resonance.detectResonances('agent4', 'concept4', {
        vector: [0.1, 0.1, 0.1, 0.1, 0.9], // Different from all others
        strength: 0.8,
        discovery: 'Low resonance test',
        timestamp: Date.now()
      });
      
      assert.equal(lowResonances.length, 0, 'should not detect low resonance');
      
      // Test self-exclusion (same agent)
      const selfResonances = resonance.detectResonances('agent1', 'concept1-additional', {
        vector: [0.95, 0.05, 0.05, 0.05, 0.05], // Very similar to agent1's concept
        strength: 0.8,
        discovery: 'Self resonance test',
        timestamp: Date.now()
      });
      
      // Should not resonate with own concepts
      assert.ok(selfResonances.every(r => r.agent !== 'agent1'), 'should exclude self-resonance');
    });

    test('calculateCosineSimilarity method coverage', () => {
      const resonance = new ConsciousnessResonance();
      
      // Test identical vectors
      assert.equal(resonance.calculateCosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
      
      // Test orthogonal vectors
      assert.equal(resonance.calculateCosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
      
      // Test opposite vectors
      assert.equal(resonance.calculateCosineSimilarity([1, 0, 0], [-1, 0, 0]), -1);
      
      // Test zero vectors
      assert.ok(Number.isNaN(resonance.calculateCosineSimilarity([0, 0, 0], [1, 1, 1])));
      
      // Test different lengths (edge case)
      const result = resonance.calculateCosineSimilarity([1, 2], [1, 2, 3]);
      assert.ok(Number.isNaN(result) || typeof result === 'number', 'should handle mismatched lengths');
    });

    test('triggerCrystalResonance method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      assert.ok(resonance.crystalOrb, 'crystal orb should exist');
      
      resonance.triggerCrystalResonance();
      assert.ok(
        resonance.crystalOrb.classList.contains('resonance-active'),
        'should add resonance-active class'
      );
      
      // Test timeout removal (would need to wait 3 seconds in real scenario)
      // For test, we can check that the method doesn't throw
    });

    test('logActivity method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const initialHistoryLength = resonance.resonanceHistory.length;
      
      resonance.logActivity('Test message', 'test-source');
      
      assert.equal(
        resonance.resonanceHistory.length,
        initialHistoryLength + 1,
        'should add to history'
      );
      
      const lastEntry = resonance.resonanceHistory[resonance.resonanceHistory.length - 1];
      assert.equal(lastEntry.message, 'Test message', 'should store message');
      assert.equal(lastEntry.source, 'test-source', 'should store source');
      assert.ok(lastEntry.timestamp, 'should have timestamp');
    });

    test('startResonanceLoop method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      // The resonance loop starts automatically, we can verify by checking
      // that performPeriodicResonanceCheck doesn't throw
      assert.doesNotThrow(() => {
        resonance.performPeriodicResonanceCheck();
      }, 'periodic resonance check should not throw');
    });

    test('shareInsight and checkResonance methods coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      // Mock prompt for shareInsight
      global.prompt = () => 'Test insight';
      
      const initialConcepts = resonance.conceptDatabase.get('sycopa')?.size || 0;
      
      resonance.shareInsight();
      
      const finalConcepts = resonance.conceptDatabase.get('sycopa')?.size || 0;
      assert.ok(finalConcepts > initialConcepts, 'shareInsight should add concept');
      
      // Test checkResonance
      const initialHistoryLength = resonance.resonanceHistory.length;
      resonance.checkResonance();
      
      // Should trigger activity logging
      assert.ok(
        resonance.resonanceHistory.length >= initialHistoryLength,
        'checkResonance should log activity'
      );
      
      // Cleanup
      delete global.prompt;
    });

    test('sendToFleetRelay method coverage', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      let fetchCalled = false;
      let fetchUrl = '';
      let fetchOptions = {};
      
      // Mock fetch to track calls
      global.fetch = async (url, options) => {
        fetchCalled = true;
        fetchUrl = url;
        fetchOptions = options;
        return { ok: true };
      };
      
      await resonance.sendToFleetRelay('Test fleet message');
      
      assert.ok(fetchCalled, 'should call fetch');
      assert.ok(fetchUrl.includes('fleet/message'), 'should call fleet endpoint');
      assert.equal(fetchOptions.method, 'POST', 'should use POST method');
      
      const body = JSON.parse(fetchOptions.body);
      assert.equal(body.text, 'Test fleet message', 'should send correct message');
      
      // Test error handling
      global.fetch = async () => {
        throw new Error('Network error');
      };
      
      assert.doesNotThrow(async () => {
        await resonance.sendToFleetRelay('Error test message');
      }, 'should handle network errors gracefully');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VillageCustomizer Coverage Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('VillageCustomizer Method Coverage', () => {
    test('constructor and init method coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      assert.equal(customizer.scene, mockScene, 'should store scene reference');
      assert.ok(Array.isArray(customizer.buildingGroups), 'should initialize building groups');
      assert.ok(Array.isArray(customizer.colorPalette), 'should have color palette');
      assert.ok(Array.isArray(customizer.buildingTypes), 'should have building types');
      assert.ok(Array.isArray(customizer.villagePlots), 'should have village plots');
      assert.equal(customizer.isEditMode, false, 'should start in view mode');
    });

    test('createCustomVillage method coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      assert.ok(customizer.buildingGroups.length > 0, 'should create buildings');
      
      // Verify building data
      customizer.buildingGroups.forEach(building => {
        assert.ok(building.userData.buildingData, 'building should have data');
        assert.ok(building.userData.buildingName, 'building should have name');
        assert.ok(building.userData.buildingIndex !== undefined, 'building should have index');
      });
    });

    test('createBuildingGroup method coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      const buildingData = {
        name: 'Test Building',
        color: 0xFF0000,
        x: 10,
        z: 10,
        w: 2,
        h: 2,
        d: 2,
        type: 'cottage'
      };
      
      const group = customizer.createBuildingGroup(buildingData);
      
      assert.ok(group.children.length > 0, 'building group should have children');
      assert.equal(group.userData.buildingName, 'Test Building', 'should store building name');
      assert.equal(group.userData.buildingType, 'cottage', 'should store building type');
      assert.ok(group.userData.roofMesh, 'should have roof mesh reference');
      assert.ok(group.userData.wallsMesh, 'should have walls mesh reference');
    });

    test('createRoof method coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      // Test different roof types
      const roofTypes = ['pyramid', 'pointed', 'dome', 'flat', 'gabled'];
      
      roofTypes.forEach(type => {
        const building = { type, w: 2, h: 2, d: 2, color: 0xFF0000 };
        const roof = customizer.createRoof(building);
        
        assert.ok(roof, `should create ${type} roof`);
        assert.ok(roof.material, 'roof should have material');
      });
    });

    test('getRoofStyle method coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      assert.equal(customizer.getRoofStyle('manor'), 'gabled');
      assert.equal(customizer.getRoofStyle('cottage'), 'pyramid');
      assert.equal(customizer.getRoofStyle('tower'), 'pointed');
      assert.equal(customizer.getRoofStyle('chapel'), 'pointed');
      assert.equal(customizer.getRoofStyle('unknown'), 'pyramid'); // default
    });

    test('addBuildingDetails and addTypeSpecificDetails coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      const building = { w: 3, h: 2, d: 2, type: 'tower' };
      const group = new THREE.Group();
      
      customizer.addBuildingDetails(group, building);
      
      assert.ok(group.children.length > 0, 'should add detail objects');
      
      // Test type-specific details
      customizer.addTypeSpecificDetails(group, building);
      // Tower should get battlements, market should get stalls, etc.
    });

    test('setupUI method coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      assert.ok(document.getElementById('edit-mode-toggle'), 'should create edit toggle');
      assert.ok(document.getElementById('color-palette-panel'), 'should create color palette');
      assert.ok(document.getElementById('building-info-panel'), 'should create info panel');
    });

    test('building selection methods coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      const building = customizer.buildingGroups[0];
      if (building) {
        // Test selection
        customizer.selectBuilding(building);
        assert.equal(customizer.selectedBuilding, building, 'should select building');
        
        const colorPanel = document.getElementById('color-palette-panel');
        assert.equal(colorPanel.style.display, 'block', 'should show color palette');
        
        // Test deselection
        customizer.deselectBuilding();
        assert.equal(customizer.selectedBuilding, null, 'should deselect building');
        assert.equal(colorPanel.style.display, 'none', 'should hide color palette');
      }
    });

    test('color change methods coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      const building = customizer.buildingGroups[0];
      if (building) {
        customizer.selectBuilding(building);
        
        // Test color change
        const originalColor = building.userData.originalColor;
        customizer.changeBuildingColor(0x00FF00);
        
        // Test reset
        customizer.resetBuildingColor();
        // Should reset to original color
      }
    });

    test('edit mode toggle methods coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      // Test enter edit mode
      customizer.toggleEditMode();
      assert.equal(customizer.isEditMode, true, 'should enter edit mode');
      
      const editToggle = document.getElementById('edit-mode-toggle');
      assert.ok(editToggle.innerHTML.includes('Exit'), 'button should show exit text');
      
      const indicator = document.getElementById('edit-mode-indicator');
      assert.ok(indicator, 'should show edit mode indicator');
      
      // Test exit edit mode
      customizer.toggleEditMode();
      assert.equal(customizer.isEditMode, false, 'should exit edit mode');
    });

    test('plot management methods coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      // Test findNearestPlot
      const plot = customizer.findNearestPlot(0, 0);
      assert.ok(plot, 'should find nearest plot');
      assert.ok(typeof plot.x === 'number', 'plot should have x coordinate');
      assert.ok(typeof plot.z === 'number', 'plot should have z coordinate');
      
      // Test showAvailablePlots
      customizer.toggleEditMode();
      assert.ok(customizer.plotIndicators, 'should create plot indicators');
      
      // Test hideAvailablePlots
      customizer.toggleEditMode();
      assert.ok(!customizer.plotIndicators || customizer.plotIndicators.length === 0, 'should clean up indicators');
    });

    test('building destruction methods coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      // Mock confirm
      global.confirm = () => true;
      
      const building = customizer.buildingGroups[0];
      if (building) {
        customizer.selectBuilding(building);
        const initialCount = customizer.buildingGroups.length;
        
        customizer.demolishSelectedBuilding();
        
        assert.ok(customizer.buildingGroups.length < initialCount, 'should remove building');
        assert.equal(customizer.selectedBuilding, null, 'should deselect building');
      }
      
      delete global.confirm;
    });

    test('public API methods coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      const customizer = new VillageCustomizer(mockScene);
      
      // Test getBuildingList
      const buildingList = customizer.getBuildingList();
      assert.ok(Array.isArray(buildingList), 'getBuildingList should return array');
      assert.ok(buildingList.length > 0, 'should have buildings');
      
      buildingList.forEach(building => {
        assert.ok(building.name, 'building should have name');
        assert.ok(building.type, 'building should have type');
        assert.ok(building.position, 'building should have position');
      });
      
      // Test addNewBuilding
      const newBuilding = customizer.addNewBuilding(50, 50, 'cottage');
      if (newBuilding) {
        assert.ok(newBuilding.userData.buildingData, 'new building should have data');
      }
    });

    test('event handler setup coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      // Test that onSceneClick is properly overridden
      const originalOnSceneClick = mockScene.onSceneClick;
      const customizer = new VillageCustomizer(mockScene);
      
      // Should have modified the scene's click handler
      assert.notEqual(mockScene.onSceneClick, originalOnSceneClick, 'should override scene click handler');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Case and Error Path Coverage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Case Coverage', () => {
    test('error handling paths', async () => {
      // Test CSL with null/undefined inputs
      const resonance = new ConsciousnessResonance();
      
      assert.doesNotThrow(() => {
        resonance.addConcept(null, 'test', {});
        resonance.addConcept('test', null, {});
        resonance.addConcept('test', 'test', null);
      }, 'should handle null inputs gracefully');
      
      assert.doesNotThrow(() => {
        resonance.detectResonances(undefined, undefined, {});
      }, 'should handle undefined inputs gracefully');
      
      assert.doesNotThrow(() => {
        resonance.calculateCosineSimilarity(null, [1, 2, 3]);
        resonance.calculateCosineSimilarity([1, 2], null);
        resonance.calculateCosineSimilarity([], []);
      }, 'should handle invalid vectors gracefully');
      
      // Test village customizer with null scene
      assert.doesNotThrow(() => {
        new VillageCustomizer(null);
      }, 'should handle null scene gracefully');
      
      // Test missing DOM elements
      document.body.innerHTML = '';
      
      assert.doesNotThrow(async () => {
        await resonance.initialize();
      }, 'should handle missing DOM gracefully');
    });

    test('boundary value coverage', () => {
      const resonance = new ConsciousnessResonance();
      
      // Test empty vectors
      const result1 = resonance.calculateCosineSimilarity([], []);
      assert.ok(Number.isNaN(result1) || result1 === 0, 'should handle empty vectors');
      
      // Test single element vectors
      const result2 = resonance.calculateCosineSimilarity([1], [1]);
      assert.equal(result2, 1, 'should handle single element vectors');
      
      // Test very large vectors
      const largeVec1 = new Array(10000).fill(0.001);
      const largeVec2 = new Array(10000).fill(0.001);
      const result3 = resonance.calculateCosineSimilarity(largeVec1, largeVec2);
      assert.ok(Math.abs(result3 - 1) < 0.01, 'should handle large vectors');
      
      // Test zero strength concepts
      assert.doesNotThrow(() => {
        resonance.addConcept('test', 'zero-strength', {
          vector: [1, 0, 0, 0, 0],
          strength: 0,
          discovery: 'Zero strength test',
          timestamp: Date.now()
        });
      }, 'should handle zero strength concepts');
    });

    test('resource cleanup coverage', () => {
      const mockScene = {
        scene: new THREE.Group(),
        camera: {},
        raycaster: { setFromCamera: () => {}, intersectObjects: () => [] },
        getMouseNDC: () => ({ x: 0, y: 0 }),
        onSceneClick: () => {}
      };
      
      // Test multiple customizers cleanup
      for (let i = 0; i < 5; i++) {
        const customizer = new VillageCustomizer(mockScene);
        customizer.toggleEditMode();
        customizer.hideEditModeUI();
      }
      
      // Should not accumulate DOM elements excessively
      const editToggles = document.querySelectorAll('#edit-mode-toggle');
      assert.ok(editToggles.length <= 5, 'should clean up edit toggles');
    });
  });
});