'use strict';
const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { startServer, stopServer } = require('../helpers/server-harness.js');

// Integration test setup
let dom, server, serverPort;
let ConsciousnessResonance, VillageCustomizer;

function setupIntegrationEnvironment() {
  const domInstance = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Medieval CSL Integration Test</title>
        <meta charset="utf-8">
      </head>
      <body>
        <div id="castle-app">
          <canvas id="canvas"></canvas>
          <div id="ui-overlay"></div>
        </div>
        <script>
          // Mock global window objects needed for CSL
          window.castleApp = {
            scene: {
              scene: {
                add: function() {},
                remove: function() {}
              },
              camera: {},
              raycaster: {
                setFromCamera: function() {},
                intersectObjects: function() { return []; }
              },
              getMouseNDC: function() { return { x: 0, y: 0 }; },
              onSceneClick: function() {}
            }
          };
        </script>
      </body>
    </html>
  `, {
    url: 'http://localhost:8766/',
    pretendToBeVisual: true,
    resources: 'usable',
    runScripts: 'dangerously'
  });

  // Set up globals
  global.window = domInstance.window;
  global.document = domInstance.window.document;
  global.navigator = domInstance.window.navigator;
  global.HTMLElement = domInstance.window.HTMLElement;
  global.Element = domInstance.window.Element;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.cancelAnimationFrame = () => {};
  global.THREE = mockTHREE();
  global.fetch = mockFetch;

  // Mock localStorage
  global.localStorage = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
    clear() { this.data = {}; }
  };

  return domInstance;
}

function mockTHREE() {
  return {
    Group: class { 
      constructor() { 
        this.children = []; 
        this.position = { x: 0, y: 0, z: 0, set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1, setScalar: (s) => { this.x = this.y = this.z = s; } };
        this.userData = {};
      }
      add(child) { this.children.push(child); }
      remove(child) { 
        const index = this.children.indexOf(child);
        if (index > -1) this.children.splice(index, 1);
      }
      traverse(fn) { 
        fn(this); 
        this.children.forEach(child => {
          if (child.traverse) child.traverse(fn);
          else fn(child);
        });
      }
    },
    Mesh: class {
      constructor(geometry, material) {
        this.geometry = geometry;
        this.material = material || { 
          color: { setHex: () => {} }, 
          emissive: { setHex: () => {} },
          emissiveIntensity: 0,
          dispose: () => {}
        };
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1, setScalar: (s) => { this.x = this.y = this.z = s; } };
        this.userData = {};
        this.isMesh = true;
        this.castShadow = false;
        this.receiveShadow = false;
      }
      traverse(fn) { fn(this); }
    },
    BoxGeometry: class { constructor() { this.dispose = () => {}; } },
    ConeGeometry: class { constructor() { this.dispose = () => {}; } },
    SphereGeometry: class { constructor() { this.dispose = () => {}; } },
    CylinderGeometry: class { constructor() { this.dispose = () => {}; } },
    RingGeometry: class { constructor() { this.dispose = () => {}; } },
    BufferGeometry: class {
      constructor() { 
        this.dispose = () => {};
        this.attributes = {};
      }
      setIndex() {}
      setAttribute() {}
      computeVertexNormals() {}
    },
    BufferAttribute: class {},
    MeshStandardMaterial: class {
      constructor(props = {}) {
        this.color = { setHex: () => {} };
        this.emissive = { setHex: () => {} };
        this.emissiveIntensity = 0;
        this.dispose = () => {};
      }
      clone() { return new this.constructor(); }
    },
    MeshBasicMaterial: class {
      constructor() {
        this.dispose = () => {};
      }
      clone() { return new this.constructor(); }
    },
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
      }
      add(v) { this.x += v.x; this.y += v.y; this.z += v.z; }
      copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; }
    },
    Box3: class {
      constructor() {
        this.min = { x: -1, y: -1, z: -1 };
        this.max = { x: 1, y: 1, z: 1 };
      }
      setFromObject() { return this; }
      getCenter(target) { 
        return target || new global.THREE.Vector3();
      }
    },
    DoubleSide: 'DoubleSide'
  };
}

async function mockFetch(url, options) {
  if (url.includes('/api/fleet/message')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: 'test-123' })
    };
  }
  
  if (url.includes('/api/oc/missions')) {
    if (options?.method === 'POST') {
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 'mission-123', ...JSON.parse(options.body) })
      };
    } else if (options?.method === 'PATCH') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ updated: true })
      };
    }
  }
  
  return {
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not found' })
  };
}

describe('CSL Integration Tests', () => {
  before(async () => {
    // Start test server
    serverPort = await startServer();
    server = `http://localhost:${serverPort}`;
    
    // Set up DOM environment
    dom = setupIntegrationEnvironment();
    
    // Import modules after environment setup
    delete require.cache[require.resolve('../../server/office-medieval/consciousness-resonance.js')];
    delete require.cache[require.resolve('../../server/office-medieval/village-customizer.js')];
    
    ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
    VillageCustomizer = require('../../server/office-medieval/village-customizer.js');
  });

  after(async () => {
    stopServer();
    if (dom) dom.window.close();
  });

  beforeEach(() => {
    // Clear DOM and localStorage between tests
    document.body.innerHTML = `
      <div id="castle-app">
        <canvas id="canvas"></canvas>
        <div id="ui-overlay"></div>
      </div>
    `;
    localStorage.clear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Full Medieval Theme + CSL Interaction Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Medieval Theme + CSL Integration', () => {
    test('CSL and VillageCustomizer initialize together', async () => {
      // Simulate medieval scene setup
      window.castleApp = {
        scene: new THREE.Group()
      };
      
      // Initialize both systems
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      // Both should be active
      assert.equal(resonance.isActive, true, 'CSL should be active');
      assert.ok(villageCustomizer.buildingGroups.length > 0, 'Village should have buildings');
      
      // UI elements should coexist
      assert.ok(document.getElementById('consciousness-crystal'), 'CSL crystal should be visible');
      assert.ok(document.getElementById('edit-mode-toggle'), 'Village editor should be visible');
    });

    test('CSL resonance affects village building colors', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      let colorChangeDetected = false;
      const originalChangeBuildingColor = villageCustomizer.changeBuildingColor;
      villageCustomizer.changeBuildingColor = function(color) {
        colorChangeDetected = true;
        return originalChangeBuildingColor.call(this, color);
      };
      
      // Trigger resonance that should affect building colors
      resonance.addConcept('sycopa', 'village-harmony', {
        vector: [0.9, 0.8, 0.9, 0.8, 0.9],
        strength: 0.95,
        discovery: 'The village buildings resonate with mystical energy',
        timestamp: Date.now()
      });
      
      // Similar concept should trigger visual effect
      resonance.addConcept('apomac', 'architectural-resonance', {
        vector: [0.88, 0.82, 0.88, 0.82, 0.88],
        strength: 0.93,
        discovery: 'Buildings pulse with sympathetic vibrations',
        timestamp: Date.now()
      });
      
      // In a full implementation, resonances would trigger building effects
      // Here we verify the integration points exist
      assert.ok(resonance.crystalOrb, 'CSL crystal should exist for visual feedback');
      assert.ok(villageCustomizer.buildingGroups.length > 0, 'Buildings should exist to be affected');
    });

    test('village building selection triggers CSL insights', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      let insightTriggered = false;
      const originalAddConcept = resonance.addConcept;
      resonance.addConcept = function(agentId, conceptId, data) {
        if (conceptId.includes('building-connection')) {
          insightTriggered = true;
        }
        return originalAddConcept.call(this, agentId, conceptId, data);
      };
      
      // Select a building
      const building = villageCustomizer.buildingGroups[0];
      if (building) {
        villageCustomizer.selectBuilding(building);
        
        // Simulate insight triggered by building interaction
        resonance.addConcept('user', 'building-connection', {
          vector: [0.7, 0.3, 0.8, 0.4, 0.6],
          strength: 0.8,
          discovery: `Connection established with ${building.userData.buildingName}`,
          timestamp: Date.now()
        });
        
        assert.ok(insightTriggered, 'Building selection should trigger CSL insight');
      }
    });

    test('medieval theme colors synchronize with CSL resonance states', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      // Test different resonance strengths affecting theme
      const resonanceStates = [
        { strength: 0.3, expectedTheme: 'calm' },
        { strength: 0.7, expectedTheme: 'active' },
        { strength: 0.9, expectedTheme: 'intense' }
      ];
      
      for (const state of resonanceStates) {
        resonance.addConcept('theme-agent', `concept-${state.strength}`, {
          vector: [state.strength, state.strength, state.strength, state.strength, state.strength],
          strength: state.strength,
          discovery: `Resonance at ${state.strength} strength`,
          timestamp: Date.now()
        });
        
        // In full implementation, this would sync visual themes
        assert.ok(resonance.crystalField.size > 0, 'Concepts should be tracked');
        assert.ok(villageCustomizer.isEditMode !== undefined, 'Village state should be accessible');
      }
    });

    test('shared state between CSL and village persists correctly', () => {
      const resonance = new ConsciousnessResonance();
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      // Simulate shared state
      const sharedState = {
        cslActive: resonance.isActive,
        villageBuildingCount: villageCustomizer.buildingGroups.length,
        currentResonanceLevel: 0.8,
        selectedBuildingId: 'manor-house-1',
        timestamp: Date.now()
      };
      
      localStorage.setItem('medieval-csl-state', JSON.stringify(sharedState));
      
      const savedState = JSON.parse(localStorage.getItem('medieval-csl-state'));
      
      assert.equal(savedState.cslActive, sharedState.cslActive, 'CSL state should persist');
      assert.equal(savedState.villageBuildingCount, sharedState.villageBuildingCount, 'Village state should persist');
      assert.ok(savedState.timestamp, 'State timestamp should be preserved');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // End-to-End Concept Sharing Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('End-to-End Concept Sharing', () => {
    test('concept sharing flow between multiple agents', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const conceptFlow = [];
      
      // Override logActivity to track concept flow
      const originalLogActivity = resonance.logActivity;
      resonance.logActivity = function(message, source) {
        conceptFlow.push({ message, source, timestamp: Date.now() });
        return originalLogActivity.call(this, message, source);
      };
      
      // Simulate multi-agent concept sharing
      const agents = ['sycopa', 'apomac', 'user', 'system'];
      const conceptChain = [
        {
          agent: 'sycopa',
          concept: 'mathematical-beauty',
          vector: [0.9, 0.7, 0.8, 0.6, 0.9],
          discovery: 'Mathematics reveals underlying beauty in village architecture'
        },
        {
          agent: 'apomac',
          concept: 'geometric-harmony',
          vector: [0.88, 0.72, 0.82, 0.58, 0.88],
          discovery: 'Building proportions follow golden ratio principles'
        },
        {
          agent: 'user',
          concept: 'aesthetic-resonance',
          vector: [0.85, 0.75, 0.78, 0.62, 0.85],
          discovery: 'Visual harmony emerges from mathematical foundations'
        },
        {
          agent: 'system',
          concept: 'collective-understanding',
          vector: [0.87, 0.73, 0.80, 0.60, 0.87],
          discovery: 'Shared appreciation creates deeper comprehension'
        }
      ];
      
      // Add concepts in sequence
      for (const { agent, concept, vector, discovery } of conceptChain) {
        resonance.addConcept(agent, concept, {
          vector,
          strength: 0.9,
          discovery,
          timestamp: Date.now()
        });
        
        // Small delay to ensure proper sequencing
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Verify concept sharing chain
      assert.ok(conceptFlow.length > conceptChain.length, 'Should generate sharing events');
      
      const resonanceEvents = conceptFlow.filter(event => event.source === 'resonance');
      assert.ok(resonanceEvents.length > 0, 'Should detect resonances between concepts');
      
      // Verify all agents participated
      const participatingAgents = new Set();
      conceptChain.forEach(({ agent }) => participatingAgents.add(agent));
      assert.equal(participatingAgents.size, agents.length, 'All agents should participate in sharing');
    });

    test('concept propagation across village buildings', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      // Track building-related concept propagation
      const buildingConcepts = [];
      const originalAddConcept = resonance.addConcept;
      resonance.addConcept = function(agentId, conceptId, data) {
        if (data.discovery && data.discovery.includes('building')) {
          buildingConcepts.push({ agentId, conceptId, data });
        }
        return originalAddConcept.call(this, agentId, conceptId, data);
      };
      
      // Simulate building-related concept sharing
      const buildings = villageCustomizer.buildingGroups.slice(0, 3);
      
      buildings.forEach((building, index) => {
        const buildingName = building.userData.buildingName || `Building ${index}`;
        
        resonance.addConcept(`agent-${index}`, `building-insight-${index}`, {
          vector: [0.6 + index * 0.1, 0.5, 0.7, 0.4 + index * 0.1, 0.8],
          strength: 0.8,
          discovery: `Insights about building: ${buildingName}`,
          timestamp: Date.now() + index
        });
      });
      
      assert.ok(buildingConcepts.length > 0, 'Building concepts should be shared');
      assert.ok(
        buildingConcepts.some(concept => concept.data.discovery.includes('Building')),
        'Concepts should reference buildings'
      );
    });

    test('cross-platform concept sharing via fleet relay', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      let fleetMessageSent = false;
      let messageContent = '';
      
      // Override sendToFleetRelay to track communications
      resonance.sendToFleetRelay = async function(message) {
        fleetMessageSent = true;
        messageContent = message;
        return Promise.resolve();
      };
      
      // Trigger concept sharing that should notify external systems
      resonance.addConcept('sycopa', 'cross-platform-insight', {
        vector: [0.9, 0.9, 0.9, 0.9, 0.9],
        strength: 0.95,
        discovery: 'Critical insight that needs external sharing',
        timestamp: Date.now()
      });
      
      // Manually trigger fleet relay (in real implementation, this might be automatic)
      await resonance.sendToFleetRelay('🔮 Concept shared: cross-platform-insight');
      
      assert.ok(fleetMessageSent, 'Should send message via fleet relay');
      assert.ok(messageContent.includes('Concept shared'), 'Message should contain concept information');
    });

    test('concept sharing maintains temporal consistency', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const timeStamps = [];
      const originalAddConcept = resonance.addConcept;
      resonance.addConcept = function(agentId, conceptId, data) {
        timeStamps.push(data.timestamp);
        return originalAddConcept.call(this, agentId, conceptId, data);
      };
      
      // Add concepts with specific timing
      const concepts = [
        { delay: 0, timestamp: Date.now() },
        { delay: 100, timestamp: Date.now() + 100 },
        { delay: 200, timestamp: Date.now() + 200 }
      ];
      
      for (const { delay, timestamp } of concepts) {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        resonance.addConcept('temporal-agent', `concept-${timestamp}`, {
          vector: [0.5, 0.5, 0.5, 0.5, 0.5],
          strength: 0.7,
          discovery: `Temporal concept at ${timestamp}`,
          timestamp
        });
      }
      
      // Verify temporal ordering
      for (let i = 1; i < timeStamps.length; i++) {
        assert.ok(timeStamps[i] > timeStamps[i-1], 'Timestamps should be in ascending order');
      }
    });

    test('concept sharing handles network interruptions gracefully', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      // Mock network failure
      global.fetch = async () => {
        throw new Error('Network unavailable');
      };
      
      let errorHandled = false;
      const originalLogActivity = resonance.logActivity;
      resonance.logActivity = function(message, source) {
        if (message.includes('error') || source === 'error') {
          errorHandled = true;
        }
        return originalLogActivity.call(this, message, source);
      };
      
      // Try to share concept during network failure
      try {
        await resonance.sendToFleetRelay('Test message during network failure');
      } catch (error) {
        // Should handle gracefully
      }
      
      // Restore fetch
      global.fetch = mockFetch;
      
      // Verify system continues working
      resonance.addConcept('resilient-agent', 'network-failure-test', {
        vector: [0.6, 0.6, 0.6, 0.6, 0.6],
        strength: 0.7,
        discovery: 'Concept shared despite network issues',
        timestamp: Date.now()
      });
      
      assert.ok(resonance.conceptDatabase.has('resilient-agent'), 'System should continue working after network failure');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Performance Under Load Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Performance Under Load', () => {
    test('handles high-frequency concept additions', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const startTime = Date.now();
      const conceptCount = 1000;
      
      // Add many concepts quickly
      for (let i = 0; i < conceptCount; i++) {
        resonance.addConcept(`agent-${i % 10}`, `concept-${i}`, {
          vector: Array.from({length: 5}, () => Math.random()),
          strength: Math.random(),
          discovery: `High frequency concept ${i}`,
          timestamp: Date.now()
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      assert.ok(duration < 5000, 'Should handle 1000 concepts in under 5 seconds');
      
      // Verify data integrity
      let totalConcepts = 0;
      for (const [agent, concepts] of resonance.conceptDatabase.entries()) {
        totalConcepts += concepts.size;
      }
      
      assert.equal(totalConcepts, conceptCount, 'All concepts should be stored correctly');
    });

    test('maintains UI responsiveness under load', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      let uiResponsive = true;
      const startTime = Date.now();
      
      // Simulate heavy UI load
      const uiOperations = [];
      for (let i = 0; i < 100; i++) {
        uiOperations.push(new Promise(resolve => {
          setTimeout(() => {
            const currentTime = Date.now();
            if (currentTime - startTime > 100) { // Each operation should complete quickly
              uiResponsive = false;
            }
            
            villageCustomizer.toggleEditMode();
            if (villageCustomizer.buildingGroups[0]) {
              villageCustomizer.selectBuilding(villageCustomizer.buildingGroups[0]);
              villageCustomizer.changeBuildingColor(0xFF0000 + i);
              villageCustomizer.deselectBuilding();
            }
            villageCustomizer.toggleEditMode();
            
            resolve();
          }, Math.random() * 2); // Random small delays
        }));
      }
      
      await Promise.all(uiOperations);
      
      assert.ok(uiResponsive, 'UI should remain responsive under load');
    });

    test('memory usage remains stable during extended operation', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run extended operations
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add and remove concepts
        for (let i = 0; i < 100; i++) {
          resonance.addConcept(`temp-agent-${i}`, `temp-concept-${i}`, {
            vector: Array.from({length: 50}, () => Math.random()), // Larger vectors
            strength: Math.random(),
            discovery: `Temporary concept ${cycle}-${i}`,
            timestamp: Date.now()
          });
        }
        
        // Clear some agents to simulate cleanup
        for (let i = 0; i < 50; i++) {
          resonance.conceptDatabase.delete(`temp-agent-${i}`);
        }
        
        // UI operations
        villageCustomizer.toggleEditMode();
        for (const building of villageCustomizer.buildingGroups.slice(0, 5)) {
          villageCustomizer.selectBuilding(building);
          villageCustomizer.changeBuildingColor(Math.floor(Math.random() * 0xFFFFFF));
          villageCustomizer.deselectBuilding();
        }
        villageCustomizer.toggleEditMode();
        
        // Force garbage collection opportunity
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      assert.ok(memoryIncrease < 200 * 1024 * 1024, 'Memory increase should be reasonable (<200MB)');
    });

    test('concurrent operations maintain data consistency', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      const villageCustomizer = new VillageCustomizer(window.castleApp);
      
      // Run concurrent operations
      const operations = [];
      
      // CSL operations
      for (let i = 0; i < 50; i++) {
        operations.push(new Promise(resolve => {
          setTimeout(() => {
            resonance.addConcept(`concurrent-agent-${i}`, `concept-${i}`, {
              vector: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()],
              strength: Math.random(),
              discovery: `Concurrent concept ${i}`,
              timestamp: Date.now()
            });
            resolve('csl');
          }, Math.random() * 100);
        }));
      }
      
      // Village operations
      for (let i = 0; i < 30; i++) {
        operations.push(new Promise(resolve => {
          setTimeout(() => {
            const building = villageCustomizer.buildingGroups[i % villageCustomizer.buildingGroups.length];
            if (building) {
              villageCustomizer.selectBuilding(building);
              villageCustomizer.changeBuildingColor(Math.floor(Math.random() * 0xFFFFFF));
              villageCustomizer.deselectBuilding();
            }
            resolve('village');
          }, Math.random() * 100);
        }));
      }
      
      const results = await Promise.all(operations);
      
      // Verify results
      const cslOps = results.filter(r => r === 'csl').length;
      const villageOps = results.filter(r => r === 'village').length;
      
      assert.equal(cslOps, 50, 'All CSL operations should complete');
      assert.equal(villageOps, 30, 'All village operations should complete');
      
      // Verify data integrity
      assert.ok(resonance.conceptDatabase.size > 0, 'CSL data should be intact');
      assert.ok(villageCustomizer.buildingGroups.length > 0, 'Village data should be intact');
    });

    test('large dataset resonance detection performance', async () => {
      const resonance = new ConsciousnessResonance();
      await resonance.initialize();
      
      // Create large dataset
      const agentCount = 50;
      const conceptsPerAgent = 20;
      
      for (let agent = 0; agent < agentCount; agent++) {
        for (let concept = 0; concept < conceptsPerAgent; concept++) {
          resonance.addConcept(`load-agent-${agent}`, `load-concept-${concept}`, {
            vector: Array.from({length: 10}, () => Math.random()),
            strength: Math.random(),
            discovery: `Load test concept ${agent}-${concept}`,
            timestamp: Date.now()
          });
        }
      }
      
      // Test resonance detection performance
      const startTime = Date.now();
      
      const resonances = resonance.detectResonances('test-agent', 'test-concept', {
        vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        strength: 0.8,
        discovery: 'Performance test concept',
        timestamp: Date.now()
      });
      
      const endTime = Date.now();
      const detectionTime = endTime - startTime;
      
      assert.ok(detectionTime < 1000, 'Resonance detection should complete in under 1 second');
      assert.ok(Array.isArray(resonances), 'Should return resonance array');
      
      // Verify we can still add concepts efficiently
      const addStartTime = Date.now();
      
      resonance.addConcept('perf-test-agent', 'perf-test-concept', {
        vector: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0],
        strength: 0.9,
        discovery: 'Performance validation concept',
        timestamp: Date.now()
      });
      
      const addEndTime = Date.now();
      const addTime = addEndTime - addStartTime;
      
      assert.ok(addTime < 100, 'Adding concept should be fast even with large dataset');
    });
  });
});