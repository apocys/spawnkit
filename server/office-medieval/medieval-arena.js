/**
 * 🏟️ Medieval Arena — Frontend Client
 * ════════════════════════════════════
 * Renders the Arena panel in the medieval building panel system.
 * Features:
 *   - 3D coliseum built with Three.js (uses existing castleApp.scene)
 *   - Live battle status with round-by-round updates
 *   - Champion cards with lore + stats
 *   - Leaderboard + battle history
 *   - WS-driven crowd roar meter & particle effects
 *   - Challenge UI (callable from any peer)
 *
 * Depends on: medieval-panels.js, medieval-peering-ws.js
 * Adds: window.MedievalArena
 * Panel key: '🏟️ Arena'
 *
 * @author Sycopa 🎭
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ── Constants ────────────────────────────────────────────────

  var FLEET_BASE = (function() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:18790';
    }
    return window.location.protocol + '//fleet.spawnkit.ai';
  })();

  var FLEET_TOKEN = 'sk-fleet-2ad53564b03d9facbe3389bb5c461179ffc73af12e50ae00';

  var COLORS = {
    gold:      '#c9a959',
    goldDim:   'rgba(201,169,89,0.15)',
    goldBorder:'rgba(201,169,89,0.4)',
    parchment: '#f4e4bc',
    stone:     'rgba(168,162,153,0.5)',
    stoneDim:  'rgba(168,162,153,0.15)',
    stoneBorder:'rgba(168,162,153,0.2)',
    navy:      'rgba(22,33,62,0.8)',
    sycopa:    '#c9a959',
    apomac:    '#4fc3f7',
    win:       '#4caf50',
    loss:      '#f44336',
    draw:      '#ff9800',
  };

  // ── CSS ──────────────────────────────────────────────────────

  (function injectCSS() {
    var s = document.createElement('style');
    s.textContent = `
      .ar-root { font-family: "Crimson Text", Georgia, serif; color: ${COLORS.parchment}; }
      .ar-tabs  { display:flex; gap:4px; margin-bottom:12px; }
      .ar-tab   { flex:1; padding:6px 8px; background:${COLORS.goldDim}; border:1px solid ${COLORS.goldBorder};
                  border-radius:6px; cursor:pointer; font-size:12px; color:${COLORS.gold}; text-align:center;
                  transition:all .2s; }
      .ar-tab:hover, .ar-tab.active { background:rgba(201,169,89,0.25); border-color:rgba(201,169,89,0.7); }

      .ar-champ-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
      .ar-champ-card { background:rgba(22,33,62,0.7); border-radius:10px; padding:14px;
                       border:1px solid rgba(168,162,153,0.2); text-align:center; transition:border-color .3s; }
      .ar-champ-card:hover { border-color:rgba(201,169,89,0.4); }
      .ar-champ-emoji { font-size:36px; margin-bottom:4px; }
      .ar-champ-name  { font-size:14px; color:${COLORS.gold}; font-weight:600; }
      .ar-champ-title { font-size:10px; color:${COLORS.stone}; font-style:italic; margin-bottom:6px; }
      .ar-champ-stat  { display:flex; justify-content:space-between; font-size:11px; color:${COLORS.stone}; padding:2px 0; }
      .ar-champ-stat strong { color:${COLORS.parchment}; }

      .ar-battle-box { background:rgba(22,33,62,0.8); border:1px solid rgba(201,169,89,0.3);
                       border-radius:10px; padding:14px; margin-bottom:10px; }
      .ar-battle-title { font-size:13px; color:${COLORS.gold}; margin-bottom:4px; font-weight:600; }
      .ar-battle-task  { font-size:11px; color:${COLORS.stone}; margin-bottom:10px; font-style:italic; }
      .ar-battle-vs    { display:flex; align-items:center; justify-content:space-around; margin:10px 0; }
      .ar-battle-fighter { text-align:center; }
      .ar-battle-fighter .emoji { font-size:28px; }
      .ar-battle-fighter .name  { font-size:11px; color:${COLORS.stone}; }
      .ar-vs-badge { font-size:18px; color:rgba(201,169,89,0.7); font-weight:bold; }

      .ar-crowd { margin:10px 0; }
      .ar-crowd-label { font-size:10px; color:${COLORS.stone}; margin-bottom:3px; }
      .ar-crowd-bar { height:6px; background:rgba(168,162,153,0.15); border-radius:3px; overflow:hidden; }
      .ar-crowd-fill { height:100%; border-radius:3px; transition:width .5s cubic-bezier(.34,1.56,.64,1);
                       background:linear-gradient(90deg,#c9a959,#ff9800,#f44336); }

      .ar-score-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:8px 0; }
      .ar-score-cell { background:rgba(22,33,62,0.6); border-radius:6px; padding:8px; text-align:center; }
      .ar-score-dim  { font-size:9px; color:${COLORS.stone}; text-transform:uppercase; letter-spacing:.5px; }
      .ar-score-val  { font-size:18px; font-weight:bold; }
      .ar-score-val.sycopa { color:${COLORS.sycopa}; }
      .ar-score-val.apomac { color:${COLORS.apomac}; }

      .ar-verdict { text-align:center; padding:16px; border-radius:10px; margin:10px 0;
                    background:rgba(22,33,62,0.9); border:1px solid rgba(201,169,89,0.5); }
      .ar-verdict-winner { font-size:24px; }
      .ar-verdict-title  { font-size:16px; color:${COLORS.gold}; margin:4px 0; }
      .ar-verdict-scores { font-size:12px; color:${COLORS.stone}; }

      .ar-lb-row { display:flex; align-items:center; justify-content:space-between;
                   padding:8px; margin-bottom:6px; border-radius:8px; background:rgba(22,33,62,0.5);
                   border:1px solid rgba(168,162,153,0.15); }
      .ar-lb-rank { font-size:18px; width:28px; text-align:center; }
      .ar-lb-name { flex:1; padding:0 8px; }
      .ar-lb-name strong { display:block; font-size:13px; color:${COLORS.gold}; }
      .ar-lb-name span   { font-size:10px; color:${COLORS.stone}; }
      .ar-lb-pts  { font-size:16px; font-weight:bold; color:${COLORS.parchment}; }
      .ar-lb-streak { font-size:11px; padding:2px 6px; border-radius:4px; margin-left:6px; }
      .ar-lb-streak.hot  { background:rgba(244,67,54,0.2); color:#f44336; }
      .ar-lb-streak.cold { background:rgba(66,165,245,0.2); color:#42a5f5; }

      .ar-battle-hist { padding:8px; margin-bottom:6px; border-radius:8px;
                        background:rgba(22,33,62,0.5); border:1px solid rgba(168,162,153,0.1); }
      .ar-battle-hist-top { display:flex; justify-content:space-between; align-items:center; }
      .ar-battle-hist-title { font-size:12px; color:${COLORS.parchment}; }
      .ar-battle-hist-date  { font-size:10px; color:${COLORS.stone}; }
      .ar-battle-hist-winner { font-size:10px; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block; }
      .ar-battle-hist-winner.sycopa { background:rgba(201,169,89,0.2); color:${COLORS.sycopa}; }
      .ar-battle-hist-winner.apomac { background:rgba(79,195,247,0.2); color:${COLORS.apomac}; }
      .ar-battle-hist-winner.draw   { background:rgba(255,152,0,0.2);  color:${COLORS.draw}; }

      .ar-form-group { margin-bottom:10px; }
      .ar-form-label { font-size:11px; color:${COLORS.stone}; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; display:block; }
      .ar-form-select, .ar-form-textarea, .ar-form-input {
        width:100%; box-sizing:border-box; padding:8px; border-radius:6px; font-size:13px;
        background:rgba(15,52,96,0.6); border:1px solid rgba(168,162,153,0.3);
        color:${COLORS.parchment}; font-family:inherit;
      }
      .ar-form-select:focus, .ar-form-textarea:focus, .ar-form-input:focus {
        outline:none; border-color:rgba(201,169,89,0.5);
      }
      .ar-form-textarea { resize:vertical; min-height:80px; }
      .ar-form-select option { background:#16213e; }

      .ar-btn { display:inline-block; padding:8px 18px; border-radius:7px; cursor:pointer;
                font-size:13px; font-family:inherit; transition:all .2s; text-align:center; }
      .ar-btn-gold { background:rgba(201,169,89,0.2); border:1px solid rgba(201,169,89,0.5);
                     color:${COLORS.gold}; }
      .ar-btn-gold:hover { background:rgba(201,169,89,0.35); transform:translateY(-1px); }
      .ar-btn-red  { background:rgba(244,67,54,0.15); border:1px solid rgba(244,67,54,0.4); color:#f44336; }
      .ar-btn-red:hover { background:rgba(244,67,54,0.25); }
      .ar-btn-full { width:100%; box-sizing:border-box; }
      .ar-btn-disabled { opacity:.4; cursor:not-allowed; pointer-events:none; }

      .ar-portal { display:flex; align-items:center; gap:8px; padding:10px;
                   border-radius:8px; background:linear-gradient(135deg, rgba(79,195,247,0.1), rgba(201,169,89,0.1));
                   border:1px solid rgba(168,162,153,0.2); margin-bottom:10px; }
      .ar-portal-icon { font-size:22px; }
      .ar-portal-text strong { display:block; font-size:12px; color:${COLORS.parchment}; }
      .ar-portal-text span   { font-size:10px; color:${COLORS.stone}; }

      .ar-empty { text-align:center; padding:24px; color:${COLORS.stone}; font-style:italic; font-size:13px; }
      .ar-section-title { font-size:13px; color:rgba(201,169,89,0.9); text-transform:uppercase;
                          letter-spacing:.5px; margin:14px 0 8px; border-bottom:1px solid rgba(168,162,153,0.15); padding-bottom:4px; }
      .ar-badge { display:inline-block; padding:2px 7px; border-radius:4px; font-size:10px; margin-left:4px; }
      .ar-badge-live { background:rgba(244,67,54,0.2); color:#f44336; animation:ar-pulse 1.5s infinite; }
      .ar-badge-done { background:rgba(76,175,80,0.2); color:#4caf50; }
      @keyframes ar-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    `;
    document.head.appendChild(s);
  })();

  // ── API Helpers ──────────────────────────────────────────────

  function arenaFetch(path, opts) {
    return fetch(FLEET_BASE + path, Object.assign({
      headers: {
        'Authorization': 'Bearer ' + FLEET_TOKEN,
        'Content-Type': 'application/json',
      },
    }, opts || {})).then(function(r) { return r.json(); });
  }

  function arenaGet(path) {
    return arenaFetch(path);
  }

  function arenaPost(path, data) {
    return arenaFetch(path, { method: 'POST', body: JSON.stringify(data) });
  }

  // ── State ────────────────────────────────────────────────────

  var _state = null;
  var _activeTab = 'battle'; // 'battle' | 'leaderboard' | 'history' | 'challenge'
  var _container = null;
  var _crowdAnimId = null;

  // ── WS Integration ───────────────────────────────────────────

  // Listen for arena events on the existing fleet WS
  function onFleetMessage(type, data) {
    if (!type.startsWith('arena:')) return;
    if (_container) {
      _loadStateAndRender();
    }
    if (type === 'arena:verdict') {
      _triggerFireworks(data.winner);
    }
  }

  // Hook into the existing WS if available
  function hookWS() {
    var origOnMessage = null;
    var checkInterval = setInterval(function() {
      if (window._fleetWS && window._fleetWS.onmessage !== _wsHook) {
        origOnMessage = window._fleetWS.onmessage;
        window._fleetWS.onmessage = _wsHook;
        clearInterval(checkInterval);
      }
    }, 1000);

    function _wsHook(evt) {
      try {
        var d = JSON.parse(evt.data);
        onFleetMessage(d.type, d);
      } catch(e) {}
      if (origOnMessage) origOnMessage(evt);
    }
  }

  hookWS();

  // ── 3D Coliseum ──────────────────────────────────────────────

  var _coliseumBuilt = false;
  var _coliseumGroup = null;

  function buildColiseum(scene, THREE) {
    if (_coliseumBuilt) return;
    _coliseumBuilt = true;

    var group = new THREE.Group();
    group.name = 'arena_coliseum';

    // Materials
    var stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355, roughness: 0.9, metalness: 0.05,
    });
    var sandMat = new THREE.MeshStandardMaterial({
      color: 0xc8a96a, roughness: 1.0,
    });
    var torchMat = new THREE.MeshStandardMaterial({
      color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.0, roughness: 0.3,
    });

    // Arena floor (sand)
    var floorGeo = new THREE.CylinderGeometry(9, 9, 0.3, 32);
    var floor = new THREE.Mesh(floorGeo, sandMat);
    floor.receiveShadow = true;
    group.add(floor);

    // Coliseum walls — stacked ring segments
    for (var ring = 0; ring < 4; ring++) {
      var r = 10.5 + ring * 1.1;
      var h = 1.8 - ring * 0.2;
      var y = 0.15 + ring * 1.5;
      var wallGeo = new THREE.TorusGeometry(r, 0.5, 6, 48);
      var wall = new THREE.Mesh(wallGeo, stoneMat);
      wall.rotation.x = Math.PI / 2;
      wall.position.y = y;
      wall.castShadow = true;
      group.add(wall);

      // Pillars every ~30 degrees
      var pillarCount = Math.floor(r * 1.5);
      for (var p = 0; p < pillarCount; p++) {
        var angle = (p / pillarCount) * Math.PI * 2;
        var px = Math.cos(angle) * r;
        var pz = Math.sin(angle) * r;
        var pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, h, 8);
        var pillar = new THREE.Mesh(pillarGeo, stoneMat);
        pillar.position.set(px, y, pz);
        pillar.castShadow = true;
        group.add(pillar);
      }
    }

    // Portal — Sycopa side (golden)
    _buildPortal(group, THREE, -11, 0, 0, 0xc9a959, 'sycopa');
    // Portal — ApoMac side (cyan)
    _buildPortal(group, THREE, 11, 0, 0, 0x4fc3f7, 'apomac');

    // Central combat platform
    var platGeo = new THREE.CylinderGeometry(2.5, 2.8, 0.5, 16);
    var platMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 });
    var plat = new THREE.Mesh(platGeo, platMat);
    plat.position.y = 0.4;
    plat.castShadow = true;
    group.add(plat);

    // Torches x4
    [[8, 0], [-8, 0], [0, 8], [0, -8]].forEach(function(pos) {
      var stickGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
      var stickMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
      var stick = new THREE.Mesh(stickGeo, stickMat);
      stick.position.set(pos[0], 1.1, pos[1]);
      group.add(stick);

      var flameGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
      var flame = new THREE.Mesh(flameGeo, torchMat);
      flame.position.set(pos[0], 2.0, pos[1]);
      group.add(flame);

      var light = new THREE.PointLight(0xff6600, 0.8, 8);
      light.position.set(pos[0], 2.1, pos[1]);
      group.add(light);
    });

    // Position the whole coliseum at a distinct location in the world
    // Place it between the two village areas, slightly to the north
    group.position.set(0, 0, -28);
    group.name = 'arena_coliseum';

    scene.add(group);
    _coliseumGroup = group;

    // Animate torch flicker
    _animateTorches(group, THREE);

    return group;
  }

  function _buildPortal(parent, THREE, x, y, z, color, id) {
    // Portal arch
    var archMat = new THREE.MeshStandardMaterial({
      color: color, emissive: color, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.3,
    });
    var torusGeo = new THREE.TorusGeometry(1.2, 0.18, 12, 32, Math.PI);
    var arch = new THREE.Mesh(torusGeo, archMat);
    arch.rotation.z = Math.PI;
    arch.position.set(x, y + 1.5, z);
    arch.name = 'portal_' + id;
    parent.add(arch);

    // Portal glow disc
    var discGeo = new THREE.CircleGeometry(1.0, 32);
    var discMat = new THREE.MeshStandardMaterial({
      color: color, transparent: true, opacity: 0.18, side: 2,
      emissive: color, emissiveIntensity: 0.6,
    });
    var disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.y = Math.PI / 2;
    disc.position.set(x + (x > 0 ? -0.1 : 0.1), y + 1.5, z);
    parent.add(disc);

    // Portal light
    var light = new THREE.PointLight(color, 1.2, 10);
    light.position.set(x, y + 1.5, z);
    parent.add(light);
  }

  function _animateTorches(group, THREE) {
    var t = 0;
    function tick() {
      t += 0.05;
      group.children.forEach(function(child) {
        if (child.isPointLight && child.color.r > 0.9) {
          child.intensity = 0.7 + Math.sin(t * 3.7 + child.position.x) * 0.15;
        }
      });
      requestAnimationFrame(tick);
    }
    tick();
  }

  function _triggerFireworks(winner) {
    if (!window.MedievalParticles) return;
    var color = winner === 'sycopa' ? '#c9a959' : winner === 'apomac' ? '#4fc3f7' : '#ff9800';
    for (var i = 0; i < 8; i++) {
      setTimeout(function() {
        if (window.MedievalParticles && window.MedievalParticles.burst) {
          window.MedievalParticles.burst({ color: color, x: (Math.random()-0.5)*20, z: -28 + (Math.random()-0.5)*10 });
        }
      }, i * 200);
    }
  }

  // Try to mount the coliseum on the scene
  function tryMountColiseum() {
    var app = window.castleApp;
    var THREE = window.THREE;
    if (!app || !app.scene || !THREE) {
      setTimeout(tryMountColiseum, 1000);
      return;
    }
    buildColiseum(app.scene, THREE);
  }
  setTimeout(tryMountColiseum, 3000);

  // ── Render Functions ─────────────────────────────────────────

  function renderArena(container) {
    _container = container;
    _loadStateAndRender();
  }

  function _loadStateAndRender() {
    arenaGet('/api/arena/state').then(function(res) {
      if (res && res.ok) {
        _state = res.data;
        _render();
      } else {
        _renderError('Could not reach the Arena relay.');
      }
    }).catch(function() {
      _renderError('Arena engine offline. Is the fleet relay running?');
    });
  }

  function _renderError(msg) {
    if (!_container) return;
    _container.innerHTML = '<div class="ar-empty">⚔️ ' + msg + '</div>';
  }

  function _render() {
    if (!_container || !_state) return;

    var html = '<div class="ar-root">';

    // Portal banner
    html += '<div class="ar-portal">';
    html += '<span class="ar-portal-icon">🌀</span>';
    html += '<div class="ar-portal-text"><strong>The Arena Portal</strong><span>Champions converge between the two kingdoms</span></div>';
    html += '</div>';

    // Tabs
    html += '<div class="ar-tabs">';
    ['battle', 'leaderboard', 'history', 'challenge'].forEach(function(tab) {
      var labels = { battle:'⚔️ Battle', leaderboard:'🏆 Board', history:'📜 History', challenge:'🥊 Challenge' };
      html += '<div class="ar-tab' + (tab === _activeTab ? ' active' : '') + '" data-tab="' + tab + '">' + labels[tab] + '</div>';
    });
    html += '</div>';

    // Tab content
    if (_activeTab === 'battle') html += _renderBattleTab();
    else if (_activeTab === 'leaderboard') html += _renderLeaderboardTab();
    else if (_activeTab === 'history') html += _renderHistoryTab();
    else if (_activeTab === 'challenge') html += _renderChallengeTab();

    html += '</div>';
    _container.innerHTML = html;
    _bindEvents();
  }

  function _renderBattleTab() {
    var html = '';
    var ab = _state.activeBattle;

    // Champions
    html += '<div class="ar-section-title">Champions</div>';
    html += '<div class="ar-champ-grid">';
    ['sycopa', 'apomac'].forEach(function(id) {
      var c = _state.champions[id] || {};
      var lb = _state.leaderboard[id] || {};
      html += '<div class="ar-champ-card">';
      html += '<div class="ar-champ-emoji">' + (c.emoji || '?') + '</div>';
      html += '<div class="ar-champ-name">' + (c.name || id) + '</div>';
      html += '<div class="ar-champ-title">' + (c.title || '') + '</div>';
      html += '<div class="ar-champ-stat"><span>W/L/D</span><strong>' + (lb.wins||0) + '/' + (lb.losses||0) + '/' + (lb.draws||0) + '</strong></div>';
      html += '<div class="ar-champ-stat"><span>Points</span><strong>' + (lb.points||0) + '</strong></div>';
      if (lb.streak && Math.abs(lb.streak) >= 2) {
        var streakLabel = lb.streak > 0 ? '🔥 ' + lb.streak + ' streak' : '❄️ ' + Math.abs(lb.streak) + ' cold';
        html += '<div class="ar-champ-stat"><span></span><strong>' + streakLabel + '</strong></div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // Active battle
    if (ab) {
      html += '<div class="ar-section-title">Active Battle <span class="ar-badge ar-badge-live">LIVE</span></div>';
      html += _renderActiveBattle(ab);
    } else {
      html += '<div class="ar-empty">No battle in progress. Use the Challenge tab to send a champion! ⚔️</div>';
    }

    return html;
  }

  function _renderActiveBattle(ab) {
    var tmpl = (ab.templateMeta || {});
    var html = '<div class="ar-battle-box">';
    html += '<div class="ar-battle-title">' + (tmpl.icon || '⚔️') + ' ' + (ab.title || 'Arena Battle') + '</div>';
    html += '<div class="ar-battle-task">"' + (ab.task || '').substring(0, 120) + (ab.task && ab.task.length > 120 ? '…' : '') + '"</div>';

    // VS
    html += '<div class="ar-battle-vs">';
    html += '<div class="ar-battle-fighter"><div class="emoji">🎭</div><div class="name">Sycopa</div></div>';
    html += '<div class="ar-vs-badge">VS</div>';
    html += '<div class="ar-battle-fighter"><div class="emoji">💻</div><div class="name">ApoMac</div></div>';
    html += '</div>';

    // Crowd roar
    var roar = ab.crowdRoar || 0;
    html += '<div class="ar-crowd">';
    html += '<div class="ar-crowd-label">🎺 Crowd Roar: ' + roar + '%</div>';
    html += '<div class="ar-crowd-bar"><div class="ar-crowd-fill" style="width:' + roar + '%"></div></div>';
    html += '</div>';

    // Status
    var statusEmoji = { challenged:'📯', accepted:'🔔', in_progress:'⚔️', scoring:'⚖️', done:'🏁' };
    html += '<div style="font-size:11px; color:' + COLORS.stone + '; margin-top:8px;">';
    html += (statusEmoji[ab.status] || '') + ' Status: <strong style="color:' + COLORS.parchment + '">' + (ab.status||'').replace('_',' ') + '</strong>';
    html += ' · Spectators: ' + (ab.spectators || 0);
    html += '</div>';

    // Rounds submitted
    if (ab.rounds && ab.rounds.length > 0) {
      html += '<div style="font-size:11px; color:' + COLORS.stone + '; margin-top:4px;">';
      var sRounds = ab.rounds.filter(function(r){ return r.combatant === 'sycopa'; }).length;
      var aRounds = ab.rounds.filter(function(r){ return r.combatant === 'apomac'; }).length;
      html += '🎭 Sycopa: ' + sRounds + ' round(s) · 💻 ApoMac: ' + aRounds + ' round(s)';
      html += '</div>';
    }

    // Scores if done
    if (ab.status === 'done' && ab.scores) {
      html += _renderVerdict(ab);
    }

    // Spectate button
    html += '<div style="margin-top:10px;">';
    html += '<button class="ar-btn ar-btn-gold ar-btn-full" data-action="spectate" data-battle-id="' + ab.id + '">👁 Join Crowd (+hype)</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _renderVerdict(battle) {
    var w = battle.winner;
    var sc = battle.scores || {};
    var sycopaScore = (sc.sycopa || {}).total || 0;
    var apomacScore = (sc.apomac || {}).total || 0;

    var winnerEmoji = w === 'sycopa' ? '🎭' : w === 'apomac' ? '💻' : '🤝';
    var winnerName  = w === 'draw' ? 'DRAW' : (w === 'sycopa' ? 'SYCOPA' : 'APOMAC');
    var bgColor = w === 'draw' ? 'rgba(255,152,0,0.1)' : w === 'sycopa' ? 'rgba(201,169,89,0.1)' : 'rgba(79,195,247,0.1)';

    var html = '<div class="ar-verdict" style="background:' + bgColor + '">';
    html += '<div class="ar-verdict-winner">' + winnerEmoji + '</div>';
    html += '<div class="ar-verdict-title">' + winnerName + ' WINS!</div>';
    html += '<div class="ar-verdict-scores">🎭 ' + sycopaScore.toFixed(2) + ' / 10  ·  💻 ' + apomacScore.toFixed(2) + ' / 10</div>';
    if (sc.judgeNotes) {
      html += '<div style="font-size:11px; color:' + COLORS.stone + '; margin-top:8px; font-style:italic;">"' + sc.judgeNotes + '"</div>';
    }
    html += '</div>';
    return html;
  }

  function _renderLeaderboardTab() {
    var html = '';
    var lb = _state.leaderboard || {};
    var entries = Object.entries(lb).sort(function(a, b) { return (b[1].points||0) - (a[1].points||0); });

    html += '<div class="ar-section-title">🏆 Hall of Champions</div>';
    entries.forEach(function(entry, i) {
      var id = entry[0], data = entry[1];
      var champion = _state.champions[id] || {};
      var rankEmoji = i === 0 ? '👑' : i === 1 ? '🥈' : '🥉';
      html += '<div class="ar-lb-row">';
      html += '<div class="ar-lb-rank">' + rankEmoji + '</div>';
      html += '<div class="ar-lb-name"><strong>' + (champion.emoji || '') + ' ' + (champion.name || id) + '</strong><span>' + (champion.title || '') + ' · ' + (data.wins||0) + 'W / ' + (data.losses||0) + 'L / ' + (data.draws||0) + 'D</span></div>';
      html += '<div style="text-align:right">';
      html += '<div class="ar-lb-pts">' + (data.points||0) + ' pts</div>';
      if (data.streak && Math.abs(data.streak) >= 2) {
        var cls = data.streak > 0 ? 'hot' : 'cold';
        var streakStr = data.streak > 0 ? '🔥' + data.streak : '❄️' + Math.abs(data.streak);
        html += '<span class="ar-lb-streak ' + cls + '">' + streakStr + '</span>';
      }
      html += '</div>';
      html += '</div>';
    });

    // Champion lore
    html += '<div class="ar-section-title">📜 Champion Lore</div>';
    Object.values(_state.champions || {}).forEach(function(c) {
      html += '<div style="margin-bottom:10px; padding:10px; background:rgba(22,33,62,0.5); border-radius:8px; border:1px solid rgba(168,162,153,0.15);">';
      html += '<div style="font-size:13px; color:' + COLORS.gold + ';">' + (c.emoji || '') + ' ' + (c.name || '') + ' — <em>' + (c.title || '') + '</em></div>';
      html += '<div style="font-size:11px; color:' + COLORS.stone + '; margin-top:4px;">' + (c.lore || '') + '</div>';
      if (c.signature_move) {
        html += '<div style="font-size:10px; color:rgba(201,169,89,0.7); margin-top:6px;">✨ ' + c.signature_move + '</div>';
      }
      html += '</div>';
    });

    return html;
  }

  function _renderHistoryTab() {
    var html = '';
    var battles = _state.recentBattles || [];

    html += '<div class="ar-section-title">📜 Recent Battles</div>';
    if (battles.length === 0) {
      html += '<div class="ar-empty">No battles recorded yet. Step into the arena! ⚔️</div>';
    } else {
      battles.forEach(function(b) {
        var winnerClass = b.winner === 'draw' ? 'draw' : b.winner;
        var winnerLabel = b.winner === 'draw' ? '🤝 Draw' : (b.winner === 'sycopa' ? '🎭 Sycopa wins' : '💻 ApoMac wins');
        var tmpl = b.templateMeta || {};
        var date = b.finishedAt ? new Date(b.finishedAt).toLocaleDateString() : '?';
        html += '<div class="ar-battle-hist">';
        html += '<div class="ar-battle-hist-top">';
        html += '<div class="ar-battle-hist-title">' + (tmpl.icon || '⚔️') + ' ' + (b.title || 'Battle') + '</div>';
        html += '<div class="ar-battle-hist-date">' + date + '</div>';
        html += '</div>';
        html += '<span class="ar-battle-hist-winner ' + (winnerClass || 'draw') + '">' + winnerLabel + '</span>';
        if (b.scores) {
          var ss = (b.scores.sycopa || {}).total || 0;
          var as = (b.scores.apomac || {}).total || 0;
          html += '<span style="font-size:10px; color:' + COLORS.stone + '; margin-left:6px;">' + ss.toFixed(2) + ' vs ' + as.toFixed(2) + '</span>';
        }
        html += '</div>';
      });
    }

    return html;
  }

  function _renderChallengeTab() {
    var hasActive = !!_state.activeBattle;
    var html = '<div class="ar-section-title">⚔️ Send Your Champion</div>';

    if (hasActive) {
      html += '<div class="ar-empty">A battle is already in progress. Wait for it to finish before issuing a new challenge.</div>';
      return html;
    }

    html += '<div class="ar-form-group">';
    html += '<label class="ar-form-label">Challenger</label>';
    html += '<select class="ar-form-select" id="ar-challenger">';
    html += '<option value="sycopa">🎭 Sycopa (me)</option>';
    html += '<option value="apomac">💻 ApoMac</option>';
    html += '</select></div>';

    html += '<div class="ar-form-group">';
    html += '<label class="ar-form-label">Battle Type</label>';
    html += '<select class="ar-form-select" id="ar-template">';
    Object.values(_state.templates || {}).forEach(function(t) {
      html += '<option value="' + t.id + '">' + t.icon + ' ' + t.label + ' — ' + t.description + '</option>';
    });
    html += '</select></div>';

    html += '<div class="ar-form-group">';
    html += '<label class="ar-form-label">Title (optional)</label>';
    html += '<input class="ar-form-input" id="ar-title" placeholder="e.g. The Great Bug Hunt of March 2026">';
    html += '</div>';

    html += '<div class="ar-form-group">';
    html += '<label class="ar-form-label">Task (what must both champions do?)</label>';
    html += '<textarea class="ar-form-textarea" id="ar-task" placeholder="Describe the task clearly — both agents will receive the same prompt..."></textarea>';
    html += '</div>';

    html += '<button class="ar-btn ar-btn-gold ar-btn-full" data-action="challenge">⚔️ Issue Challenge!</button>';

    return html;
  }

  // ── Event Binding ────────────────────────────────────────────

  function _bindEvents() {
    if (!_container) return;

    // Tab switching
    _container.querySelectorAll('.ar-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        _activeTab = this.dataset.tab;
        _render();
      });
    });

    // Challenge submit
    var challengeBtn = _container.querySelector('[data-action="challenge"]');
    if (challengeBtn) {
      challengeBtn.addEventListener('click', function() {
        var challenger = (_container.querySelector('#ar-challenger') || {}).value || 'sycopa';
        var templateId = (_container.querySelector('#ar-template') || {}).value || 'code_fix';
        var title      = ((_container.querySelector('#ar-title') || {}).value || '').trim();
        var task       = ((_container.querySelector('#ar-task') || {}).value || '').trim();
        if (!task) { alert('Please enter a task for the champions!'); return; }
        challengeBtn.disabled = true;
        challengeBtn.textContent = '📯 Issuing challenge…';
        arenaPost('/api/arena/challenge', { challenger: challenger, templateId: templateId, title: title || undefined, task: task })
          .then(function(res) {
            if (res && res.ok) {
              _activeTab = 'battle';
              _loadStateAndRender();
            } else {
              alert('Error: ' + (res && res.error ? res.error : 'Unknown error'));
              challengeBtn.disabled = false;
              challengeBtn.textContent = '⚔️ Issue Challenge!';
            }
          }).catch(function(e) {
            alert('Network error: ' + e.message);
            challengeBtn.disabled = false;
            challengeBtn.textContent = '⚔️ Issue Challenge!';
          });
      });
    }

    // Spectate
    var spectateBtn = _container.querySelector('[data-action="spectate"]');
    if (spectateBtn) {
      spectateBtn.addEventListener('click', function() {
        var id = this.dataset.battleId;
        arenaPost('/api/arena/spectate', { battleId: id }).then(function() {
          _loadStateAndRender();
        });
      });
    }
  }

  // ── Register in Building Panels ──────────────────────────────

  function registerPanel() {
    // Wait for the panels module to be ready
    if (!window.BUILDING_PANELS_REGISTRY) {
      window.BUILDING_PANELS_REGISTRY = {};
    }
    window.BUILDING_PANELS_REGISTRY['arena'] = {
      icon: '🏟️', title: 'Arena Coliseum',
      render: renderArena,
    };

    // Also directly patch BUILDING_PANELS if loaded
    var checkInterval = setInterval(function() {
      var panels = window._buildingPanelsMap;
      if (panels) {
        panels['🏟️ Arena'] = { icon: '🏟️', title: 'Arena Coliseum', render: renderArena };
        clearInterval(checkInterval);
      }
    }, 500);
  }

  registerPanel();

  // ── Public API ───────────────────────────────────────────────

  window.MedievalArena = {
    render: renderArena,
    open: function() {
      if (window.openBuildingPanel) window.openBuildingPanel('🏟️ Arena');
    },
    getState: function() { return _state; },
    challenge: function(opts) {
      return arenaPost('/api/arena/challenge', opts);
    },
    score: function(battleId, scores) {
      return arenaPost('/api/arena/score', Object.assign({ battleId: battleId }, scores));
    },
    forfeit: function(battleId, forfeiter) {
      return arenaPost('/api/arena/forfeit', { battleId: battleId, forfeiter: forfeiter });
    },
    buildColiseum: buildColiseum,
  };

})();
