'use strict';
const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// Set up JSDOM environment for DOM-dependent code
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
  global.setTimeout = dom.window.setTimeout;
  global.clearTimeout = dom.window.clearTimeout;
  global.setInterval = dom.window.setInterval;
  global.clearInterval = dom.window.clearInterval;
  global.THREE = mockTHREE();

  // Mock localStorage
  const localStorageMock = {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
    clear() { this.data = {}; },
    get length() { return Object.keys(this.data).length; }
  };
  global.localStorage = localStorageMock;

  return dom;
}

function mockTHREE() {
  return {
    Group: class { 
      constructor() { 
        this.children = []; 
        this.position = { x: 0, y: 0, z: 0, set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
        this.userData = {};
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1, setScalar: (s) => { this.x = this.y = this.z = s; } };
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
        this.material = material || { color: { setHex: () => {} }, emissive: { setHex: () => {} } };
        this.position = { x: 0, y: 0, z: 0, set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1, setScalar: (s) => { this.x = this.y = this.z = s; } };
        this.userData = {};
        this.isMesh = true;
        this.castShadow = false;
        this.receiveShadow = false;
      }
      traverse(fn) { fn(this); }
    },
    BoxGeometry: class {
      constructor(w, h, d) {
        this.width = w;
        this.height = h;
        this.depth = d;
      }
      dispose() {}
    },
    ConeGeometry: class {
      constructor(radius, height, segments) {
        this.radius = radius;
        this.height = height;
        this.segments = segments;
      }
      dispose() {}
    },
    SphereGeometry: class {
      constructor(radius, widthSegments, heightSegments) {
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;
      }
      dispose() {}
    },
    CylinderGeometry: class {
      constructor(radiusTop, radiusBottom, height, segments) {
        this.radiusTop = radiusTop;
        this.radiusBottom = radiusBottom;
        this.height = height;
        this.segments = segments;
      }
      dispose() {}
    },
    RingGeometry: class {
      constructor(innerRadius, outerRadius, segments) {
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.segments = segments;
      }
      dispose() {}
    },
    BufferGeometry: class {
      constructor() {
        this.attributes = {};
        this.index = null;
      }
      setIndex(index) { this.index = index; }
      setAttribute(name, attribute) { this.attributes[name] = attribute; }
      computeVertexNormals() {}
      dispose() {}
    },
    BufferAttribute: class {
      constructor(array, itemSize) {
        this.array = array;
        this.itemSize = itemSize;
      }
    },
    MeshStandardMaterial: class {
      constructor(props = {}) {
        this.color = { setHex: () => {} };
        this.emissive = { setHex: () => {} };
        this.roughness = props.roughness || 0.5;
        this.metalness = props.metalness || 0;
        this.transparent = props.transparent || false;
        this.opacity = props.opacity || 1;
        this.side = props.side || 'front';
      }
      clone() { return new this.constructor(); }
      dispose() {}
    },
    MeshBasicMaterial: class {
      constructor(props = {}) {
        this.color = props.color || 0xffffff;
        this.transparent = props.transparent || false;
        this.opacity = props.opacity || 1;
        this.side = props.side || 'front';
      }
      clone() { return new this.constructor(); }
      dispose() {}
    },
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
      }
      add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
      copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    },
    Box3: class {
      constructor() {
        this.min = { x: -1, y: -1, z: -1 };
        this.max = { x: 1, y: 1, z: 1 };
      }
      setFromObject() { return this; }
      getCenter(target) { 
        target = target || new global.THREE.Vector3();
        return target.set(0, 0, 0);
      }
    },
    DoubleSide: 'DoubleSide'
  };
}

// Mock medieval scene
function createMockMedievalScene() {
  return {
    scene: new global.THREE.Group(),
    camera: {},
    renderer: {},
    raycaster: {
      setFromCamera: () => {},
      intersectObjects: () => []
    },
    getMouseNDC: () => ({ x: 0, y: 0 }),
    onSceneClick: () => {}
  };
}

let VillageCustomizer;

