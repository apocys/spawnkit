/**
 * medieval-compat.js — Three.js API compatibility shim for the 2D canvas engine
 * 
 * Makes all non-Three.js modules (panels, integration, minimap, audio, lifecycle,
 * mission-control, hotbar, allies, etc.) work without modification by exposing
 * a window.castleApp that matches the Three.js MedievalCastle3D interface.
 * 
 * This module runs AFTER medieval-engine.js and extends the castleApp it created.
 */
(function () {
  'use strict';

  var TILE = 20;
  var bootTime = Date.now();

  function waitForApp(attempts) {
    if (attempts > 60) { console.warn('[Compat] castleApp never appeared'); return; }
    var app = window.castleApp;
    if (!app || !app.agents || app.agents.size === 0) {
      setTimeout(function () { waitForApp((attempts || 0) + 1); }, 500);
      return;
    }
    shimApp(app);
  }

  function shimApp(app) {
    var canvas = document.getElementById('game-canvas');

    // ── Clock (used by audio.js, sky.js) ──
    if (!app.clock) {
      app.clock = {
        getElapsedTime: function () { return (Date.now() - bootTime) / 1000; }
      };
    }

    // ── Sound ──
    if (app.soundEnabled === undefined) app.soundEnabled = true;

    // ── Scene (existence check by integration.js guard) ──
    if (!app.scene) app.scene = {};

    // ── Renderer shim (domElement = canvas) ──
    if (!app.renderer) {
      app.renderer = { domElement: canvas };
    }

    // ── Camera shim for minimap viewport ──
    if (!app.camera) {
      app.camera = {
        position: { x: 0, y: 40, z: 0 }
      };
    }

    // ── Controls shim for minimap ──
    if (!app.controls) {
      app.controls = {
        target: { x: 0, y: 0, z: 0 }
      };
    }

    // ── Raycaster stub (drag-drop) ──
    if (!app.raycaster) {
      app.raycaster = {
        setFromCamera: function () {},
        ray: {
          intersectPlane: function () { return null; }
        }
      };
    }

    // ── characterModels — the critical bridge ──
    if (!app.characterModels) {
      app.characterModels = new Map();
    }

    // Convert 2D pixel coords to fake 3D world coords (Three.js uses x/z plane)
    // 2D map: 48 cols x 40 rows. Center roughly at col 24, row 20.
    function tileToWorld(ch) {
      return { x: ch.x / TILE - 24, z: ch.y / TILE - 20 };
    }

    // Sync characterModels from 2D characters each frame
    function syncCharacterModels() {
      var chars = app.agents;
      if (!chars) return;

      chars.forEach(function (ch, id) {
        var w = tileToWorld(ch);
        var existing = app.characterModels.get(id);

        if (!existing) {
          var entry = {
            group: {
              position: { x: w.x, y: 0, z: w.z },
              getWorldPosition: function (target) {
                var ww = tileToWorld(ch);
                if (target) { target.x = ww.x; target.y = 0; target.z = ww.z; return target; }
                return {
                  x: ww.x, y: 0, z: ww.z,
                  clone: function () {
                    var self = { x: ww.x, y: 0, z: ww.z };
                    self.project = function () {
                      // NDC approximation for screen projection
                      var rect = canvas.getBoundingClientRect();
                      var cam = app._2dCamera || { x: 0, y: 0, zoom: 1.8 };
                      var sx = (ch.x * cam.zoom - cam.x) / rect.width * 2 - 1;
                      var sy = -((ch.y * cam.zoom - cam.y) / rect.height * 2 - 1);
                      self.x = sx; self.y = sy; self.z = 0;
                      return self;
                    };
                    return self;
                  },
                  project: function () {
                    var rect = canvas.getBoundingClientRect();
                    var cam = app._2dCamera || { x: 0, y: 0, zoom: 1.8 };
                    var sx = (ch.x * cam.zoom - cam.x) / rect.width * 2 - 1;
                    var sy = -((ch.y * cam.zoom - cam.y) / rect.height * 2 - 1);
                    return { x: sx, y: sy, z: 0 };
                  }
                };
              },
              traverse: function () {},
              scale: { setScalar: function () {} }
            },
            model: null,
            mixer: null,
            animations: [],
            waypoints: [],
            waypointIndex: 0,
            nextWaypointIndex: 0,
            speed: 0.4,
            sessionKey: ch.sessionKey || null,
            _routineTarget: null,
            _routineCallback: null
          };
          app.characterModels.set(id, entry);
        } else {
          existing.group.position.x = w.x;
          existing.group.position.z = w.z;
          existing.sessionKey = ch.sessionKey || null;
          // Sync routine targets back to 2D engine
          if (existing._routineTarget) {
            ch.targetX = (existing._routineTarget.x + 24) * TILE;
            ch.targetY = (existing._routineTarget.z + 20) * TILE;
          }
        }
      });

      // Remove stale
      app.characterModels.forEach(function (_, id) {
        if (!chars.has(id)) app.characterModels.delete(id);
      });
    }

    // ── _dayNightState enhancements (audio.js reads sunAngle, isNight) ──
    var state = app._dayNightState || {};
    app._dayNightState = state;
    if (state.isNight === undefined) {
      Object.defineProperty(state, 'isNight', {
        get: function () {
          var dayRatio = (window.MedTypes && window.MedTypes.DAY_NIGHT) ? window.MedTypes.DAY_NIGHT.dayRatio : 0.7;
          return (state.progress || 0) > dayRatio;
        }
      });
    }
    if (state.sunAngle === undefined) {
      Object.defineProperty(state, 'sunAngle', {
        get: function () {
          return (state.progress || 0) * Math.PI * 2 - Math.PI / 2;
        }
      });
    }

    // ── Dynamic agent management (mission-control.js) ──
    app.addDynamicCharacter = app.addDynamicCharacter || function (name, key) {
      if (app.agents.has(key)) return;
      var defaultPersonality = {
        moodBase: 0.5, walkSpeedMod: { day: 1, night: 0.7 },
        routines: { morning: { zone: 'castle', emoji: '⚔️' } },
        preferredZones: ['castle'], avoidZones: [], energyDecay: 0.0003
      };
      var personality = (window.MedPersonalities && window.MedPersonalities.get(name)) || defaultPersonality;
      var ch = {
        id: key, name: name, palette: Math.floor(Math.random() * 6),
        x: 24 * TILE, y: 33 * TILE, // near gate
        targetX: 24 * TILE, targetY: 20 * TILE,
        dir: 0, state: 0, frame: 0, frameTick: 0,
        emoji: '⚔️', personality: personality,
        mood: 0.5, energy: 1.0,
        isActive: true, isSubAgent: true,
        toolStatus: null, currentZone: 'castle',
        idleTicks: 0, nextWander: 120
      };
      app.agents.set(key, ch);
    };

    app.removeDynamicCharacter = app.removeDynamicCharacter || function (key) {
      app.agents.delete(key);
      app.characterModels.delete(key);
    };

    // ── createCharacterMesh stub (integration.js knight spawn) ──
    app.createCharacterMesh = app.createCharacterMesh || function () {
      return {
        position: { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } },
        scale: { setScalar: function () {} },
        traverse: function () {},
        userData: {}
      };
    };

    // ── buildingGroups (minimap building dots) ──
    if (!app.buildingGroups) {
      app.buildingGroups = [];
      var zones = (window.MedTypes && window.MedTypes.ZONES) || {};
      var zoneRects = (window.MedMap && window.MedMap.ZONE_RECTS) || {};
      for (var name in zones) {
        var zr = zoneRects[name];
        if (zr) {
          app.buildingGroups.push({
            position: { x: zr.c + zr.w / 2 - 24, y: 0, z: zr.r + zr.h / 2 - 20 },
            userData: { buildingName: zones[name].emoji + ' ' + zones[name].name }
          });
        }
      }
    }

    // ── animals (minimap tiny dots) ──
    if (!app.animals) app.animals = [];

    // ── Agent detail rendering (mission-control) ──
    app.renderAgentDetailContent = app.renderAgentDetailContent || function () {};
    app.currentDetailTab = app.currentDetailTab || 'overview';

    // ── Internal 2D camera reference ──
    // The engine must set app._2dCamera = { x, y, zoom } each frame
    app._2dCamera = app._2dCamera || { x: 0, y: 0, zoom: 1.8 };

    // ── Sync loop ──
    function syncLoop() {
      syncCharacterModels();

      // Keep controls.target in sync for minimap
      if (app._2dCamera && app.controls && canvas) {
        var cx = (app._2dCamera.x + canvas.width / 2) / (TILE * app._2dCamera.zoom) - 24;
        var cz = (app._2dCamera.y + canvas.height / 2) / (TILE * app._2dCamera.zoom) - 20;
        app.controls.target.x = cx;
        app.controls.target.z = cz;
      }

      requestAnimationFrame(syncLoop);
    }
    syncLoop();

    console.log('[Compat] ✅ Three.js shim active — characterModels, clock, renderer, camera, scene, controls, buildingGroups');
  }

  waitForApp(0);
})();
