/**
 * Medieval Mission Houses — Dynamic mission buildings in the 3D village
 * 
 * Each mission creates a house:
 * - 3D building with construction animation
 * - Clickable → mission detail overlay with tasks, chat, status
 * - Decommissionable with collapse animation
 * - Persists to localStorage + backend API
 * 
 * v2: Added diagnostic logging, backend sync, live chat, edit mode
 */
(function() {
    'use strict';

    var STORAGE_KEY = 'spawnkit-mission-houses';
    var MAX_HOUSES = 12;
    var LOG_PREFIX = '[MissionHouses]';

    function log() { console.log.apply(console, [LOG_PREFIX].concat(Array.prototype.slice.call(arguments))); }
    function warn() { console.warn.apply(console, [LOG_PREFIX].concat(Array.prototype.slice.call(arguments))); }
    function err() { console.error.apply(console, [LOG_PREFIX].concat(Array.prototype.slice.call(arguments))); }

    // ── Color palette ─────────────────────────────────────────────────
    var HOUSE_COLORS = [
        { name: 'Indigo',  roof: 0x6366f1 }, { name: 'Emerald', roof: 0x10b981 },
        { name: 'Rose',    roof: 0xf43f5e }, { name: 'Amber',   roof: 0xf59e0b },
        { name: 'Sky',     roof: 0x0ea5e9 }, { name: 'Purple',  roof: 0xa855f7 },
        { name: 'Orange',  roof: 0xf97316 }, { name: 'Teal',    roof: 0x14b8a6 },
        { name: 'Pink',    roof: 0xec4899 }, { name: 'Lime',    roof: 0x84cc16 },
        { name: 'Cyan',    roof: 0x06b6d4 }, { name: 'Red',     roof: 0xef4444 },
    ];

    // ── Placement grid (south of village, around z=20-32) ─────────────
    // Positions: closer to village center, visible from default camera angle
    var HOUSE_POSITIONS = [
        { x:  12, z: 18 }, { x: -12, z: 18 }, { x:  14, z: 22 },
        { x: -14, z: 22 }, { x:  10, z: 24 }, { x: -10, z: 24 },
        { x:  16, z: 20 }, { x: -16, z: 20 }, { x:  12, z: 26 },
        { x: -12, z: 26 }, { x:  16, z: 26 }, { x: -16, z: 26 },
    ];

    var AGENTS = [
        { id: 'Sycopa', icon: '🎭', title: 'Lord Commander' },
        { id: 'Forge', icon: '⚒️', title: 'Master Smith' },
        { id: 'Atlas', icon: '📜', title: 'Royal Scribe' },
        { id: 'Hunter', icon: '🏹', title: 'Royal Huntsman' },
        { id: 'Echo', icon: '🎵', title: 'Court Bard' },
        { id: 'Sentinel', icon: '🛡️', title: 'Castle Guard' },
    ];

    var ICONS = ['🌐', '📱', '🎮', '🛡️', '🔮', '📦', '🎯', '⚗️', '🗂️', '🚀', '💎', '🏗️'];

    // ── State ─────────────────────────────────────────────────────────
    var missions = [];
    var houseGroups = new Map();
    var houseLabels = new Map();
    var activeOverlay = null;
    var editModeActive = false;
    var editIndicator = null;
    var sceneReady = false;

    // ── Persistence ───────────────────────────────────────────────────
    function loadMissions() {
        // Load from localStorage first (instant)
        try {
            missions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!Array.isArray(missions)) missions = [];
        } catch(e) { missions = []; }
        log('Loaded', missions.length, 'missions from localStorage');

        // Then try backend (async merge — backend wins on conflict)
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
        fetcher('/api/oc/missions').then(function(r) { return r.json(); }).then(function(data) {
            var backend = data.missions || [];
            if (!Array.isArray(backend) || backend.length === 0) {
                // No backend data — push localStorage to backend
                if (missions.length > 0) saveMissions();
                return;
            }
            // Merge: use backend as source of truth, add any localStorage-only missions
            var backendIds = new Set(backend.map(function(m) { return m.id; }));
            var localOnly = missions.filter(function(m) { return !backendIds.has(m.id); });
            missions = backend.concat(localOnly);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(missions));
            log('Merged from backend:', backend.length, 'backend +', localOnly.length, 'local-only =', missions.length, 'total');

            // Rebuild houses if scene is ready
            if (sceneReady) {
                missions.forEach(function(m) {
                    if (m.status !== 'archived' && m.position && !houseGroups.has(m.id)) {
                        buildHouse3D(m, false);
                    }
                });
            }
        }).catch(function(e) { warn('Backend load failed (using localStorage):', e.message || e); });

        return missions;
    }

    function saveMissions() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(missions));
        } catch(e) { err('localStorage save failed:', e); }
        // Sync to backend
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
        fetcher('/api/oc/missions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ missions: missions }),
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.ok) log('Synced', data.count, 'missions to backend');
            else warn('Backend sync error:', data.error);
        }).catch(function(e) { warn('Backend sync failed:', e.message || e); });
    }

    function genId() { return 'mission_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

    // ── Helpers ───────────────────────────────────────────────────────
    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function getNextPosition() {
        var usedPositions = missions.filter(function(m) { return m.status !== 'archived'; })
            .map(function(m) { return m.position; }).filter(Boolean);
        for (var i = 0; i < HOUSE_POSITIONS.length; i++) {
            var pos = HOUSE_POSITIONS[i];
            var taken = usedPositions.some(function(u) { return u && Math.abs(u.x - pos.x) < 3 && Math.abs(u.z - pos.z) < 3; });
            if (!taken) return { x: pos.x, z: pos.z };
        }
        var angle = Math.random() * Math.PI * 2;
        var r = 25 + Math.random() * 10;
        return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
    }

    function checkScene() {
        var T = window.THREE;
        if (!T || !T.Group || !T.Mesh || !T.BoxGeometry) { return false; } // Need real THREE, not stub
        if (!window.castleApp) { return false; }
        if (!window.castleApp.scene) { return false; }
        return true;
    }

    // ── 3D House Creation ─────────────────────────────────────────────
    function buildHouse3D(mission, animate) {
        if (!checkScene()) {
            warn('Cannot build house — scene not ready. Mission:', mission.name);
            return null;
        }

        var colorIdx = missions.indexOf(mission) % HOUSE_COLORS.length;
        if (colorIdx < 0) colorIdx = Math.abs((mission.id || '').charCodeAt(8) || 0) % HOUSE_COLORS.length;
        var palette = HOUSE_COLORS[colorIdx];
        var pos = mission.position;
        if (!pos) { warn('No position for mission:', mission.name); return null; }

        log('Building house:', mission.name, 'at', pos.x, pos.z, animate ? '(animated)' : '(instant)');

        var group = new THREE.Group();
        var w = 1.8, h = 1.4, d = 1.6;

        // Walls
        var walls = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: 0xDDCCAA })
        );
        walls.position.y = h / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);

        // Colored roof
        var roofColor = mission.color ? parseInt(mission.color.replace('#',''), 16) : palette.roof;
        var roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.5, 4),
            new THREE.MeshStandardMaterial({ color: roofColor })
        );
        roof.position.y = h + h * 0.25;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roof.name = 'roof';
        group.add(roof);

        // Door
        var door = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        door.position.set(0, 0.25, d / 2 + 0.03);
        group.add(door);

        // Status light
        var statusColor = mission.status === 'active' ? 0x34d399 : mission.status === 'paused' ? 0xfbbf24 : 0x9ca3af;
        var statusLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 8),
            new THREE.MeshBasicMaterial({ color: statusColor })
        );
        statusLight.position.y = h + h * 0.5 + 0.1;
        statusLight.name = 'statusLight';
        group.add(statusLight);

        group.position.set(pos.x, 0, pos.z);
        group.userData.missionId = mission.id;
        group.userData.buildingName = '🏠 ' + mission.name;
        group.traverse(function(child) {
            if (child.isMesh) {
                child.userData.missionId = mission.id;
                child.userData.buildingName = '🏠 ' + mission.name;
            }
        });

        window.castleApp.scene.add(group);
        window.castleApp.buildingGroups = window.castleApp.buildingGroups || [];
        window.castleApp.buildingGroups.push(group);
        houseGroups.set(mission.id, group);

        // Floating label
        var container = document.getElementById('scene-container');
        if (container) {
            var label = document.createElement('div');
            label.className = 'building-label mission-house-label';
            label.textContent = (mission.icon || '🏠') + ' ' + mission.name;
            label.style.cssText = 'pointer-events:none;';
            container.appendChild(label);
            houseLabels.set(mission.id, label);

            if (window.castleApp.buildingLabels) {
                window.castleApp.buildingLabels.push({
                    label: label,
                    position: new THREE.Vector3(pos.x, h + h * 0.5 + 0.8, pos.z),
                });
            }
        }

        // Construction animation
        if (animate) {
            group.scale.set(1, 0.01, 1);
            var startTime = performance.now();
            var buildDuration = 2000;

            var dustGroup = new THREE.Group();
            var dustGeo = new THREE.SphereGeometry(0.03, 4, 4);
            for (var i = 0; i < 15; i++) {
                var dustMat = new THREE.MeshBasicMaterial({ color: 0xD2B48C, transparent: true, opacity: 0.6 });
                var dust = new THREE.Mesh(dustGeo, dustMat);
                dust.position.set((Math.random()-0.5)*w*1.5, Math.random()*0.5, (Math.random()-0.5)*d*1.5);
                dust.userData.riseSpeed = 0.5 + Math.random() * 1.5;
                dust.userData.drift = (Math.random()-0.5) * 0.8;
                dustGroup.add(dust);
            }
            dustGroup.position.set(pos.x, 0, pos.z);
            window.castleApp.scene.add(dustGroup);

            function animateBuild() {
                var elapsed = performance.now() - startTime;
                var t = Math.min(elapsed / buildDuration, 1);
                var eased = t < 0.8 ? (t / 0.8) : 1 + Math.sin((t - 0.8) / 0.2 * Math.PI) * 0.03;
                group.scale.y = Math.max(0.01, eased);
                dustGroup.children.forEach(function(p) {
                    p.position.y += p.userData.riseSpeed * 0.016;
                    p.position.x += p.userData.drift * 0.016;
                    p.material.opacity = Math.max(0, 0.6 * (1 - t));
                });
                if (t < 1) {
                    requestAnimationFrame(animateBuild);
                } else {
                    group.scale.y = 1;
                    window.castleApp.scene.remove(dustGroup);
                    dustGroup.children.forEach(function(p) { p.geometry.dispose(); p.material.dispose(); });
                    log('House built:', mission.name);
                }
            }
            requestAnimationFrame(animateBuild);

            // Fly camera to the new house
            if (window.castleApp.focusPosition) {
                setTimeout(function() { window.castleApp.focusPosition(pos.x, pos.z); }, 300);
            }
        }

        return group;
    }

    // ── Decommission Animation ────────────────────────────────────────
    function decommissionHouse(missionId) {
        var group = houseGroups.get(missionId);
        var mission = missions.find(function(m) { return m.id === missionId; });
        if (!group || !window.castleApp) { warn('Cannot decommission:', missionId); return; }

        log('Decommissioning:', mission ? mission.name : missionId);
        if (mission) { mission.status = 'archived'; saveMissions(); }

        var startTime = performance.now();
        var duration = 1500;

        var dustGroup = new THREE.Group();
        var dustGeo = new THREE.SphereGeometry(0.05, 4, 4);
        for (var i = 0; i < 25; i++) {
            var mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xD2B48C : 0xA0896C, transparent: true, opacity: 0.8 });
            var p = new THREE.Mesh(dustGeo, mat);
            p.position.set((Math.random()-0.5)*3, Math.random()*0.3, (Math.random()-0.5)*3);
            p.userData.riseSpeed = 1 + Math.random() * 2;
            p.userData.drift = (Math.random()-0.5) * 1.5;
            dustGroup.add(p);
        }
        dustGroup.position.copy(group.position);
        window.castleApp.scene.add(dustGroup);

        function animateCollapse() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);
            group.scale.y = Math.max(0.01, 1 - t);
            group.position.y = -t * 0.5;
            group.traverse(function(child) {
                if (child.isMesh && child.material) {
                    if (!child.material._cloned) {
                        // Create a simple replacement material to avoid clone issues with maps/uniforms
                        var oldColor = child.material.color ? child.material.color.getHex() : 0xcccccc;
                        child.material = new THREE.MeshBasicMaterial({ color: oldColor, transparent: true, opacity: 1 });
                        child.material._cloned = true;
                    }
                    child.material.opacity = Math.max(0, 1 - t * 1.5);
                }
            });
            dustGroup.children.forEach(function(dp) {
                dp.position.y += dp.userData.riseSpeed * 0.016;
                dp.position.x += dp.userData.drift * 0.016;
                dp.material.opacity = Math.max(0, 0.8 * (1 - t * 0.8));
            });
            if (t < 1) {
                requestAnimationFrame(animateCollapse);
            } else {
                window.castleApp.scene.remove(group);
                group.traverse(function(c) { if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); } });
                window.castleApp.scene.remove(dustGroup);
                dustGroup.children.forEach(function(dp) { dp.geometry.dispose(); dp.material.dispose(); });
                var bgs = window.castleApp.buildingGroups || [];
                var idx = bgs.indexOf(group);
                if (idx >= 0) bgs.splice(idx, 1);
                var label = houseLabels.get(missionId);
                if (label) {
                    label.remove(); houseLabels.delete(missionId);
                    if (window.castleApp.buildingLabels) {
                        window.castleApp.buildingLabels = window.castleApp.buildingLabels.filter(function(bl) { return bl.label !== label; });
                    }
                }
                houseGroups.delete(missionId);
                log('Demolished:', mission ? mission.name : missionId);
            }
        }
        requestAnimationFrame(animateCollapse);
    }

    // ── Fetch chat transcript for a mission ───────────────────────────
    function fetchMissionChat(mission, callback) {
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
        // Try mission-scoped chat first (from orchestrator)
        fetcher('/api/oc/missions/' + mission.id + '/chat').then(function(r) { return r.json(); }).then(function(data) {
            var messages = data.messages || [];
            if (messages.length > 0) {
                callback(messages);
                return;
            }
            // Fallback: search global transcript for mission mentions
            return fetcher('/api/oc/chat/transcript?last=100').then(function(r) { return r.json(); }).then(function(data2) {
                var all = data2.messages || data2 || [];
                if (!Array.isArray(all)) all = [];
                var missionName = mission.name.toLowerCase();
                var agentNames = (mission.agents || []).map(function(a) { return a.toLowerCase(); });
                var filtered = all.filter(function(m) {
                    var content = (m.content || m.text || '').toLowerCase();
                    if (content.includes(missionName) || content.includes('[mission: ' + missionName + ']')) return true;
                    for (var i = 0; i < agentNames.length; i++) {
                        if (content.includes(agentNames[i])) return true;
                    }
                    return false;
                });
                callback(filtered);
            });
        }).catch(function(e) {
            warn('Failed to fetch chat:', e.message || e);
            callback([]);
        });
    }

    // ── Fetch live mission status from orchestrator ───────────────────
    function fetchMissionStatus(missionId, callback) {
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
        fetcher('/api/oc/missions/' + missionId + '/status').then(function(r) { return r.json(); }).then(function(data) {
            callback(data);
        }).catch(function(e) {
            warn('Failed to fetch mission status:', e.message || e);
            callback(null);
        });
    }

    // ── Activate mission via orchestrator ─────────────────────────────
    function activateMission(missionId, callback) {
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
        fetcher('/api/oc/missions/' + missionId + '/activate', { method: 'POST' }).then(function(r) { return r.json(); }).then(function(data) {
            callback(data);
        }).catch(function(e) {
            warn('Failed to activate mission:', e.message || e);
            callback({ error: e.message });
        });
    }

    // ── Send mission-scoped chat message ──────────────────────────────
    function sendMissionChat(missionId, message, callback) {
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
        fetcher('/api/oc/missions/' + missionId + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message }),
        }).then(function(r) { return r.json(); }).then(function(data) {
            callback(data);
        }).catch(function(e) {
            warn('Failed to send mission chat:', e.message || e);
            callback({ error: e.message });
        });
    }

    // ── Mission Detail Overlay ────────────────────────────────────────
    function showMissionOverlay(missionId) {
        var mission = missions.find(function(m) { return m.id === missionId; });
        if (!mission) { warn('Mission not found:', missionId); return; }

        log('Opening overlay for:', mission.name);
        if (window.dismissAllOverlays) window.dismissAllOverlays('missionOverlay');
        if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }

        var overlay = document.createElement('div');
        overlay.id = 'mission-house-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(5,10,25,0.85);opacity:0;transition:opacity 0.3s;';

        var statusColors = { active: '#34d399', paused: '#fbbf24', done: '#9ca3af', archived: '#6b7280' };
        var statusLabels = { active: '⚡ Active', paused: '⏸️ Paused', done: '✅ Done', archived: '🏚️ Archived' };
        var tasks = mission.tasks || [];
        var doneTasks = tasks.filter(function(t) { return t.done; }).length;
        var pct = tasks.length > 0 ? Math.round(doneTasks / tasks.length * 100) : 0;

        var content = document.createElement('div');
        content.style.cssText = 'position:relative;width:min(700px,95vw);max-height:90vh;overflow-y:auto;background:rgba(15,25,50,.92);border:1px solid rgba(201,169,89,.4);border-radius:4px;padding:28px;box-shadow:0 0 60px rgba(201,169,89,.15);';

        content.innerHTML =
            '<button style="position:absolute;top:10px;right:14px;cursor:pointer;color:rgba(168,162,153,.7);font-size:20px;background:none;border:none;" id="mh-close">✕</button>' +

            // Header
            '<div style="text-align:center;margin-bottom:16px;">' +
                '<h2 style="font-family:Crimson Text,serif;font-size:28px;color:#c9a959;margin:0 0 4px;">' + esc(mission.icon || '🏠') + ' ' + esc(mission.name) + '</h2>' +
                '<span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:600;color:#fff;background:' + (statusColors[mission.status] || '#6b7280') + ';">' + (statusLabels[mission.status] || mission.status) + '</span>' +
                '<span style="margin-left:8px;font-size:11px;color:rgba(168,162,153,.6);">Created ' + new Date(mission.created).toLocaleDateString() + '</span>' +
                (mission.agents && mission.agents.length ? '<div data-agent-status style="margin-top:6px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">' + mission.agents.map(function(a) { return '<span style="padding:2px 10px;border-radius:12px;font-size:11px;background:rgba(201,169,89,.1);color:#c9a959;border:1px solid rgba(201,169,89,.2);">⚔️ ' + esc(a) + '</span>'; }).join('') + '</div>' : '<div style="margin-top:6px;text-align:center;font-size:11px;color:rgba(168,162,153,.4);">No agents assigned — assign agents via Edit</div>') +
            '</div>' +

            // Description
            (mission.description ? '<div style="text-align:center;margin-bottom:16px;padding:10px 16px;background:rgba(244,228,188,.05);border:1px solid rgba(201,169,89,.15);border-radius:4px;font-size:13px;color:rgba(168,162,153,.8);font-style:italic;">' + esc(mission.description) + '</div>' : '') +
            '<div style="width:60%;margin:0 auto 16px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,169,89,.4),transparent);"></div>' +

            // Progress
            '<div style="margin-bottom:16px;">' +
                '<div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(168,162,153,.7);margin-bottom:4px;"><span>Progress</span><span data-progress-text>' + doneTasks + '/' + tasks.length + ' (' + pct + '%)</span></div>' +
                '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;"><div data-progress-bar style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#c9a959,#f59e0b);border-radius:3px;transition:width 0.3s;"></div></div>' +
            '</div>' +

            // Tasks
            '<div style="font-family:Crimson Text,serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;">Tasks</div>' +
            '<div id="mh-tasks" style="margin-bottom:16px;">' +
                (tasks.length === 0 ? '<div style="padding:10px;text-align:center;color:rgba(168,162,153,.5);font-size:12px;">No tasks yet</div>' : '') +
                tasks.map(function(t, i) {
                    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:4px;margin-bottom:3px;background:rgba(255,255,255,.03);border:1px solid rgba(168,162,153,.12);">' +
                        '<input type="checkbox" ' + (t.done ? 'checked' : '') + ' class="mh-task-check" data-idx="' + i + '" style="accent-color:#c9a959;" />' +
                        '<span style="flex:1;font-size:13px;color:' + (t.done ? 'rgba(168,162,153,.4)' : '#f4e4bc') + ';' + (t.done ? 'text-decoration:line-through;' : '') + '">' + esc(t.text) + '</span>' +
                        '<button class="mh-task-del" data-idx="' + i + '" style="background:none;border:none;color:rgba(168,162,153,.3);cursor:pointer;font-size:12px;">✕</button></div>';
                }).join('') +
            '</div>' +

            // Add task
            '<div style="display:flex;gap:6px;margin-bottom:16px;">' +
                '<input id="mh-new-task" type="text" placeholder="Add task..." style="flex:1;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.25);border-radius:3px;color:#f4e4bc;font-size:12px;padding:6px 8px;outline:none;" />' +
                '<button id="mh-add-task" style="padding:6px 12px;background:rgba(201,169,89,.1);border:1px solid rgba(201,169,89,.3);border-radius:3px;color:#c9a959;font-size:12px;cursor:pointer;">+ Add</button>' +
            '</div>' +

            // Chat section
            '<div style="font-family:Crimson Text,serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;">Chat History</div>' +
            '<div id="mh-chat-history" style="max-height:180px;overflow-y:auto;margin-bottom:12px;padding:8px;background:rgba(0,0,0,.2);border:1px solid rgba(168,162,153,.1);border-radius:4px;font-size:12px;color:rgba(168,162,153,.6);">Loading chat...</div>' +

            // Send message
            '<div style="display:flex;gap:6px;margin-bottom:16px;">' +
                '<textarea id="mh-chat-input" rows="2" placeholder="Send a message about this mission..." style="flex:1;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.25);border-radius:3px;color:#f4e4bc;font-size:12px;padding:6px 8px;resize:none;outline:none;font-family:inherit;"></textarea>' +
                '<button id="mh-chat-send" style="padding:6px 12px;background:rgba(201,169,89,.1);border:1px solid rgba(201,169,89,.3);border-radius:3px;color:#c9a959;font-size:12px;cursor:pointer;align-self:flex-end;">📜 Send</button>' +
            '</div>' +

            // Live status section (populated by fetchMissionStatus)
            '<div id="mh-live-status" style="margin-bottom:16px;padding:12px;background:rgba(0,0,0,.2);border:1px solid rgba(168,162,153,.1);border-radius:4px;display:none;"></div>' +

            // Actions
            '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
                (mission.agents && mission.agents.length > 0 && !mission.activatedAt ? '<button class="mh-action" data-action="activate" style="padding:8px 18px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.5);border-radius:3px;color:#34d399;font-size:13px;font-weight:600;cursor:pointer;">⚔️ Deploy Agents</button>' : '') +
                (mission.status === 'active' ? '<button class="mh-action" data-action="pause" style="padding:6px 14px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:3px;color:#fbbf24;font-size:12px;cursor:pointer;">⏸️ Pause</button>' : '') +
                (mission.status === 'paused' ? '<button class="mh-action" data-action="resume" style="padding:6px 14px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.3);border-radius:3px;color:#34d399;font-size:12px;cursor:pointer;">▶️ Resume</button>' : '') +
                (mission.status !== 'done' && mission.status !== 'archived' ? '<button class="mh-action" data-action="done" style="padding:6px 14px;background:rgba(156,163,175,.08);border:1px solid rgba(156,163,175,.3);border-radius:3px;color:#9ca3af;font-size:12px;cursor:pointer;">✅ Complete</button>' : '') +
                '<button class="mh-action" data-action="decommission" style="padding:6px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:3px;color:#f87171;font-size:12px;cursor:pointer;">🏚️ Demolish</button>' +
            '</div>';

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        activeOverlay = overlay;
        requestAnimationFrame(function() { overlay.style.opacity = '1'; });

        // Load chat history
        fetchMissionChat(mission, function(messages) {
            var chatEl = document.getElementById('mh-chat-history');
            if (!chatEl) return;
            if (messages.length === 0) {
                chatEl.innerHTML = '<div style="text-align:center;color:rgba(168,162,153,.4);padding:8px;">No messages mentioning this mission yet.<br><span style="font-size:11px;">Send a message below or use [Mission: ' + esc(mission.name) + '] in chat.</span></div>';
            } else {
                chatEl.innerHTML = messages.slice(-20).map(function(m) {
                    var role = m.role === 'user' ? '👤' : '🤖';
                    var text = (m.content || m.text || '').substring(0, 300);
                    return '<div style="margin-bottom:6px;"><span style="color:rgba(201,169,89,.6);">' + role + '</span> <span style="color:rgba(168,162,153,.8);">' + esc(text) + '</span></div>';
                }).join('');
                chatEl.scrollTop = chatEl.scrollHeight;
            }
        });

        // Load live agent session status for assigned agents
        if (mission.agents && mission.agents.length > 0) {
            var fetcher2 = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : fetch.bind(window);
            fetcher2('/api/oc/sessions').then(function(r) { return r.json(); }).then(function(sessions) {
                if (!Array.isArray(sessions)) sessions = [];
                var agentBadges = mission.agents.map(function(agentName) {
                    var agentLower = agentName.toLowerCase();
                    var match = sessions.find(function(s) {
                        var label = (s.label || s.key || '').toLowerCase();
                        return label.includes(agentLower);
                    });
                    var isActive = match && match.status === 'active';
                    var dot = isActive ? '🟢' : '⚪';
                    var statusText = isActive ? 'Working' : 'Idle';
                    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;background:rgba(201,169,89,.08);border:1px solid rgba(201,169,89,.2);color:#c9a959;">' + dot + ' ' + esc(agentName) + ' <span style="color:rgba(168,162,153,.5);">(' + statusText + ')</span></span>';
                });
                // Insert after the agents section in the header
                var agentSection = content.querySelector('[data-agent-status]');
                if (agentSection) agentSection.innerHTML = agentBadges.join(' ');
            }).catch(function() {});
        }

        // Wire events
        document.getElementById('mh-close').addEventListener('click', closeMissionOverlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeMissionOverlay(); });
        document.addEventListener('keydown', _escHandler);

        // Task checkboxes — FIX 4: update progress bar inline
        content.querySelectorAll('.mh-task-check').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var idx = parseInt(this.dataset.idx);
                if (mission.tasks[idx]) {
                    mission.tasks[idx].done = this.checked;
                    saveMissions();
                    updateHouseStatus(missionId);
                    // Update progress bar inline without closing overlay
                    var done = mission.tasks.filter(function(t) { return t.done; }).length;
                    var total = mission.tasks.length;
                    var pct = total > 0 ? Math.round(done / total * 100) : 0;
                    var progressText = content.querySelector('[data-progress-text]');
                    var progressBar = content.querySelector('[data-progress-bar]');
                    if (progressText) progressText.textContent = done + '/' + total + ' (' + pct + '%)';
                    if (progressBar) progressBar.style.width = pct + '%';
                    // Update task text style (strikethrough when done)
                    var taskSpan = this.parentElement.querySelector('span');
                    if (taskSpan) {
                        taskSpan.style.color = this.checked ? 'rgba(168,162,153,.4)' : '#f4e4bc';
                        taskSpan.style.textDecoration = this.checked ? 'line-through' : 'none';
                    }
                }
            });
        });

        // Task delete
        content.querySelectorAll('.mh-task-del').forEach(function(btn) {
            btn.addEventListener('click', function() {
                mission.tasks.splice(parseInt(this.dataset.idx), 1);
                saveMissions(); closeMissionOverlay(); showMissionOverlay(missionId);
            });
        });

        // Add task
        document.getElementById('mh-add-task').addEventListener('click', function() {
            var input = document.getElementById('mh-new-task');
            var text = input.value.trim();
            if (!text) return;
            mission.tasks = mission.tasks || [];
            mission.tasks.push({ text: text, done: false });
            saveMissions(); closeMissionOverlay(); showMissionOverlay(missionId);
        });
        document.getElementById('mh-new-task').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('mh-add-task').click(); });

        // Chat send — use mission-scoped API
        document.getElementById('mh-chat-send').addEventListener('click', function() {
            var input = document.getElementById('mh-chat-input');
            var text = input.value.trim();
            if (!text) return;
            input.value = '';
            // Show user message immediately
            var chatEl = document.getElementById('mh-chat-history');
            if (chatEl) {
                var newMsg = document.createElement('div');
                newMsg.style.cssText = 'margin-bottom:6px;';
                newMsg.innerHTML = '<span style="color:rgba(201,169,89,.6);">👤</span> <span style="color:rgba(168,162,153,.8);">' + esc(text) + '</span>';
                chatEl.appendChild(newMsg);
                chatEl.scrollTop = chatEl.scrollHeight;
            }
            // Send via mission-scoped API
            sendMissionChat(missionId, text, function(data) {
                if (data.error) { warn('Chat send failed:', data.error); return; }
                // Show agent replies
                if (data.results && chatEl) {
                    data.results.forEach(function(r) {
                        if (r.ok && r.reply) {
                            var replyMsg = document.createElement('div');
                            replyMsg.style.cssText = 'margin-bottom:6px;';
                            replyMsg.innerHTML = '<span style="color:rgba(201,169,89,.6);">🤖 ' + esc(r.agent) + '</span> <span style="color:rgba(168,162,153,.8);">' + esc(r.reply.substring(0, 500)) + '</span>';
                            chatEl.appendChild(replyMsg);
                        }
                    });
                    chatEl.scrollTop = chatEl.scrollHeight;
                }
            });
        });

        // Actions
        content.querySelectorAll('.mh-action').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = this.dataset.action;
                if (action === 'decommission') {
                    if (!confirm('Demolish ' + mission.name + '?')) return;
                    closeMissionOverlay(); decommissionHouse(missionId); return;
                }
                if (action === 'activate') {
                    this.textContent = '⏳ Deploying agents & generating tasks...';
                    this.disabled = true;
                    activateMission(missionId, function(data) {
                        if (data.error) {
                            alert('Activation failed: ' + data.error);
                        } else {
                            mission.activatedAt = new Date().toISOString();
                            mission.status = 'active';
                            // FIX 1: Pick up auto-generated tasks from backend
                            if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
                                mission.tasks = data.tasks;
                            }
                            saveMissions();
                        }
                        closeMissionOverlay(); showMissionOverlay(missionId);
                    });
                    return;
                }
                if (action === 'pause') mission.status = 'paused';
                else if (action === 'resume') mission.status = 'active';
                else if (action === 'done') mission.status = 'done';
                saveMissions(); updateHouseStatus(missionId); closeMissionOverlay(); showMissionOverlay(missionId);
            });
        });

        // Live status polling (every 10s while overlay is open)
        if (mission.activatedAt) {
            var statusPollTimer = setInterval(function() {
                if (!activeOverlay) { clearInterval(statusPollTimer); return; }
                fetchMissionStatus(missionId, function(status) {
                    if (!status) return;
                    // Update live status panel
                    var el = document.getElementById('mh-live-status');
                    if (el) {
                        el.style.display = 'block';
                        var agentHtml = (status.agents || []).map(function(a) {
                            var dot = a.status === 'working' ? '🟢' : '⚪';
                            var actionLabel = a.action !== 'idle' ? ' — ' + a.action : '';
                            return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">' +
                                '<span>' + dot + '</span>' +
                                '<span style="color:#f4e4bc;font-size:12px;">' + esc(a.agent) + '</span>' +
                                '<span style="color:rgba(168,162,153,.5);font-size:11px;">' + a.status + actionLabel + '</span>' +
                                (a.sessions > 0 ? '<span style="color:rgba(201,169,89,.4);font-size:10px;">(' + a.sessions + ' session' + (a.sessions > 1 ? 's' : '') + ')</span>' : '') +
                            '</div>';
                        }).join('');
                        el.innerHTML =
                            '<div style="font-family:Crimson Text,serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">⚡ Live Status</div>' +
                            agentHtml +
                            '<div style="margin-top:6px;font-size:10px;color:rgba(168,162,153,.4);">Auto-refreshing every 10s</div>';
                    }
                    // FIX 4: Sync progress bar from backend status
                    if (status.progress) {
                        var progressText = content.querySelector('[data-progress-text]');
                        var progressBar = content.querySelector('[data-progress-bar]');
                        if (progressText) progressText.textContent = status.progress.done + '/' + status.progress.total + ' (' + status.progress.percent + '%)';
                        if (progressBar) progressBar.style.width = status.progress.percent + '%';
                    }
                    // Sync tasks from backend (update data without closing overlay)
                    if (status.tasks && Array.isArray(status.tasks) && status.tasks.length > 0) {
                        var backendTasks = status.tasks;
                        var backendDone = backendTasks.filter(function(t) { return t.done; }).length;
                        var localDone = (mission.tasks || []).filter(function(t) { return t.done; }).length;
                        if (backendDone > localDone) {
                            // Agent completed tasks — update data silently
                            mission.tasks = backendTasks;
                            saveMissions();
                            // Update task checkboxes inline without closing overlay
                            var taskChecks = content.querySelectorAll('.mh-task-check');
                            taskChecks.forEach(function(cb) {
                                var idx = parseInt(cb.dataset.idx);
                                if (backendTasks[idx] && backendTasks[idx].done && !cb.checked) {
                                    cb.checked = true;
                                    var span = cb.parentElement.querySelector('span');
                                    if (span) { span.style.color = 'rgba(168,162,153,.4)'; span.style.textDecoration = 'line-through'; }
                                }
                            });
                        }
                    }
                });
            }, 10000);
            // Initial fetch
            fetchMissionStatus(missionId, function(status) {
                var el = document.getElementById('mh-live-status');
                if (!el || !status) return;
                el.style.display = 'block';
                var agentHtml = (status.agents || []).map(function(a) {
                    var dot = a.status === 'working' ? '🟢' : '⚪';
                    var actionLabel = a.action !== 'idle' ? ' — ' + a.action : '';
                    return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">' +
                        '<span>' + dot + '</span>' +
                        '<span style="color:#f4e4bc;font-size:12px;">' + esc(a.agent) + '</span>' +
                        '<span style="color:rgba(168,162,153,.5);font-size:11px;">' + a.status + actionLabel + '</span>' +
                    '</div>';
                }).join('');
                el.innerHTML =
                    '<div style="font-family:Crimson Text,serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;">⚡ Live Status</div>' +
                    agentHtml;
            });
        }
    }

    function _escHandler(e) { if (e.key === 'Escape' && activeOverlay) closeMissionOverlay(); }

    function closeMissionOverlay() {
        if (!activeOverlay) return;
        activeOverlay.style.opacity = '0';
        var ov = activeOverlay; activeOverlay = null;
        setTimeout(function() { if (ov.parentNode) ov.remove(); }, 300);
        document.removeEventListener('keydown', _escHandler);
    }

    function updateHouseStatus(missionId) {
        var mission = missions.find(function(m) { return m.id === missionId; });
        var group = houseGroups.get(missionId);
        if (!mission || !group) return;
        var statusColor = mission.status === 'active' ? 0x34d399 : mission.status === 'paused' ? 0xfbbf24 : 0x9ca3af;
        group.traverse(function(child) { if (child.name === 'statusLight' && child.material) child.material.color.setHex(statusColor); });
    }

    // ── Create Mission Dialog ─────────────────────────────────────────
    function showCreateDialog() {
        if (window.dismissAllOverlays) window.dismissAllOverlays('missionOverlay');
        if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }
        var activeMissions = missions.filter(function(m) { return m.status !== 'archived'; });
        if (activeMissions.length >= MAX_HOUSES) { alert('Maximum ' + MAX_HOUSES + ' active houses.'); return; }

        log('Opening create dialog');

        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(5,10,25,0.85);opacity:0;transition:opacity 0.3s;';

        var content = document.createElement('div');
        content.style.cssText = 'width:min(500px,90vw);background:rgba(15,25,50,.92);border:1px solid rgba(201,169,89,.4);border-radius:4px;padding:28px;box-shadow:0 0 60px rgba(201,169,89,.15);';

        content.innerHTML =
            '<h2 style="font-family:Crimson Text,serif;font-size:24px;color:#c9a959;margin:0 0 20px;text-align:center;">🏗️ New Mission</h2>' +
            '<div style="margin-bottom:14px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Mission Name</label>' +
            '<input id="mc-name" type="text" placeholder="e.g. Translator, Remember, SpawnKit..." style="width:100%;box-sizing:border-box;margin-top:4px;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:15px;padding:10px 12px;outline:none;" /></div>' +
            '<div style="margin-bottom:14px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Description / Goal</label>' +
            '<textarea id="mc-desc" rows="3" placeholder="What is this mission about?" style="width:100%;box-sizing:border-box;margin-top:4px;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:13px;padding:8px 10px;outline:none;resize:none;font-family:inherit;"></textarea></div>' +
            '<div style="margin-bottom:14px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Icon</label>' +
            '<div id="mc-icons" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' +
            ICONS.map(function(ic, i) { return '<span class="mc-icon-pick" data-icon="' + ic + '" style="font-size:22px;cursor:pointer;padding:5px 7px;border-radius:6px;border:2px solid ' + (i===0?'rgba(201,169,89,.6)':'transparent') + ';background:rgba(255,255,255,.03);">' + ic + '</span>'; }).join('') + '</div></div>' +
            '<div style="margin-bottom:14px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Assign Knights (optional)</label>' +
            '<div id="mc-agents" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' +
            AGENTS.map(function(a) { return '<label style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:4px;border:1px solid rgba(168,162,153,.2);background:rgba(255,255,255,.03);cursor:pointer;font-size:12px;color:#f4e4bc;"><input type="checkbox" value="' + a.id + '" style="accent-color:#c9a959;" /><span>' + a.icon + ' ' + a.id + '</span></label>'; }).join('') + '</div></div>' +
            '<div style="margin-bottom:16px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">First Task (optional)</label>' +
            '<input id="mc-task" type="text" placeholder="What needs to be done first?" style="width:100%;box-sizing:border-box;margin-top:4px;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:13px;padding:8px 10px;outline:none;" /></div>' +
            '<div style="display:flex;gap:10px;justify-content:center;">' +
            '<button id="mc-cancel" style="padding:10px 20px;background:rgba(168,162,153,.1);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:rgba(168,162,153,.7);font-size:13px;cursor:pointer;">Cancel</button>' +
            '<button id="mc-create" style="padding:10px 20px;background:rgba(201,169,89,.15);border:1px solid rgba(201,169,89,.5);border-radius:4px;color:#c9a959;font-family:Crimson Text,serif;font-size:15px;cursor:pointer;">🏗️ Build House</button></div>';

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        activeOverlay = overlay;
        requestAnimationFrame(function() { overlay.style.opacity = '1'; });

        var selectedIcon = ICONS[0];
        content.querySelectorAll('.mc-icon-pick').forEach(function(el) {
            el.addEventListener('click', function() {
                content.querySelectorAll('.mc-icon-pick').forEach(function(e) { e.style.borderColor = 'transparent'; });
                this.style.borderColor = 'rgba(201,169,89,.6)';
                selectedIcon = this.dataset.icon;
            });
        });

        document.getElementById('mc-cancel').addEventListener('click', closeMissionOverlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeMissionOverlay(); });
        document.addEventListener('keydown', _escHandler);

        document.getElementById('mc-create').addEventListener('click', function() {
            var name = document.getElementById('mc-name').value.trim();
            if (!name) { document.getElementById('mc-name').focus(); return; }
            var desc = document.getElementById('mc-desc').value.trim();
            var task = document.getElementById('mc-task').value.trim();
            var pos = getNextPosition();
            var colorIdx = missions.length % HOUSE_COLORS.length;
            var selectedAgents = [];
            document.querySelectorAll('#mc-agents input:checked').forEach(function(cb) { selectedAgents.push(cb.value); });

            var mission = {
                id: genId(), name: name, icon: selectedIcon, status: 'active',
                color: '#' + HOUSE_COLORS[colorIdx].roof.toString(16).padStart(6, '0'),
                agents: selectedAgents, description: desc,
                tasks: task ? [{ text: task, done: false }] : [],
                position: pos, created: new Date().toISOString(), updated: new Date().toISOString(),
            };

            log('Creating mission:', name, 'pos:', pos, 'agents:', selectedAgents);
            missions.push(mission);
            saveMissions();
            closeMissionOverlay();

            // Build house AFTER overlay is closed (slight delay for DOM cleanup)
            setTimeout(function() {
                var result = buildHouse3D(mission, true);
                if (!result) {
                    err('Failed to build house for:', name, '— scene ready:', checkScene());
                }
                if (window.castleApp && window.castleApp.addActivityLog) {
                    window.castleApp.addActivityLog('🏗️ New mission house: ' + name, 'system');
                }
            }, 50);
        });

        document.getElementById('mc-name').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('mc-create').click(); });
        setTimeout(function() { document.getElementById('mc-name').focus(); }, 100);
    }

    // ── Edit Mode ─────────────────────────────────────────────────────
    function toggleEditMode() {
        editModeActive = !editModeActive;
        log('Edit mode:', editModeActive);

        if (editModeActive) {
            if (!editIndicator) {
                editIndicator = document.createElement('div');
                editIndicator.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:200;padding:8px 20px;background:rgba(249,115,22,.9);color:#fff;font-size:13px;font-weight:600;border-radius:20px;box-shadow:0 4px 16px rgba(249,115,22,.3);';
                editIndicator.textContent = '🏗️ Edit Mode — Click a house to edit · Press 7 to exit';
                document.body.appendChild(editIndicator);
            }
            editIndicator.style.display = 'block';
            houseGroups.forEach(function(group) {
                group.traverse(function(c) {
                    if (c.isMesh && c.material) {
                        // Save original material and replace with safe glow material
                        if (!c._editOrigMaterial) c._editOrigMaterial = c.material;
                        var col = c.material.color ? c.material.color.getHex() : 0xcccccc;
                        c.material = new THREE.MeshStandardMaterial({ color: col, emissive: 0xff8800, emissiveIntensity: 0.3 });
                    }
                });
            });
        } else {
            if (editIndicator) editIndicator.style.display = 'none';
            houseGroups.forEach(function(group) {
                group.traverse(function(c) {
                    if (c.isMesh && c._editOrigMaterial) {
                        if (c.material && c.material !== c._editOrigMaterial) c.material.dispose();
                        c.material = c._editOrigMaterial;
                        delete c._editOrigMaterial;
                    }
                });
            });
        }
    }

    function showEditDialog(missionId) {
        var mission = missions.find(function(m) { return m.id === missionId; });
        if (!mission) return;
        if (window.dismissAllOverlays) window.dismissAllOverlays('missionOverlay');
        if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }

        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(5,10,25,0.85);opacity:0;transition:opacity 0.3s;';
        var content = document.createElement('div');
        content.style.cssText = 'width:min(450px,90vw);background:rgba(15,25,50,.92);border:1px solid rgba(201,169,89,.4);border-radius:4px;padding:24px;box-shadow:0 0 60px rgba(201,169,89,.15);';

        content.innerHTML =
            '<h2 style="font-family:Crimson Text,serif;font-size:22px;color:#c9a959;margin:0 0 16px;text-align:center;">🏗️ Edit: ' + esc(mission.name) + '</h2>' +
            '<div style="margin-bottom:12px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Name</label>' +
            '<input id="me-name" type="text" value="' + esc(mission.name) + '" style="width:100%;box-sizing:border-box;margin-top:4px;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:14px;padding:8px 10px;outline:none;" /></div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Icon</label>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' +
            ICONS.map(function(ic) { return '<span class="me-icon-pick" data-icon="' + ic + '" style="font-size:20px;cursor:pointer;padding:4px 6px;border-radius:4px;border:2px solid ' + (ic===mission.icon?'rgba(201,169,89,.6)':'transparent') + ';background:rgba(255,255,255,.03);">' + ic + '</span>'; }).join('') + '</div></div>' +
            '<div style="margin-bottom:16px;"><label style="font-size:12px;color:rgba(168,162,153,.7);">Roof Color</label>' +
            '<input id="me-color" type="color" value="' + (mission.color || '#6366f1') + '" style="width:60px;height:30px;border:none;cursor:pointer;margin-top:4px;display:block;" /></div>' +
            '<div style="display:flex;gap:8px;justify-content:center;">' +
            '<button id="me-cancel" style="padding:8px 16px;background:rgba(168,162,153,.1);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:rgba(168,162,153,.7);font-size:13px;cursor:pointer;">Cancel</button>' +
            '<button id="me-delete" style="padding:8px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);border-radius:4px;color:#f87171;font-size:13px;cursor:pointer;">🗑️ Delete</button>' +
            '<button id="me-save" style="padding:8px 16px;background:rgba(201,169,89,.15);border:1px solid rgba(201,169,89,.5);border-radius:4px;color:#c9a959;font-size:13px;cursor:pointer;">💾 Save</button></div>';

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        activeOverlay = overlay;
        requestAnimationFrame(function() { overlay.style.opacity = '1'; });

        var selectedIcon = mission.icon || '🏠';
        content.querySelectorAll('.me-icon-pick').forEach(function(el) {
            el.addEventListener('click', function() {
                content.querySelectorAll('.me-icon-pick').forEach(function(e) { e.style.borderColor = 'transparent'; });
                this.style.borderColor = 'rgba(201,169,89,.6)';
                selectedIcon = this.dataset.icon;
            });
        });

        document.getElementById('me-cancel').addEventListener('click', closeMissionOverlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeMissionOverlay(); });
        document.addEventListener('keydown', _escHandler);

        document.getElementById('me-delete').addEventListener('click', function() {
            if (!confirm('Delete ' + mission.name + '?')) return;
            closeMissionOverlay(); decommissionHouse(missionId);
        });

        document.getElementById('me-save').addEventListener('click', function() {
            var newName = document.getElementById('me-name').value.trim();
            if (!newName) return;
            var newColor = document.getElementById('me-color').value;
            mission.name = newName; mission.icon = selectedIcon; mission.color = newColor;
            mission.updated = new Date().toISOString();
            saveMissions();
            var label = houseLabels.get(missionId);
            if (label) label.textContent = selectedIcon + ' ' + newName;
            var group = houseGroups.get(missionId);
            if (group) {
                group.userData.buildingName = '🏠 ' + newName;
                group.traverse(function(c) {
                    if (c.isMesh) c.userData.buildingName = '🏠 ' + newName;
                    if (c.name === 'roof' && c.material) c.material.color.setHex(parseInt(newColor.replace('#',''), 16));
                });
            }
            log('Updated:', newName);
            closeMissionOverlay();
        });
    }

    // ── Click Handler ─────────────────────────────────────────────────
    function handleBuildingClick(name) {
        if (!name || !name.startsWith('🏠 ')) return false;
        var missionName = name.substring(3);
        var mission = missions.find(function(m) { return m.name === missionName; });
        if (!mission) { warn('Click on unknown mission house:', missionName); return false; }

        if (editModeActive) {
            showEditDialog(mission.id);
        } else {
            showMissionOverlay(mission.id);
        }
        return true;
    }

    // ── Init ──────────────────────────────────────────────────────────
    function init() {
        loadMissions();
        var activeCount = missions.filter(function(m) { return m.status !== 'archived'; }).length;
        log('Init: ' + activeCount + ' active missions to restore');

        var retries = 0;
        var maxRetries = 60; // 30 seconds max
        function tryBuild() {
            retries++;
            if (!checkScene()) {
                if (retries <= maxRetries) {
                    setTimeout(tryBuild, 500);
                } else {
                    err('Scene never became ready after ' + (maxRetries * 500 / 1000) + 's. THREE:', typeof THREE !== 'undefined' || !!window.THREE, 'castleApp:', !!window.castleApp);
                }
                return;
            }
            sceneReady = true;
            log('Scene ready after ' + retries + ' checks (' + (retries * 0.5) + 's). Building ' + activeCount + ' houses');
            missions.forEach(function(m) {
                if (m.status !== 'archived' && m.position) {
                    var result = buildHouse3D(m, false);
                    if (result) {
                        log('Restored house:', m.name);
                    } else {
                        err('Failed to restore house:', m.name);
                    }
                }
            });
        }
        tryBuild();
    }

    // ── Public API ────────────────────────────────────────────────────
    window.MissionHouses = {
        create: showCreateDialog,
        show: showMissionOverlay,
        _closeOverlay: closeMissionOverlay,
        decommission: decommissionHouse,
        handleClick: handleBuildingClick,
        toggleEditMode: toggleEditMode,
        isEditMode: function() { return editModeActive; },
        getMissions: function() { return missions.slice(); },
        focusHouse: function(missionId) {
            var m = missions.find(function(mi) { return mi.id === missionId; });
            if (m && m.position && window.castleApp && window.castleApp.focusPosition) {
                window.castleApp.focusPosition(m.position.x, m.position.z);
            }
        },
        addMission: function(name, icon, description) {
            var pos = getNextPosition();
            var colorIdx = missions.length % HOUSE_COLORS.length;
            var mission = {
                id: genId(), name: name, icon: icon || '🏠', status: 'active',
                color: '#' + HOUSE_COLORS[colorIdx].roof.toString(16).padStart(6, '0'),
                agents: [], tasks: [], description: description || '',
                position: pos, created: new Date().toISOString(), updated: new Date().toISOString(),
            };
            missions.push(mission);
            saveMissions();
            setTimeout(function() { buildHouse3D(mission, true); }, 50);
            return mission;
        },
        // Diagnostic
        debug: function() {
            log('Missions:', missions.length);
            log('Houses in scene:', houseGroups.size);
            log('Labels:', houseLabels.size);
            log('Scene ready:', sceneReady);
            log('castleApp:', !!window.castleApp);
            log('castleApp.scene:', !!(window.castleApp && window.castleApp.scene));
            log('buildingGroups:', window.castleApp && window.castleApp.buildingGroups ? window.castleApp.buildingGroups.length : 'N/A');
            missions.forEach(function(m) { log('  -', m.name, '| status:', m.status, '| pos:', JSON.stringify(m.position), '| has3D:', houseGroups.has(m.id)); });
        },
    };

    init();
    log('Module loaded. API:', Object.keys(window.MissionHouses).join(', '));
})();
