// Fixed JSDOM setup for CSL tests
'use strict';

const { JSDOM } = require('jsdom');

function setupDOM() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head><title>CSL Test</title></head>
      <body></body>
    </html>
  `, {
    url: 'http://localhost:8766/',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  // Assign globals without overriding read-only properties
  global.window = dom.window;
  global.document = dom.window.document;
  
  // Don't override navigator if it's read-only
  if (!global.navigator) {
    global.navigator = dom.window.navigator;
  }
  
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  
  // Mock localStorage
  global.localStorage = {
    store: {},
    getItem: function(key) {
      return this.store[key] || null;
    },
    setItem: function(key, value) {
      this.store[key] = value.toString();
    },
    removeItem: function(key) {
      delete this.store[key];
    },
    clear: function() {
      this.store = {};
    }
  };

  // Mock fetch for fleet relay tests
  global.fetch = async (url, options) => {
    if (url.includes('fleet/message')) {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: false, json: async () => ({ error: 'Mock fetch' }) };
  };

  // Mock THREE.js
  global.THREE = mockTHREE();

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
      clone() { return new this.constructor(this.x, this.y, this.z); }
      normalize() { 
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len > 0) { this.x /= len; this.y /= len; this.z /= len; }
        return this;
      }
    },
    Box3: class {
      setFromObject() { return this; }
      getCenter() { return new THREE.Vector3(); }
      get min() { return { x: -1, y: -1, z: -1 }; }
      get max() { return { x: 1, y: 1, z: 1 }; }
    }
  };
}

module.exports = { setupDOM, mockTHREE };