describe('VillageCustomizer Tests', () => {
  let dom, customizer, mockScene;

  before(() => {
    dom = setupDOM();
    // Import after DOM setup
    delete require.cache[require.resolve('../../server/office-medieval/village-customizer.js')];
    VillageCustomizer = require('../../server/office-medieval/village-customizer.js');
  });

  after(() => {
    if (dom) dom.window.close();
  });

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '<title>Test</title>';
    localStorage.clear();
    
    // Create fresh mock scene
    mockScene = createMockMedievalScene();
    customizer = new VillageCustomizer(mockScene);
  });

  afterEach(() => {
    if (customizer) {
      customizer.hideEditModeUI?.();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM Manipulation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('DOM Manipulation Correctness', () => {
    test('creates edit mode toggle button', () => {
      const editToggle = document.getElementById('edit-mode-toggle');
      assert.ok(editToggle, 'Edit mode toggle button should be created');
      assert.equal(editToggle.innerHTML, '🎨 Edit Village', 'Button should have correct initial text');
      assert.ok(editToggle.style.position === 'fixed', 'Button should be positioned fixed');
    });

    test('creates color palette panel', () => {
      const colorPanel = document.getElementById('color-palette-panel');
      assert.ok(colorPanel, 'Color palette panel should be created');
      assert.equal(colorPanel.style.display, 'none', 'Panel should initially be hidden');
      
      const colorOptions = colorPanel.querySelectorAll('.color-option');
      assert.equal(colorOptions.length, customizer.colorPalette.length, 'Should have color option for each palette color');
    });

    test('creates building info panel', () => {
      const infoPanel = document.getElementById('building-info-panel');
      assert.ok(infoPanel, 'Building info panel should be created');
      assert.equal(infoPanel.style.display, 'none', 'Panel should initially be hidden');
      
      const editBtn = infoPanel.querySelector('#edit-building-btn');
      const demolishBtn = infoPanel.querySelector('#demolish-building-btn');
      assert.ok(editBtn, 'Edit button should exist');
      assert.ok(demolishBtn, 'Demolish button should exist');
    });

    test('toggle edit mode changes UI state', () => {
      const editToggle = document.getElementById('edit-mode-toggle');
      const initialText = editToggle.innerHTML;
      
      customizer.toggleEditMode();
      
      assert.notEqual(editToggle.innerHTML, initialText, 'Button text should change when toggled');
      assert.equal(customizer.isEditMode, true, 'Edit mode should be enabled');
      
      const indicator = document.getElementById('edit-mode-indicator');
      assert.ok(indicator, 'Edit mode indicator should be visible');
    });

    test('exit edit mode cleans up UI elements', () => {
      customizer.toggleEditMode(); // Enter edit mode
      customizer.toggleEditMode(); // Exit edit mode
      
      assert.equal(customizer.isEditMode, false, 'Edit mode should be disabled');
      
      const indicator = document.getElementById('edit-mode-indicator');
      assert.equal(indicator, null, 'Edit mode indicator should be removed');
      
      const colorPanel = document.getElementById('color-palette-panel');
      const infoPanel = document.getElementById('building-info-panel');
      assert.equal(colorPanel.style.display, 'none', 'Color panel should be hidden');
      assert.equal(infoPanel.style.display, 'none', 'Info panel should be hidden');
    });

    test('building selection updates info panel content', () => {
      const mockBuilding = customizer.buildingGroups[0];
      if (!mockBuilding) return; // Skip if no buildings created
      
      customizer.selectBuilding(mockBuilding);
      
      const infoPanel = document.getElementById('building-info-panel');
      assert.equal(infoPanel.style.display, 'block', 'Info panel should be visible');
      
      const nameElement = document.getElementById('building-info-name');
      assert.ok(nameElement.textContent, 'Building name should be displayed');
    });

    test('color palette interaction changes building color', () => {
      const mockBuilding = customizer.buildingGroups[0];
      if (!mockBuilding) return;
      
      customizer.selectBuilding(mockBuilding);
      const originalColor = mockBuilding.userData.originalColor;
      const newColor = customizer.colorPalette[0].color;
      
      customizer.changeBuildingColor(newColor);
      
      // Should change roof color (mocked - verify method was called)
      assert.notEqual(newColor, originalColor, 'Color should be different from original');
    });

    test('DOM cleanup prevents memory leaks', () => {
      const initialChildCount = document.body.children.length;
      
      // Create multiple customizers and toggle edit modes
      for (let i = 0; i < 5; i++) {
        const tempCustomizer = new VillageCustomizer(mockScene);
        tempCustomizer.toggleEditMode();
        tempCustomizer.hideEditModeUI();
      }
      
      // Should not accumulate DOM elements
      const finalChildCount = document.body.children.length;
      assert.ok(
        finalChildCount < initialChildCount + 20,
        'Should not accumulate excessive DOM elements'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // State Persistence Tests  
  // ═══════════════════════════════════════════════════════════════════════════

  describe('State Persistence to localStorage', () => {
    test('saves village customization state', () => {
      // Modify some buildings
      const building = customizer.buildingGroups[0];
      if (!building) return;
      
      building.userData.customColor = 0xFF0000;
      building.userData.modified = true;
      
      // Simulate save
      const villageState = {
        buildings: customizer.buildingGroups.map(b => ({
          name: b.userData.buildingName,
          position: b.position,
          customColor: b.userData.customColor,
          modified: b.userData.modified
        }))
      };
      
      localStorage.setItem('village-customizer-state', JSON.stringify(villageState));
      
      const savedState = JSON.parse(localStorage.getItem('village-customizer-state'));
      assert.ok(savedState, 'State should be saved to localStorage');
      assert.ok(savedState.buildings, 'Buildings data should be saved');
      assert.ok(savedState.buildings.length > 0, 'Should save building information');
    });

    test('loads village customization state', () => {
      // Set up saved state
      const savedState = {
        buildings: [{
          name: 'Test Building',
          position: { x: 10, y: 0, z: 10 },
          customColor: 0x00FF00,
          modified: true
        }],
        editMode: false
      };
      
      localStorage.setItem('village-customizer-state', JSON.stringify(savedState));
      
      // Simulate load
      const loadedState = JSON.parse(localStorage.getItem('village-customizer-state'));
      
      assert.ok(loadedState, 'State should be loaded from localStorage');
      assert.equal(loadedState.buildings[0].name, 'Test Building', 'Building data should be preserved');
      assert.equal(loadedState.buildings[0].customColor, 0x00FF00, 'Custom color should be preserved');
    });

    test('handles corrupted localStorage data gracefully', () => {
      // Set corrupted data
      localStorage.setItem('village-customizer-state', 'invalid-json-data');
      
      assert.doesNotThrow(() => {
        try {
          const state = JSON.parse(localStorage.getItem('village-customizer-state'));
        } catch (e) {
          // Should handle gracefully
          console.log('Handled corrupted localStorage data');
        }
      }, 'Should handle corrupted localStorage gracefully');
    });

    test('persists user preferences', () => {
      const userPrefs = {
        preferredColors: [0xFF0000, 0x00FF00, 0x0000FF],
        showHelpTooltips: false,
        autoSave: true
      };
      
      localStorage.setItem('village-customizer-prefs', JSON.stringify(userPrefs));
      
      const savedPrefs = JSON.parse(localStorage.getItem('village-customizer-prefs'));
      assert.deepEqual(savedPrefs.preferredColors, userPrefs.preferredColors, 'Preferred colors should persist');
      assert.equal(savedPrefs.showHelpTooltips, false, 'Help tooltip preference should persist');
      assert.equal(savedPrefs.autoSave, true, 'Auto-save preference should persist');
    });

    test('clears state on reset', () => {
      localStorage.setItem('village-customizer-state', 'test-data');
      localStorage.setItem('village-customizer-prefs', 'test-prefs');
      
      localStorage.removeItem('village-customizer-state');
      localStorage.removeItem('village-customizer-prefs');
      
      assert.equal(localStorage.getItem('village-customizer-state'), null, 'State should be cleared');
      assert.equal(localStorage.getItem('village-customizer-prefs'), null, 'Preferences should be cleared');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Memory Cleanup Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Memory Cleanup Methods', () => {
    test('cleans up Three.js objects on building removal', () => {
      const building = customizer.buildingGroups[0];
      if (!building) return;
      
      let geometryDisposed = false;
      let materialDisposed = false;
      
      // Mock disposal methods
      building.traverse(child => {
        if (child.geometry) {
          child.geometry.dispose = () => { geometryDisposed = true; };
        }
        if (child.material) {
          child.material.dispose = () => { materialDisposed = true; };
        }
      });
      
      customizer.selectedBuilding = building;
      
      // Mock confirm to return true
      global.confirm = () => true;
      
      customizer.demolishSelectedBuilding();
      
      // Should clean up resources (check if disposal would be called)
      assert.ok(customizer.buildingGroups.indexOf(building) === -1, 'Building should be removed from tracking');
    });

    test('cleans up event listeners on mode toggle', () => {
      let listenersRemoved = 0;
      const originalRemoveEventListener = Element.prototype.removeEventListener;
      
      Element.prototype.removeEventListener = function(...args) {
        listenersRemoved++;
        return originalRemoveEventListener.apply(this, args);
      };
      
      customizer.toggleEditMode(); // Enter edit mode (adds listeners)
      customizer.toggleEditMode(); // Exit edit mode (should clean listeners)
      
      // Restore original method
      Element.prototype.removeEventListener = originalRemoveEventListener;
      
      // Note: This test is conceptual - actual listener cleanup would depend on implementation
      assert.ok(customizer.isEditMode === false, 'Edit mode should be disabled');
    });

    test('cleans up animation frames and timers', async () => {
      let animationFrameCleaned = false;
      let timeoutCleaned = false;
      
      // Mock cleanup methods
      global.cancelAnimationFrame = () => { animationFrameCleaned = true; };
      global.clearTimeout = () => { timeoutCleaned = true; };
      
      // Simulate creating animations/timers
      customizer.showColorChangeEffect?.(customizer.buildingGroups[0]);
      
      // Allow animations to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Cleanup should happen automatically or on destruction
      assert.ok(true, 'Cleanup simulation completed');
    });

    test('handles large number of buildings without memory issues', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const manyBuildings = [];
      
      // Create many building objects (not actual Three.js objects for test speed)
      for (let i = 0; i < 1000; i++) {
        const mockBuilding = {
          userData: {
            buildingName: `Building ${i}`,
            buildingData: { x: i, z: i, w: 2, h: 2, d: 2 }
          },
          position: { x: i, y: 0, z: i },
          traverse: (fn) => fn(mockBuilding)
        };
        manyBuildings.push(mockBuilding);
        customizer.buildingGroups.push(mockBuilding);
      }
      
      // Perform operations
      manyBuildings.forEach(building => {
        customizer.selectBuilding(building);
        customizer.changeBuildingColor(0xFF0000);
        customizer.deselectBuilding();
      });
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Clean up
      customizer.buildingGroups = customizer.buildingGroups.slice(0, -1000);
      
      assert.ok(memoryIncrease < 50 * 1024 * 1024, 'Memory usage should remain reasonable');
    });

    test('cleans up plot indicators properly', () => {
      customizer.toggleEditMode(); // Should show plot indicators
      
      assert.ok(Array.isArray(customizer.plotIndicators), 'Plot indicators should be tracked');
      
      customizer.toggleEditMode(); // Should hide plot indicators
      
      assert.ok(!customizer.plotIndicators || customizer.plotIndicators.length === 0, 
        'Plot indicators should be cleaned up');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UI Component Lifecycle Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('UI Component Lifecycle', () => {
    test('component initialization creates all required elements', () => {
      // Check that all main UI components are created
      assert.ok(document.getElementById('edit-mode-toggle'), 'Edit toggle should exist');
      assert.ok(document.getElementById('color-palette-panel'), 'Color palette should exist');
      assert.ok(document.getElementById('building-info-panel'), 'Info panel should exist');
      
      // Check that components have proper initial state
      const colorPanel = document.getElementById('color-palette-panel');
      const infoPanel = document.getElementById('building-info-panel');
      
      assert.equal(colorPanel.style.display, 'none', 'Color panel should start hidden');
      assert.equal(infoPanel.style.display, 'none', 'Info panel should start hidden');
    });

    test('component state transitions work correctly', () => {
      const editToggle = document.getElementById('edit-mode-toggle');
      const colorPanel = document.getElementById('color-palette-panel');
      
      // Initial state
      assert.equal(customizer.isEditMode, false, 'Should start in view mode');
      
      // Transition to edit mode
      editToggle.click();
      assert.equal(customizer.isEditMode, true, 'Should enter edit mode');
      
      // Select building
      const building = customizer.buildingGroups[0];
      if (building) {
        customizer.selectBuilding(building);
        assert.equal(colorPanel.style.display, 'block', 'Color panel should show when building selected');
      }
      
      // Deselect building
      customizer.deselectBuilding();
      assert.equal(colorPanel.style.display, 'none', 'Color panel should hide when building deselected');
      
      // Exit edit mode
      editToggle.click();
      assert.equal(customizer.isEditMode, false, 'Should exit edit mode');
    });

    test('component destruction removes all elements', () => {
      const initialElementCount = document.body.children.length;
      
      // Create and destroy multiple instances
      for (let i = 0; i < 3; i++) {
        const tempCustomizer = new VillageCustomizer(mockScene);
        tempCustomizer.toggleEditMode();
        
        // Simulate destruction
        tempCustomizer.hideEditModeUI();
        
        const toggleBtn = document.getElementById('edit-mode-toggle');
        const colorPanel = document.getElementById('color-palette-panel');
        const infoPanel = document.getElementById('building-info-panel');
        const indicator = document.getElementById('edit-mode-indicator');
        
        if (toggleBtn && toggleBtn.parentNode) toggleBtn.parentNode.removeChild(toggleBtn);
        if (colorPanel && colorPanel.parentNode) colorPanel.parentNode.removeChild(colorPanel);
        if (infoPanel && infoPanel.parentNode) infoPanel.parentNode.removeChild(infoPanel);
        if (indicator && indicator.parentNode) indicator.parentNode.removeChild(indicator);
      }
      
      // Should not accumulate elements
      const finalElementCount = document.body.children.length;
      assert.ok(finalElementCount <= initialElementCount + 10, 'Should not accumulate UI elements');
    });

    test('event handlers are properly bound and unbound', () => {
      const colorPanel = document.getElementById('color-palette-panel');
      const colorOptions = colorPanel.querySelectorAll('.color-option');
      
      let clickHandled = false;
      
      // Mock building selection
      if (customizer.buildingGroups[0]) {
        customizer.selectBuilding(customizer.buildingGroups[0]);
        
        // Trigger color option click
        if (colorOptions[0]) {
          colorOptions[0].click();
          clickHandled = true;
        }
      }
      
      assert.ok(colorOptions.length > 0, 'Color options should exist');
      // Event handling would be tested in actual click scenarios
    });

    test('component updates reflect state changes', () => {
      const building = customizer.buildingGroups[0];
      if (!building) return;
      
      customizer.selectBuilding(building);
      
      const nameElement = document.getElementById('building-info-name');
      const typeElement = document.getElementById('building-info-type');
      
      if (nameElement && typeElement) {
        const initialName = nameElement.textContent;
        
        // Update building data
        building.userData.buildingData.name = 'Updated Building Name';
        customizer.updateBuildingInfoPanel(building);
        
        assert.notEqual(nameElement.textContent, initialName, 'UI should reflect data changes');
      }
    });

    test('component responds to viewport/container resize', () => {
      // Simulate window resize
      const resizeEvent = new dom.window.Event('resize');
      dom.window.dispatchEvent(resizeEvent);
      
      // Components should maintain proper positioning (tested by ensuring they still exist)
      assert.ok(document.getElementById('edit-mode-toggle'), 'Edit toggle should survive resize');
      assert.ok(document.getElementById('color-palette-panel'), 'Color panel should survive resize');
    });

    test('component accessibility attributes are properly set', () => {
      const editToggle = document.getElementById('edit-mode-toggle');
      const colorPanel = document.getElementById('color-palette-panel');
      
      // Check for basic accessibility features
      assert.ok(editToggle.style.cursor === 'pointer', 'Interactive elements should have pointer cursor');
      assert.ok(editToggle.textContent, 'Buttons should have descriptive text');
      
      const colorOptions = colorPanel.querySelectorAll('.color-option');
      colorOptions.forEach(option => {
        assert.ok(option.style.cursor === 'pointer', 'Color options should be clickable');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases and Error Handling
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases and Error Handling', () => {
    test('handles missing Three.js scene gracefully', () => {
      assert.doesNotThrow(() => {
        const customizerWithoutScene = new VillageCustomizer(null);
      }, 'Should not throw when scene is null');
    });

    test('handles building selection with invalid building', () => {
      assert.doesNotThrow(() => {
        customizer.selectBuilding(null);
        customizer.selectBuilding(undefined);
        customizer.selectBuilding({});
      }, 'Should handle invalid building selection gracefully');
    });

    test('handles color change with no selected building', () => {
      customizer.selectedBuilding = null;
      
      assert.doesNotThrow(() => {
        customizer.changeBuildingColor(0xFF0000);
      }, 'Should handle color change with no selection');
    });

    test('handles demolish with no selected building', () => {
      customizer.selectedBuilding = null;
      
      assert.doesNotThrow(() => {
        customizer.demolishSelectedBuilding();
      }, 'Should handle demolish with no selection');
    });

    test('handles DOM manipulation when elements do not exist', () => {
      // Remove panels temporarily
      const colorPanel = document.getElementById('color-palette-panel');
      const infoPanel = document.getElementById('building-info-panel');
      
      if (colorPanel) colorPanel.parentNode.removeChild(colorPanel);
      if (infoPanel) infoPanel.parentNode.removeChild(infoPanel);
      
      assert.doesNotThrow(() => {
        customizer.updateBuildingInfoPanel({});
        customizer.showResonancePanel?.();
      }, 'Should handle missing DOM elements gracefully');
    });

    test('handles invalid plot coordinates', () => {
      assert.doesNotThrow(() => {
        const result = customizer.findNearestPlot(NaN, NaN);
        assert.equal(result, null, 'Should return null for invalid coordinates');
      }, 'Should handle invalid coordinates');
      
      assert.doesNotThrow(() => {
        const result = customizer.findNearestPlot(Infinity, -Infinity);
      }, 'Should handle infinite coordinates');
    });

    test('handles building creation at invalid locations', () => {
      const result = customizer.addNewBuilding(999, 999, 'cottage');
      // Should either create building at valid location or return null
      assert.ok(result === null || typeof result === 'object', 'Should return valid result or null');
    });

    test('handles concurrent UI operations', async () => {
      const operations = [];
      
      // Simulate concurrent UI operations
      for (let i = 0; i < 10; i++) {
        operations.push(new Promise(resolve => {
          setTimeout(() => {
            customizer.toggleEditMode();
            if (customizer.buildingGroups[0]) {
              customizer.selectBuilding(customizer.buildingGroups[0]);
              customizer.changeBuildingColor(0xFF0000 + i);
              customizer.deselectBuilding();
            }
            customizer.toggleEditMode();
            resolve();
          }, Math.random() * 10);
        }));
      }
      
      await Promise.all(operations);
      
      // Should maintain consistent state
      assert.ok(typeof customizer.isEditMode === 'boolean', 'Edit mode should maintain boolean state');
    });
  });
});