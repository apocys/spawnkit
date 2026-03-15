'use strict';

/**
 * CSL Test Utilities
 * Shared utilities, mocks, and fixtures for CSL testing
 */

const { JSDOM } = require('jsdom');

// ═══════════════════════════════════════════════════════════════════════════
// DOM Setup Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Set up a complete JSDOM environment for CSL testing
 * @param {Object} options - Configuration options
 * @returns {Object} DOM instance and cleanup function
 */
function setupCSLDOM(options = {}) {
  const {
    url = 'http://localhost:8766/',
    includeCanvas = true,
    includeTHREE = true,
    includeFetch = true
  } = options;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>CSL Test Environment</title>
        <meta charset="utf-8">
        <style>
          /* Basic styles for testing */
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .test-container { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="castle-app" class="test-container">
          ${includeCanvas ? '<canvas id="canvas" width="800" height="600"></canvas>' : ''}
          <div id="ui-overlay"></div>
        </div>
      </body>
    </html>
  `;

  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    resources: 'usable',
    runScripts: 'dangerously'
  });

  // Set up global environment
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  // Set up localStorage mock
  global.localStorage = createLocalStorageMock();

  // Set up THREE.js mock if requested
  if (includeTHREE) {
    global.THREE = createTHREEMock();
    
    // Set up castleApp mock for medieval scene
    global.window.castleApp = {
      scene: createMockMedievalScene()
    };
  }

  // Set up fetch mock if requested
  if (includeFetch) {
    global.fetch = createFetchMock();
  }

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    cleanup: () => {
      dom.window.close();
      // Clean up globals
      delete global.window;
      delete global.document;
      delete global.navigator;
      delete global.HTMLElement;
      delete global.Element;
      delete global.localStorage;
      if (includeTHREE) delete global.THREE;
      if (includeFetch) delete global.fetch;
    }
  };
}

/**
 * Create a mock localStorage implementation
 */
function createLocalStorageMock() {
  return {
    data: {},
    getItem(key) { return this.data[key] || null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
    clear() { this.data = {}; },
    get length() { return Object.keys(this.data).length; },
    key(index) { return Object.keys(this.data)[index] || null; }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THREE.js Mocks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create comprehensive THREE.js mock for testing
 */
function createTHREEMock() {
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new MockVector3(this.x, this.y, this.z); }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() { 
      const len = this.length();
      if (len > 0) { this.x /= len; this.y /= len; this.z /= len; }
      return this;
    }
  }

  class MockGroup {
    constructor() {
      this.children = [];
      this.position = new MockVector3();
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { x: 1, y: 1, z: 1, setScalar: (s) => { this.x = this.y = this.z = s; } };
      this.userData = {};
      this.parent = null;
    }
    
    add(...objects) {
      objects.forEach(obj => {
        if (obj && !this.children.includes(obj)) {
          this.children.push(obj);
          obj.parent = this;
        }
      });
    }
    
    remove(...objects) {
      objects.forEach(obj => {
        const index = this.children.indexOf(obj);
        if (index > -1) {
          this.children.splice(index, 1);
          obj.parent = null;
        }
      });
    }
    
    traverse(callback) {
      callback(this);
      this.children.forEach(child => {
        if (child.traverse) child.traverse(callback);
        else callback(child);
      });
    }
    
    getObjectByName(name) {
      if (this.name === name) return this;
      for (const child of this.children) {
        if (child.getObjectByName) {
          const result = child.getObjectByName(name);
          if (result) return result;
        } else if (child.name === name) {
          return child;
        }
      }
      return null;
    }
  }

  class MockMesh extends MockGroup {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
      this.isMesh = true;
      this.castShadow = false;
      this.receiveShadow = false;
    }
  }

  class MockGeometry {
    constructor() {
      this.disposed = false;
    }
    dispose() { this.disposed = true; }
  }

  class MockMaterial {
    constructor(props = {}) {
      this.color = { 
        r: 1, g: 1, b: 1,
        setHex: (hex) => {
          this.r = ((hex >> 16) & 255) / 255;
          this.g = ((hex >> 8) & 255) / 255;
          this.b = (hex & 255) / 255;
        }
      };
      this.emissive = { 
        r: 0, g: 0, b: 0,
        setHex: (hex) => {
          this.r = ((hex >> 16) & 255) / 255;
          this.g = ((hex >> 8) & 255) / 255;
          this.b = (hex & 255) / 255;
        }
      };
      this.emissiveIntensity = 0;
      this.opacity = props.opacity !== undefined ? props.opacity : 1;
      this.transparent = props.transparent || false;
      this.disposed = false;
      Object.assign(this, props);
    }
    
    clone() { return new MockMaterial(this); }
    dispose() { this.disposed = true; }
  }

  class MockBox3 {
    constructor(min, max) {
      this.min = min || new MockVector3(-1, -1, -1);
      this.max = max || new MockVector3(1, 1, 1);
    }
    
    setFromObject(object) { return this; }
    
    getCenter(target) {
      target = target || new MockVector3();
      return target.set(
        (this.min.x + this.max.x) / 2,
        (this.min.y + this.max.y) / 2,
        (this.min.z + this.max.z) / 2
      );
    }
  }

  return {
    Group: MockGroup,
    Mesh: MockMesh,
    Vector3: MockVector3,
    Box3: MockBox3,
    BoxGeometry: class extends MockGeometry {},
    ConeGeometry: class extends MockGeometry {},
    SphereGeometry: class extends MockGeometry {},
    CylinderGeometry: class extends MockGeometry {},
    RingGeometry: class extends MockGeometry {},
    BufferGeometry: class extends MockGeometry {
      constructor() {
        super();
        this.attributes = {};
        this.index = null;
      }
      setIndex(index) { this.index = index; }
      setAttribute(name, attr) { this.attributes[name] = attr; }
      computeVertexNormals() {}
    },
    BufferAttribute: class {
      constructor(array, itemSize) {
        this.array = array;
        this.itemSize = itemSize;
      }
    },
    MeshStandardMaterial: MockMaterial,
    MeshBasicMaterial: MockMaterial,
    DoubleSide: 'DoubleSide',
    // Constants
    PI: Math.PI
  };
}

/**
 * Create a mock medieval scene for testing
 */
function createMockMedievalScene() {
  const MockTHREE = global.THREE || createTHREEMock();
  
  return {
    scene: new MockTHREE.Group(),
    camera: {
      position: new MockTHREE.Vector3(0, 10, 20),
      lookAt: () => {}
    },
    renderer: {
      render: () => {},
      setSize: () => {}
    },
    raycaster: {
      setFromCamera: () => {},
      intersectObjects: (objects) => []
    },
    getMouseNDC: (event) => ({ x: 0, y: 0 }),
    onSceneClick: () => {}
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Network Mocks
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a mock fetch implementation for testing
 */
function createFetchMock(customHandlers = {}) {
  const defaultHandlers = {
    '/api/fleet/message': async (url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({ 
        success: true, 
        messageId: `msg-${Date.now()}`,
        timestamp: Date.now()
      })
    }),
    
    '/api/oc/missions': async (url, options) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        return {
          ok: true,
          status: 201,
          json: async () => ({ 
            id: `mission-${Date.now()}`,
            ...body,
            createdAt: Date.now()
          })
        };
      } else if (options?.method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ 
            updated: true,
            timestamp: Date.now()
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ missions: [] })
      };
    }
  };

  const handlers = { ...defaultHandlers, ...customHandlers };

  return async function mockFetch(url, options = {}) {
    // Find matching handler
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return await handler(url, options);
      }
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' })
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Data Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate test concept data
 */
function createTestConcept(overrides = {}) {
  const defaults = {
    vector: [0.8, 0.6, 0.7, 0.5, 0.9],
    strength: 0.8,
    discovery: 'Test concept discovery',
    timestamp: Date.now()
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Generate test building data
 */
function createTestBuilding(overrides = {}) {
  const defaults = {
    name: '🏠 Test Building',
    color: 0x8B4513,
    x: 0,
    z: 0,
    w: 2,
    h: 2,
    d: 2,
    type: 'cottage'
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Create test agent presence data
 */
function createTestAgentPresence(overrides = {}) {
  const defaults = {
    active: true,
    role: 'Test Agent',
    lastSeen: Date.now()
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Generate resonance test scenarios
 */
function createResonanceScenarios() {
  return {
    highResonance: {
      concept1: createTestConcept({ vector: [0.9, 0.8, 0.9, 0.8, 0.9] }),
      concept2: createTestConcept({ vector: [0.88, 0.82, 0.88, 0.82, 0.88] })
    },
    
    mediumResonance: {
      concept1: createTestConcept({ vector: [0.8, 0.6, 0.7, 0.5, 0.9] }),
      concept2: createTestConcept({ vector: [0.7, 0.7, 0.6, 0.6, 0.8] })
    },
    
    lowResonance: {
      concept1: createTestConcept({ vector: [1, 0, 0, 0, 0] }),
      concept2: createTestConcept({ vector: [0, 0, 0, 0, 1] })
    },
    
    noResonance: {
      concept1: createTestConcept({ vector: [1, 0, 0, 0, 0] }),
      concept2: createTestConcept({ vector: [-1, 0, 0, 0, 0] })
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wait for DOM elements to be created
 */
function waitForElement(selector, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Simulate user interaction events
 */
function simulateClick(element) {
  const event = new Event('click', { bubbles: true });
  element.dispatchEvent(event);
}

function simulateMouseMove(element, x = 0, y = 0) {
  const event = new Event('mousemove', { bubbles: true });
  event.clientX = x;
  event.clientY = y;
  element.dispatchEvent(event);
}

/**
 * Performance measurement helper
 */
function measurePerformance(testFunction, testName = 'Test') {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  const result = testFunction();
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  return {
    result,
    duration: endTime - startTime,
    memoryChange: endMemory - startMemory,
    performance: {
      name: testName,
      duration: `${endTime - startTime}ms`,
      memory: `${Math.round((endMemory - startMemory) / 1024)}KB`
    }
  };
}

/**
 * Create a stress test data generator
 */
function* generateStressTestData(count = 1000) {
  for (let i = 0; i < count; i++) {
    yield {
      agent: `stress-agent-${i % 10}`,
      concept: `stress-concept-${i}`,
      data: createTestConcept({
        vector: Array.from({length: 5}, () => Math.random()),
        strength: Math.random(),
        discovery: `Stress test concept ${i}`,
        timestamp: Date.now() + i
      })
    };
  }
}

/**
 * Validate vector mathematical properties
 */
function validateVector(vector, properties = {}) {
  const {
    length: expectedLength,
    minValue,
    maxValue,
    normalized = false
  } = properties;

  const errors = [];

  if (expectedLength && vector.length !== expectedLength) {
    errors.push(`Expected length ${expectedLength}, got ${vector.length}`);
  }

  if (minValue !== undefined) {
    const belowMin = vector.filter(v => v < minValue);
    if (belowMin.length > 0) {
      errors.push(`${belowMin.length} values below minimum ${minValue}`);
    }
  }

  if (maxValue !== undefined) {
    const aboveMax = vector.filter(v => v > maxValue);
    if (aboveMax.length > 0) {
      errors.push(`${aboveMax.length} values above maximum ${maxValue}`);
    }
  }

  if (normalized) {
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (Math.abs(magnitude - 1) > 0.001) {
      errors.push(`Vector not normalized: magnitude ${magnitude}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Memory leak detection helper
 */
function createMemoryLeakDetector() {
  const references = new WeakMap();
  let objectCount = 0;

  return {
    track(obj, name = 'object') {
      references.set(obj, { name, id: ++objectCount });
      return obj;
    },
    
    getTrackedCount() {
      // This is a simplified leak detector
      // In practice, you'd need more sophisticated tracking
      return objectCount;
    },
    
    checkLeaks() {
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      // Return simplified leak report
      return {
        trackedObjects: objectCount,
        // In real implementation, check for objects that should have been GC'd
        potentialLeaks: 0
      };
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // DOM setup
  setupCSLDOM,
  createLocalStorageMock,
  
  // THREE.js mocks
  createTHREEMock,
  createMockMedievalScene,
  
  // Network mocks
  createFetchMock,
  
  // Test data
  createTestConcept,
  createTestBuilding,
  createTestAgentPresence,
  createResonanceScenarios,
  generateStressTestData,
  
  // Helper functions
  waitForElement,
  simulateClick,
  simulateMouseMove,
  measurePerformance,
  validateVector,
  createMemoryLeakDetector
};