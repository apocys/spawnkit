/**
 * medieval-engine.js — Main 2D canvas engine for Medieval Office v2
 * Replaces Three.js with a performant 2D tile-based renderer.
 * Integrates: MedTypes, MedMap, MedRenderer, MedPersonalities, data-bridge.
 */
(function () {
  'use strict';

  var TILE = 20; // Base tile size in pixels

  var Dir = window.OfficeTypes.Direction;
  var CS = window.OfficeTypes.CharacterState;

  // ── Engine state ──
  var canvas, ctx;
  var tileMap = [];
  var furniture = [];
  var characters = new Map();
  var camera = { x: 0, y: 0, zoom: 1.8 };
  var targetCamera = { x: 0, y: 0, zoom: 1.8 };
  var isDragging = false;
  var dragStart = { x: 0, y: 0 };
  var cameraStart = { x: 0, y: 0 };
  var selectedAgent = null;
  var hoveredAgent = null;
  var cycleStart = Date.now();
  var frameCount = 0;
  var animFrame = 0;

  // ── Zone labels for overlay rendering ──
  var zoneLabels = [];

  // ── Data bridge state ──
  var sessions = [];
  var lastFetchTime = 0;
  var FETCH_INTERVAL = 5000; // 5s for more responsive KPI updates

  // ── Default agents ──
  var DEFAULT_AGENTS = [
    { id: 'sycopa',   name: 'Sycopa',   palette: 0 },
    { id: 'forge',    name: 'Forge',     palette: 4 },
    { id: 'atlas',    name: 'Atlas',     palette: 2 },
    { id: 'hunter',   name: 'Hunter',    palette: 3 },
    { id: 'echo',     name: 'Echo',      palette: 1 },
    { id: 'sentinel', name: 'Sentinel',  palette: 5 }
  ];

  function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.error('[MedEngine] No #game-canvas found');
      return;
    }
    ctx = canvas.getContext('2d');

    // Generate world
    tileMap = window.MedMap.generate();
    furniture = window.MedMap.getFurniture();

    // Build zone labels
    for (var name in window.MedMap.ZONE_RECTS) {
      var z = window.MedMap.ZONE_RECTS[name];
      var info = window.MedTypes.ZONES[name];
      if (info) {
        zoneLabels.push({
          name: info.name,
          emoji: info.emoji,
          row: z.r + Math.floor(z.h / 2),
          col: z.c + Math.floor(z.w / 2)
        });
      }
    }

    // Initialize agents
    DEFAULT_AGENTS.forEach(function (a) {
      spawnAgent(a.id, a.name, a.palette, false);
    });

    // Center camera on throne room
    var throne = window.MedMap.getZoneCenter('castle');
    camera.x = throne.col * TILE * camera.zoom - canvas.width / 2;
    camera.y = throne.row * TILE * camera.zoom - canvas.height / 2;
    targetCamera.x = camera.x;
    targetCamera.y = camera.y;

    // Input
    setupInput();

    // Resize
    resize();
    window.addEventListener('resize', resize);

    // Start loop
    requestAnimationFrame(loop);

    // Expose for other scripts
    window.castleApp = {
      agents: characters,
      selectedAgent: null,
      selectAgent: selectAgentById,
      resetCamera: resetCamera,
      getZoneAt: window.MedMap.getZoneAt,
      getZoneCenter: window.MedMap.getZoneCenter,
      _dayNightState: { progress: 0, timeOfDay: 'morning' },
      toggleEditMode: function () { /* stub for hotbar */ },
      _2dCamera: camera
    };

    // Start data polling
    fetchData();
    setInterval(fetchData, FETCH_INTERVAL);

    console.log('[MedEngine] Initialized — ' + characters.size + ' agents, ' +
      tileMap.length + 'x' + tileMap[0].length + ' map');
  }

  // ── Agent management ──

  function spawnAgent(id, name, palette, isSubAgent) {
    var personality = window.MedPersonalities.get(name);
    var startZone = personality.routines.morning ? personality.routines.morning.zone : 'castle';
    var center = window.MedMap.getZoneCenter(startZone);

    var ch = {
      id: id,
      name: name,
      palette: palette || 0,
      x: center.col * TILE + (Math.random() - 0.5) * TILE * 2,
      y: center.row * TILE + (Math.random() - 0.5) * TILE * 2,
      targetX: center.col * TILE,
      targetY: center.row * TILE,
      dir: Dir.DOWN,
      state: CS.IDLE,
      frame: 0,
      frameTick: 0,
      emoji: personality.routines.morning ? personality.routines.morning.emoji : '🏰',
      personality: personality,
      mood: personality.moodBase,
      energy: 1.0,
      trust: 3,
      conscience: 'dutiful',
      isActive: false,
      isSubAgent: isSubAgent || false,
      toolStatus: null,
      currentZone: startZone,
      idleTicks: 0,
      nextWander: 120 + Math.floor(Math.random() * 180)
    };
    characters.set(id, ch);
    return ch;
  }

  function removeAgent(id) {
    characters.delete(id);
  }

  function selectAgentById(id) {
    selectedAgent = id;
    window.castleApp.selectedAgent = id;
    // Dispatch event for panels
    var ev = new CustomEvent('agent:select', { detail: { agentId: id, agent: characters.get(id) } });
    document.dispatchEvent(ev);
  }

  function resetCamera() {
    var throne = window.MedMap.getZoneCenter('castle');
    targetCamera.x = throne.col * TILE * camera.zoom - canvas.width / 2;
    targetCamera.y = throne.row * TILE * camera.zoom - canvas.height / 2;
    targetCamera.zoom = 1.8;
  }

  // ── Character AI ──

  function updateCharacters() {
    var now = Date.now();
    var cycleDuration = window.MedTypes.DAY_NIGHT.cycleDuration * 1000;
    var cycleProgress = ((now - cycleStart) % cycleDuration) / cycleDuration;
    var dayRatio = window.MedTypes.DAY_NIGHT.dayRatio;
    var isNight = cycleProgress > dayRatio;
    var timeOfDay = window.MedTypes.getTimeOfDay(cycleProgress);

    // Update global state
    window.castleApp._dayNightState.progress = cycleProgress;
    window.castleApp._dayNightState.timeOfDay = timeOfDay;

    characters.forEach(function (ch) {
      // Update emoji based on time
      ch.emoji = window.MedPersonalities.getTimeEmoji(ch.name, cycleProgress);

      // Speed modifier
      var speedMod = isNight ? (ch.personality.walkSpeedMod.night || 0.7) : (ch.personality.walkSpeedMod.day || 1.0);
      var speed = 0.6 * speedMod;

      // Energy decay
      ch.energy = Math.max(0.1, ch.energy - (ch.personality.energyDecay || 0.0003));
      if (ch.energy < 0.3 && ch.state !== CS.WORK) {
        speed *= 0.5;
      }

      // Routine zone targeting
      ch.idleTicks++;
      if (ch.idleTicks > ch.nextWander && ch.state !== CS.WORK) {
        var routine = ch.personality.routines[timeOfDay];
        if (routine) {
          var targetZone = routine.zone;
          var zcenter = window.MedMap.getZoneCenter(targetZone);
          ch.targetX = zcenter.col * TILE + (Math.random() - 0.5) * TILE * 3;
          ch.targetY = zcenter.row * TILE + (Math.random() - 0.5) * TILE * 3;
          ch.currentZone = targetZone;
        }
        ch.idleTicks = 0;
        ch.nextWander = 120 + Math.floor(Math.random() * 180);
      }

      // Movement
      var dx = ch.targetX - ch.x;
      var dy = ch.targetY - ch.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        ch.state = CS.WALK;
        var nx = dx / dist * speed;
        var ny = dy / dist * speed;
        ch.x += nx;
        ch.y += ny;

        // Direction
        if (Math.abs(dx) > Math.abs(dy)) {
          ch.dir = dx > 0 ? Dir.RIGHT : Dir.LEFT;
        } else {
          ch.dir = dy > 0 ? Dir.DOWN : Dir.UP;
        }

        // Walk animation frame
        ch.frameTick++;
        if (ch.frameTick > 8) {
          ch.frame = (ch.frame + 1) % 4;
          ch.frameTick = 0;
        }
      } else {
        if (ch.isActive) {
          ch.state = CS.WORK;
          ch.frameTick++;
          if (ch.frameTick > 15) {
            ch.frame = (ch.frame + 1) % 2;
            ch.frameTick = 0;
          }
        } else {
          ch.state = CS.IDLE;
          ch.frame = 0;
        }
      }

      // Mood: boost in preferred zone, penalize in avoided
      var currentZone = window.MedMap.getZoneAt(
        Math.floor(ch.y / TILE),
        Math.floor(ch.x / TILE)
      );
      if (currentZone) {
        if (ch.personality.preferredZones.indexOf(currentZone) >= 0) {
          ch.mood = Math.min(1, ch.mood + 0.001);
        }
        if (ch.personality.avoidZones.indexOf(currentZone) >= 0) {
          ch.mood = Math.max(0, ch.mood - 0.002);
        }
      }
    });
  }

  // ── Render ──

  function render() {
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, w, h);

    var ox = -camera.x;
    var oy = -camera.y;
    var zoom = camera.zoom;

    // Tiles
    window.MedRenderer.renderTiles(ctx, tileMap, ox, oy, zoom);

    // Furniture
    window.MedRenderer.renderFurniture(ctx, furniture, ox, oy, zoom);

    // Zone labels
    ctx.save();
    ctx.globalAlpha = 0.6;
    var fontSize = Math.max(10, 11 * zoom);
    ctx.font = '600 ' + fontSize + 'px Cinzel, serif';
    ctx.textAlign = 'center';
    for (var i = 0; i < zoneLabels.length; i++) {
      var zl = zoneLabels[i];
      var lx = ox + zl.col * TILE * zoom;
      var ly = oy + zl.row * TILE * zoom;
      // Background
      var text = zl.emoji + ' ' + zl.name;
      var tw = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(20, 20, 30, 0.55)';
      ctx.fillRect(lx - tw / 2, ly - fontSize * 0.7, tw, fontSize * 1.4);
      // Text
      ctx.fillStyle = '#c9a959';
      ctx.fillText(text, lx, ly + fontSize * 0.3);
    }
    ctx.restore();

    // Characters (z-sorted)
    window.MedRenderer.renderCharacters(ctx, characters, ox, oy, zoom);

    // Selection ring
    if (selectedAgent) {
      var sel = characters.get(selectedAgent);
      if (sel) {
        var sx = ox + sel.x * zoom;
        var sy = oy + sel.y * zoom;
        var sr = TILE * zoom * 0.5;
        ctx.strokeStyle = '#c9a959';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy + sr * 0.3, sr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Hover highlight
    if (hoveredAgent && hoveredAgent !== selectedAgent) {
      var hov = characters.get(hoveredAgent);
      if (hov) {
        var hx = ox + hov.x * zoom;
        var hy = oy + hov.y * zoom;
        var hr = TILE * zoom * 0.45;
        ctx.strokeStyle = 'rgba(201, 169, 89, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy + hr * 0.3, hr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Day/Night overlay
    var cycleDuration = window.MedTypes.DAY_NIGHT.cycleDuration * 1000;
    var cycleProgress = ((Date.now() - cycleStart) % cycleDuration) / cycleDuration;
    window.MedRenderer.renderDayNight(ctx, w, h, cycleProgress);

    // Minimap (small corner)
    renderMinimap(w, h);
  }

  function renderMinimap(canvasW, canvasH) {
    var mmW = 140;
    var mmH = 120;
    var mmX = canvasW - mmW - 10;
    var mmY = canvasH - mmH - 70; // above hotbar
    var scale = Math.min(mmW / window.MedMap.COLS, mmH / window.MedMap.ROWS);

    // Background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.7)';
    ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
    ctx.strokeStyle = 'rgba(201, 169, 89, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);

    // Tiles (simplified)
    var MINICOLORS = {};
    MINICOLORS[window.MedTypes.MedTileType.FLOOR_STONE] = '#4a4a55';
    MINICOLORS[window.MedTypes.MedTileType.WALL_CASTLE] = '#2a2a35';
    MINICOLORS[window.MedTypes.MedTileType.FLOOR_WOOD] = '#6d5a3a';
    MINICOLORS[window.MedTypes.MedTileType.FLOOR_DIRT] = '#6b5e3a';
    MINICOLORS[window.MedTypes.MedTileType.FLOOR_GRASS] = '#3a5a2a';
    MINICOLORS[window.MedTypes.MedTileType.FLOOR_WATER] = '#2a4a6a';
    MINICOLORS[window.MedTypes.MedTileType.WALL_TOWER] = '#1e1e28';

    for (var r = 0; r < tileMap.length; r++) {
      for (var c = 0; c < tileMap[r].length; c++) {
        var tile = tileMap[r][c];
        var color = MINICOLORS[tile];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(mmX + c * scale, mmY + r * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
    }

    // Agent dots
    characters.forEach(function (ch) {
      var mx = mmX + (ch.x / TILE) * scale;
      var my = mmY + (ch.y / TILE) * scale;
      ctx.fillStyle = ch.isActive ? '#4ade80' : '#c9a959';
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Viewport rect
    var vpLeft = (camera.x / (TILE * camera.zoom)) * scale;
    var vpTop = (camera.y / (TILE * camera.zoom)) * scale;
    var vpW = (canvas.width / (TILE * camera.zoom)) * scale;
    var vpH = (canvas.height / (TILE * camera.zoom)) * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX + vpLeft, mmY + vpTop, vpW, vpH);
  }

  // ── Input ──

  function setupInput() {
    // Mouse drag for camera pan
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) {
        isDragging = true;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        cameraStart.x = camera.x;
        cameraStart.y = camera.y;
      }
    });

    window.addEventListener('mousemove', function (e) {
      if (isDragging) {
        camera.x = cameraStart.x - (e.clientX - dragStart.x);
        camera.y = cameraStart.y - (e.clientY - dragStart.y);
        targetCamera.x = camera.x;
        targetCamera.y = camera.y;
      }

      // Hover detection
      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left + camera.x) / camera.zoom;
      var my = (e.clientY - rect.top + camera.y) / camera.zoom;
      hoveredAgent = null;
      characters.forEach(function (ch, id) {
        var dx = mx - ch.x;
        var dy = my - ch.y;
        if (Math.sqrt(dx * dx + dy * dy) < TILE * 0.7) {
          hoveredAgent = id;
        }
      });
      canvas.style.cursor = hoveredAgent ? 'pointer' : 'grab';
    });

    window.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
      }
    });

    // Click to select agent
    canvas.addEventListener('click', function (e) {
      if (Math.abs(e.clientX - dragStart.x) > 5 || Math.abs(e.clientY - dragStart.y) > 5) return; // was drag

      var rect = canvas.getBoundingClientRect();
      var mx = (e.clientX - rect.left + camera.x) / camera.zoom;
      var my = (e.clientY - rect.top + camera.y) / camera.zoom;

      var clicked = null;
      var minDist = TILE * 0.7;
      characters.forEach(function (ch, id) {
        var dx = mx - ch.x;
        var dy = my - ch.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) {
          minDist = d;
          clicked = id;
        }
      });

      if (clicked) {
        selectAgentById(clicked);
      } else {
        selectedAgent = null;
        window.castleApp.selectedAgent = null;
        // Check zone click for panels
        var tileRow = Math.floor(my / TILE);
        var tileCol = Math.floor(mx / TILE);
        var zone = window.MedMap.getZoneAt(tileRow, tileCol);
        if (zone) {
          var zoneInfo = window.MedTypes.ZONES[zone];
          if (zoneInfo && typeof window.openBuildingPanel === 'function') {
            window.openBuildingPanel(zoneInfo.emoji + ' ' + zoneInfo.name);
          }
        }
      }
    });

    // Scroll to zoom
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? -0.15 : 0.15;
      targetCamera.zoom = Math.max(0.8, Math.min(4, camera.zoom + delta));

      // Zoom toward cursor
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var worldX = (mx + camera.x) / camera.zoom;
      var worldY = (my + camera.y) / camera.zoom;
      targetCamera.x = worldX * targetCamera.zoom - mx;
      targetCamera.y = worldY * targetCamera.zoom - my;
    }, { passive: false });

    // Touch support
    var touches = {};
    var lastPinchDist = 0;

    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        dragStart.x = e.touches[0].clientX;
        dragStart.y = e.touches[0].clientY;
        cameraStart.x = camera.x;
        cameraStart.y = camera.y;
      } else if (e.touches.length === 2) {
        isDragging = false;
        var dx = e.touches[1].clientX - e.touches[0].clientX;
        var dy = e.touches[1].clientY - e.touches[0].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        camera.x = cameraStart.x - (e.touches[0].clientX - dragStart.x);
        camera.y = cameraStart.y - (e.touches[0].clientY - dragStart.y);
        targetCamera.x = camera.x;
        targetCamera.y = camera.y;
      } else if (e.touches.length === 2) {
        var dx = e.touches[1].clientX - e.touches[0].clientX;
        var dy = e.touches[1].clientY - e.touches[0].clientY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist > 0) {
          var scale = dist / lastPinchDist;
          targetCamera.zoom = Math.max(0.8, Math.min(4, camera.zoom * scale));
        }
        lastPinchDist = dist;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function () {
      isDragging = false;
      lastPinchDist = 0;
    });
  }

  // ── Data bridge ──

  function fetchData() {
    // Use the current server for session data (SpawnKit server on 8765)
    var baseUrl = window.location.origin;
    var relayUrl = window.OC_RELAY_URL || 'http://127.0.0.1:18790';
    var token = window.OC_RELAY_TOKEN || localStorage.getItem('spawnkit-token') || '';
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    // Fetch sessions from the current SpawnKit server
    fetch(baseUrl + '/api/oc/sessions', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        sessions = Array.isArray(data) ? data : (data.sessions || []);
        syncAgentsWithSessions();
      })
      .catch(function () { /* silent */ });
  }

  function syncAgentsWithSessions() {
    // Calculate real KPIs from session data
    var agentKPIs = calculateAgentKPIs(sessions);

    // Mark all agents inactive
    characters.forEach(function (ch) {
      ch.isActive = false;
      ch.toolStatus = null;
    });

    sessions.forEach(function (s) {
      var label = (s.label || s.displayName || s.key || '').toLowerCase();
      var matched = false;

      // Try to match session to known agent
      characters.forEach(function (ch) {
        if (label.indexOf(ch.id) >= 0 || label.indexOf(ch.name.toLowerCase()) >= 0) {
          ch.isActive = true;
          ch.toolStatus = s.model ? ('🔮 ' + s.model.split('/').pop()) : null;
          
          // Apply real KPI data instead of simple energy boost
          var kpi = agentKPIs[ch.id];
          if (kpi) {
            ch.mood = kpi.mood / 100; // Convert 0-100 to 0-1
            ch.energy = kpi.energy / 100; // Convert 0-100 to 0-1
            ch.trust = kpi.trust;
            ch.conscience = kpi.conscience;
          }
          matched = true;
        }
      });

      // Sub-agent sessions: spawn temporary knights
      if (!matched && s.kind === 'subagent' && s.status === 'active') {
        var subId = 'sub-' + (s.key || s.label || Math.random().toString(36).slice(2, 8));
        if (!characters.has(subId)) {
          var ch = spawnAgent(subId, s.label || 'Knight', Math.floor(Math.random() * 6), true);
          ch.isActive = true;
          ch.toolStatus = s.model ? ('⚔️ ' + s.model.split('/').pop()) : '⚔️ On quest';
          
          // Apply KPI for sub-agents too
          var agentId = mapSessionToAgent(s);
          var kpi = agentKPIs[agentId];
          if (kpi) {
            ch.mood = kpi.mood / 100;
            ch.energy = kpi.energy / 100;
            ch.trust = kpi.trust;
            ch.conscience = kpi.conscience;
          }
        }
      }
    });

    // Update KPIs for idle agents (not in active sessions)
    characters.forEach(function (ch) {
      if (!ch.isActive) {
        var kpi = agentKPIs[ch.id];
        if (kpi) {
          ch.mood = kpi.mood / 100;
          ch.energy = kpi.energy / 100;
          ch.trust = kpi.trust;
          ch.conscience = kpi.conscience;
        }
      }
    });

    // Remove stale sub-agents
    var toRemove = [];
    characters.forEach(function (ch, id) {
      if (ch.isSubAgent && !ch.isActive) {
        toRemove.push(id);
      }
    });
    toRemove.forEach(function (id) { removeAgent(id); });

    // Dispatch update event
    document.dispatchEvent(new CustomEvent('agents:updated', { detail: { sessions: sessions } }));
  }

  // ── KPI Calculation Functions ──

  function calculateAgentKPIs(sessionData) {
    if (!Array.isArray(sessionData)) {
      return {};
    }

    var now = Date.now();
    var kpis = {};

    // Initialize core agents with default values
    var DEFAULT_AGENTS = ['sycopa', 'forge', 'atlas', 'hunter', 'echo', 'sentinel'];
    DEFAULT_AGENTS.forEach(function (agentId) {
      kpis[agentId] = {
        mood: 50,      // Neutral mood baseline
        energy: 30,    // Low energy when idle
        trust: 3,      // Moderate trust baseline  
        conscience: 'dutiful'
      };
    });

    // Process each session
    sessionData.forEach(function (session) {
      var agentId = mapSessionToAgent(session);
      if (!agentId) return;

      // Initialize agent if not exists
      if (!kpis[agentId]) {
        kpis[agentId] = {
          mood: 50,
          energy: 30,
          trust: 3,
          conscience: 'dutiful'
        };
      }

      // Calculate activity metrics
      var activityMetrics = calculateActivityMetrics(session, now);
      var errorMetrics = calculateErrorMetrics(session);
      var trustMetrics = calculateTrustMetrics(session, activityMetrics);
      
      // Apply KPI formulas
      kpis[agentId].mood = calculateMood(activityMetrics, errorMetrics);
      kpis[agentId].energy = calculateEnergy(activityMetrics, errorMetrics, now);
      kpis[agentId].trust = calculateTrust(trustMetrics, activityMetrics);
      kpis[agentId].conscience = calculateConscience(session, activityMetrics);
    });

    return kpis;
  }

  function mapSessionToAgent(session) {
    var label = (session.label || session.displayName || session.key || '').toLowerCase();
    var key = session.key || '';

    // Direct agent name matching
    var directMatch = ['sycopa', 'forge', 'atlas', 'hunter', 'echo', 'sentinel']
      .find(function (agent) { return label.indexOf(agent) >= 0 || key.indexOf(agent) >= 0; });
    
    if (directMatch) return directMatch;

    // Main session maps to sycopa
    if (key === 'agent:main:main' || session.kind === 'main') {
      return 'sycopa';
    }

    // Action-based mapping for sub-agents
    var action = session.action || 'idle';
    switch (action) {
      case 'coding':
      case 'debugging':
        return 'forge';
      case 'reviewing':
      case 'researching':
        return 'atlas';
      case 'planning':
        return 'sycopa';
      case 'communicating':
        return 'echo';
      case 'guarding':
        return 'sentinel';
      case 'deploying':
        return 'hunter';
      default:
        return 'atlas';
    }
  }

  function calculateActivityMetrics(session, now) {
    var lastActive = session.lastActive || 0;
    var idleTime = now - lastActive;
    var totalTokens = session.totalTokens || 0;
    var isActive = session.status === 'active';
    
    var activityLevel = 'LOW';
    if (isActive && idleTime < 5 * 60 * 1000) { // Active within 5 minutes
      activityLevel = totalTokens > 1000 ? 'HIGH' : 'MEDIUM';
    } else if (idleTime < 30 * 60 * 1000) { // Active within 30 minutes
      activityLevel = 'MEDIUM';
    }

    return {
      activityLevel: activityLevel,
      idleMinutes: Math.floor(idleTime / (60 * 1000)),
      totalTokens: totalTokens,
      isActive: isActive,
      tokensPerHour: calculateTokensPerHour(session, now)
    };
  }

  function calculateTokensPerHour(session, now) {
    var lastActive = session.lastActive || now;
    var hoursSinceActive = Math.max(1, (now - lastActive) / (60 * 60 * 1000));
    return Math.floor((session.totalTokens || 0) / hoursSinceActive);
  }

  function calculateErrorMetrics(session) {
    var action = session.action || 'idle';
    var label = (session.label || '').toLowerCase();
    
    var hasErrors = action === 'debugging' || 
      label.indexOf('error') >= 0 || 
      label.indexOf('debug') >= 0 || 
      label.indexOf('fix') >= 0 ||
      label.indexOf('broken') >= 0;

    var errorRate = hasErrors ? 0.3 : 0.05;
    
    return {
      hasErrors: hasErrors,
      errorRate: errorRate,
      errorState: action === 'debugging'
    };
  }

  function calculateTrustMetrics(session, activityMetrics) {
    var completionHeuristic = activityMetrics.totalTokens > 500 ? 0.8 : 0.6;
    var consistencyScore = activityMetrics.isActive ? 1.0 : 0.7;
    
    return {
      completionHeuristic: completionHeuristic,
      consistencyScore: consistencyScore,
      reliability: (completionHeuristic + consistencyScore) / 2
    };
  }

  function calculateMood(activityMetrics, errorMetrics) {
    var activityLevel = activityMetrics.activityLevel;
    var hasErrors = errorMetrics.hasErrors;
    var errorRate = errorMetrics.errorRate;

    var baseMood = 50;

    switch (activityLevel) {
      case 'HIGH':
        if (!hasErrors || errorRate < 0.1) {
          baseMood = 80 + Math.random() * 15; // High mood (80-95%)
        } else {
          baseMood = 30 + Math.random() * 20; // Stressed mood (30-50%)
        }
        break;
      case 'MEDIUM':
        baseMood = 60 + Math.random() * 20; // Focused mood (60-80%)
        break;
      case 'LOW':
        if (activityMetrics.idleMinutes > 30) {
          baseMood = 20 + Math.random() * 20; // Bored mood (20-40%)
        } else {
          baseMood = 40 + Math.random() * 20; // Slightly bored (40-60%)
        }
        break;
    }

    return Math.round(Math.max(0, Math.min(100, baseMood)));
  }

  function calculateEnergy(activityMetrics, errorMetrics, now) {
    var idleMinutes = activityMetrics.idleMinutes;
    var isActive = activityMetrics.isActive;
    var errorState = errorMetrics.errorState;

    var baseEnergy = 50;

    if (errorState) {
      baseEnergy = 5 + Math.random() * 15; // Error state = Depleted energy (5-20%)
    } else if (isActive && idleMinutes < 10) {
      baseEnergy = 80 + Math.random() * 20; // Recent activity = High energy (80-100%)
    } else if (idleMinutes >= 10 && idleMinutes <= 30) {
      baseEnergy = 40 + Math.random() * 30; // Idle 10-30min = Medium energy (40-70%)
    } else if (idleMinutes > 30) {
      baseEnergy = 10 + Math.random() * 20; // Idle >30min = Low energy (10-30%)
    }

    return Math.round(Math.max(0, Math.min(100, baseEnergy)));
  }

  function calculateTrust(trustMetrics, activityMetrics) {
    var reliability = trustMetrics.reliability;
    var totalTokens = activityMetrics.totalTokens;

    var trustScore = Math.floor(reliability * 5);
    
    if (totalTokens > 5000) {
      trustScore = Math.min(5, trustScore + 1);
    }

    if (activityMetrics.isActive && trustScore < 1) {
      trustScore = 1;
    }

    return Math.max(0, Math.min(5, trustScore));
  }

  function calculateConscience(session, activityMetrics) {
    var action = session.action || 'idle';
    var label = (session.label || '').toLowerCase();
    var activityLevel = activityMetrics.activityLevel;

    if (action === 'planning' || action === 'reviewing' || label.indexOf('systematic') >= 0) {
      return 'dutiful';
    }
    
    if (activityLevel === 'HIGH' && (action === 'coding' || action === 'researching')) {
      return 'independent';
    }
    
    if (action === 'debugging' || label.indexOf('emergency') >= 0 || label.indexOf('hotfix') >= 0) {
      return 'chaotic';
    }

    return 'dutiful';
  }

  // ── Resize ──

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // ── Main loop ──

  function loop() {
    frameCount++;
    animFrame = Math.floor(frameCount / 8) % 4;

    // Smooth camera interpolation
    camera.x += (targetCamera.x - camera.x) * 0.12;
    camera.y += (targetCamera.y - camera.y) * 0.12;
    camera.zoom += (targetCamera.zoom - camera.zoom) * 0.12;

    updateCharacters();
    render();
    requestAnimationFrame(loop);
  }

  // ── Boot ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
