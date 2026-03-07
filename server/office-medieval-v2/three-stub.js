/**
 * three-stub.js — Minimal THREE.js API stubs for modules that reference THREE directly
 * 
 * medieval-integration.js uses:
 *   - new THREE.Vector3()
 *   - new THREE.Vector2()
 *   - new THREE.Plane()
 *   - vec.clone(), vec.project(), vec.getWorldPosition()
 *
 * This provides just enough to prevent errors. Actual positioning
 * is handled by the compat shim's screen projection.
 */
(function () {
  'use strict';

  if (window.THREE) return; // Real Three.js is loaded, don't override

  function Vector3(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }
  Vector3.prototype.clone = function () { return new Vector3(this.x, this.y, this.z); };
  Vector3.prototype.project = function () { return this; };
  Vector3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
  Vector3.prototype.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };
  Vector3.prototype.add = function (v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; };
  Vector3.prototype.sub = function (v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; };
  Vector3.prototype.multiplyScalar = function (s) { this.x *= s; this.y *= s; this.z *= s; return this; };
  Vector3.prototype.normalize = function () {
    var l = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z) || 1;
    this.x /= l; this.y /= l; this.z /= l; return this;
  };

  function Vector2(x, y) {
    this.x = x || 0;
    this.y = y || 0;
  }

  function Plane(normal, constant) {
    this.normal = normal || new Vector3(0, 1, 0);
    this.constant = constant || 0;
  }

  window.THREE = {
    Vector3: Vector3,
    Vector2: Vector2,
    Plane: Plane
  };

  console.log('[THREE-Stub] Minimal THREE API available (Vector3, Vector2, Plane)');
})();
