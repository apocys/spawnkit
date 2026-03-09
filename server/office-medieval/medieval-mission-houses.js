/**
 * Medieval Mission Houses — Dynamic mission buildings in the 3D village
 * 
 * Each /mission creates a new house in the village that:
 * - Animates construction (scale 0→1)
 * - Shows mission name as floating label
 * - Is clickable → opens mission detail overlay
 * - Can be decommissioned with collapse animation
 * - Persists to localStorage (Phase 1) + API (Phase 2)
 */
(function() {
    'use strict';

    var STORAGE_KEY = 'spawnkit-mission-houses';
    var MAX_HOUSES = 12;

    // ── Color palette for houses ──────────────────────────────────────
    var HOUSE_COLORS = [
        { name: 'Indigo',   roof: 0x6366f1, walls: 0xDDCCAA },
        { name: 'Emerald',  roof: 0x10b981, walls: 0xDDCCAA },
        { name: 'Rose',     roof: 0xf43f5e, walls: 0xDDCCAA },
        { name: 'Amber',    roof: 0xf59e0b, walls: 0xDDCCAA },
        { name: 'Sky',      roof: 0x0ea5e9, walls: 0xDDCCAA },
        { name: 'Purple',   roof: 0xa855f7, walls: 0xDDCCAA },
        { name: 'Orange',   roof: 0xf97316, walls: 0xDDCCAA },
        { name: 'Teal',     roof: 0x14b8a6, walls: 0xDDCCAA },
        { name: 'Pink',     roof: 0xec4899, walls: 0xDDCCAA },
        { name: 'Lime',     roof: 0x84cc16, walls: 0xDDCCAA },
        { name: 'Cyan',     roof: 0x06b6d4, walls: 0xDDCCAA },
        { name: 'Red',      roof: 0xef4444, walls: 0xDDCCAA },
    ];

    // ── Placement positions (spiral around village south) ─────────────
    var HOUSE_POSITIONS = [
        { x: 14, z: 24 }, { x: -14, z: 24 }, { x: 16, z: 28 },
        { x: -16, z: 28 }, { x: 12, z: 30 }, { x: -12, z: 30 },
        { x: 18, z: 22 }, { x: -18, z: 22 }, { x: 20, z: 26 },
        { x: -20, z: 26 }, { x: 14, z: 32 }, { x: -14, z: 32 },
    ];

    // ── State ─────────────────────────────────────────────────────────
    var missions = [];
    var houseGroups = new Map();   // missionId → THREE.Group
    var houseLabels = new Map();   // missionId → HTMLElement
    var activeOverlay = null;

    // ── Persistence ───────────────────────────────────────────────────
    function loadMissions() {
        try {
            missions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!Array.isArray(missions)) missions = [];
        } catch(e) { missions = []; }
        return missions;
    }

    function saveMissions() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(missions)); } catch(e) {}
    }

    function genId() {
        return 'mission_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // ── 3D House Creation ─────────────────────────────────────────────
    function getNextPosition() {
        var usedPositions = missions.filter(function(m) { return m.status !== 'archived'; })
            .map(function(m) { return m.position; })
            .filter(Boolean);
        
        for (var i = 0; i < HOUSE_POSITIONS.length; i++) {
            var pos = HOUSE_POSITIONS[i];
            var taken = usedPositions.some(function(u) {
                return u && Math.abs(u.x - pos.x) < 3 && Math.abs(u.z - pos.z) < 3;
            });
            if (!taken) return { x: pos.x, z: pos.z };
        }
        // Fallback: random position in outer ring
        var angle = Math.random() * Math.PI * 2;
        var r = 25 + Math.random() * 10;
        return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
    }

    function buildHouse3D(mission, animate) {
        if (typeof THREE === 'undefined' || !window.castleApp || !window.castleApp.scene) return;
        
        var colorIdx = missions.indexOf(mission) % HOUSE_COLORS.length;
        if (colorIdx < 0) colorIdx = Math.abs(mission.id.charCodeAt(8) || 0) % HOUSE_COLORS.length;
        var palette = HOUSE_COLORS[colorIdx];
        var pos = mission.position;
        if (!pos) return;

        var group = new THREE.Group();

        // Walls
        var w = 1.8 + Math.random() * 0.4;
        var h = 1.2 + Math.random() * 0.4;
        var d = 1.6 + Math.random() * 0.3;
        var walls = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: palette.walls })
        );
        walls.position.y = h / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);

        // Colored roof
        var roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.5, 4),
            new THREE.MeshStandardMaterial({ color: mission.color ? parseInt(mission.color.replace('#',''), 16) : palette.roof })
        );
        roof.position.y = h + h * 0.25;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);

        // Door
        var door = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.5, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        door.position.set(0, 0.25, d / 2 + 0.03);
        group.add(door);

        // Status light (small sphere on roof)
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

        // Tag all meshes for raycasting
        group.traverse(function(child) {
            if (child.isMesh) {
                child.userData.missionId = mission.id;
                child.userData.buildingName = '🏠 ' + mission.name;
            }
        });

        // Add to scene and building groups
        window.castleApp.scene.add(group);
        window.castleApp.buildingGroups = window.castleApp.buildingGroups || [];
        window.castleApp.buildingGroups.push(group);
        houseGroups.set(mission.id, group);

        // Floating label
        var label = document.createElement('div');
        label.className = 'building-label mission-house-label';
        label.textContent = (mission.icon || '🏠') + ' ' + mission.name;
        label.style.cssText = 'pointer-events:none;';
        var container = document.getElementById('scene-container');
        if (container) container.appendChild(label);
        houseLabels.set(mission.id, label);

        // Add to castleApp's buildingLabels for position tracking
        if (window.castleApp.buildingLabels) {
            window.castleApp.buildingLabels.push({
                label: label,
                position: new THREE.Vector3(pos.x, h + h * 0.5 + 0.8, pos.z),
            });
        }

        // Construction animation
        if (animate) {
            group.scale.set(1, 0.01, 1);
            var startTime = performance.now();
            var buildDuration = 2000;

            // Dust particles
            var dustGroup = new THREE.Group();
            var dustGeo = new THREE.SphereGeometry(0.03, 4, 4);
            for (var i = 0; i < 15; i++) {
                var dustMat = new THREE.MeshBasicMaterial({
                    color: 0xD2B48C, transparent: true, opacity: 0.6,
                });
                var dust = new THREE.Mesh(dustGeo, dustMat);
                dust.position.set(
                    (Math.random() - 0.5) * w * 1.5,
                    Math.random() * 0.5,
                    (Math.random() - 0.5) * d * 1.5
                );
                dust.userData.riseSpeed = 0.5 + Math.random() * 1.5;
                dust.userData.drift = (Math.random() - 0.5) * 0.8;
                dustGroup.add(dust);
            }
            dustGroup.position.set(pos.x, 0, pos.z);
            window.castleApp.scene.add(dustGroup);

            function animateBuild() {
                var elapsed = performance.now() - startTime;
                var t = Math.min(elapsed / buildDuration, 1);
                // Ease out bounce
                var eased = t < 0.8 ? (t / 0.8) : 1 + Math.sin((t - 0.8) / 0.2 * Math.PI) * 0.03;
                group.scale.y = Math.max(0.01, eased);

                // Dust rises and fades
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
                    dustGroup.children.forEach(function(p) {
                        p.geometry.dispose(); p.material.dispose();
                    });
                }
            }
            requestAnimationFrame(animateBuild);
        }

        return group;
    }

    // ── Decommission Animation ────────────────────────────────────────
    function decommissionHouse(missionId) {
        var group = houseGroups.get(missionId);
        if (!group || !window.castleApp) return;

        var mission = missions.find(function(m) { return m.id === missionId; });
        if (mission) {
            mission.status = 'archived';
            saveMissions();
        }

        var startTime = performance.now();
        var duration = 1500;

        // Dust cloud
        var dustGroup = new THREE.Group();
        var dustGeo = new THREE.SphereGeometry(0.05, 4, 4);
        for (var i = 0; i < 25; i++) {
            var mat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xD2B48C : 0xA0896C,
                transparent: true, opacity: 0.8,
            });
            var p = new THREE.Mesh(dustGeo, mat);
            p.position.set(
                (Math.random() - 0.5) * 3,
                Math.random() * 0.3,
                (Math.random() - 0.5) * 3
            );
            p.userData.riseSpeed = 1 + Math.random() * 2;
            p.userData.drift = (Math.random() - 0.5) * 1.5;
            dustGroup.add(p);
        }
        dustGroup.position.copy(group.position);
        window.castleApp.scene.add(dustGroup);

        function animateCollapse() {
            var elapsed = performance.now() - startTime;
            var t = Math.min(elapsed / duration, 1);

            // Scale down + sink into ground
            group.scale.y = Math.max(0.01, 1 - t);
            group.position.y = -t * 0.5;

            // Fade out materials
            group.traverse(function(child) {
                if (child.isMesh && child.material) {
                    if (!child.material._cloned) {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material._cloned = true;
                    }
                    child.material.opacity = Math.max(0, 1 - t * 1.5);
                }
            });

            // Dust rises
            dustGroup.children.forEach(function(dp) {
                dp.position.y += dp.userData.riseSpeed * 0.016;
                dp.position.x += dp.userData.drift * 0.016;
                dp.material.opacity = Math.max(0, 0.8 * (1 - t * 0.8));
            });

            if (t < 1) {
                requestAnimationFrame(animateCollapse);
            } else {
                // Cleanup
                window.castleApp.scene.remove(group);
                group.traverse(function(c) {
                    if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
                });
                window.castleApp.scene.remove(dustGroup);
                dustGroup.children.forEach(function(dp) { dp.geometry.dispose(); dp.material.dispose(); });

                // Remove from building groups
                var bgs = window.castleApp.buildingGroups || [];
                var idx = bgs.indexOf(group);
                if (idx >= 0) bgs.splice(idx, 1);

                // Remove label
                var label = houseLabels.get(missionId);
                if (label) { label.remove(); houseLabels.delete(missionId); }

                // Remove from label tracking
                if (window.castleApp.buildingLabels) {
                    window.castleApp.buildingLabels = window.castleApp.buildingLabels.filter(function(bl) {
                        return bl.label !== label;
                    });
                }

                houseGroups.delete(missionId);

                if (window.castleApp.addActivityLog) {
                    window.castleApp.addActivityLog('🏚️ ' + (mission ? mission.name : 'Mission') + ' house demolished', 'system');
                }
            }
        }
        requestAnimationFrame(animateCollapse);
    }

    // ── Mission Detail Overlay ────────────────────────────────────────
    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function showMissionOverlay(missionId) {
        var mission = missions.find(function(m) { return m.id === missionId; });
        if (!mission) return;

        // Remove existing overlay
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
            '<div style="text-align:center;margin-bottom:20px;">' +
                '<h2 style="font-family:Crimson Text,serif;font-size:28px;color:#c9a959;margin:0 0 4px;text-shadow:0 0 15px rgba(201,169,89,.3);">' + esc(mission.icon || '🏠') + ' ' + esc(mission.name) + '</h2>' +
                '<span style="display:inline-block;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:600;color:#fff;background:' + (statusColors[mission.status] || '#6b7280') + ';">' + (statusLabels[mission.status] || mission.status) + '</span>' +
                '<span style="margin-left:8px;font-size:11px;color:rgba(168,162,153,.6);">Created ' + new Date(mission.created).toLocaleDateString() + '</span>' +
            '</div>' +
            '<div style="width:60%;margin:0 auto 20px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,169,89,.4),transparent);"></div>' +

            // Progress bar
            '<div style="margin-bottom:20px;">' +
                '<div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(168,162,153,.7);margin-bottom:6px;"><span>Progress</span><span>' + doneTasks + '/' + tasks.length + ' tasks (' + pct + '%)</span></div>' +
                '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#c9a959,#f59e0b);border-radius:3px;transition:width 0.3s;"></div></div>' +
            '</div>' +

            // Tasks
            '<div style="font-family:Crimson Text,serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;">Tasks</div>' +
            '<div id="mh-tasks" style="margin-bottom:20px;">' +
                (tasks.length === 0 ? '<div style="padding:12px;text-align:center;color:rgba(168,162,153,.5);font-size:12px;">No tasks yet. Start a chat to plan!</div>' : '') +
                tasks.map(function(t, i) {
                    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;margin-bottom:4px;background:rgba(255,255,255,.03);border:1px solid rgba(168,162,153,.15);">' +
                        '<input type="checkbox" ' + (t.done ? 'checked' : '') + ' class="mh-task-check" data-idx="' + i + '" style="accent-color:#c9a959;" />' +
                        '<span style="flex:1;font-size:13px;color:' + (t.done ? 'rgba(168,162,153,.4)' : '#f4e4bc') + ';' + (t.done ? 'text-decoration:line-through;' : '') + '">' + esc(t.text) + '</span>' +
                        '<button class="mh-task-del" data-idx="' + i + '" style="background:none;border:none;color:rgba(168,162,153,.4);cursor:pointer;font-size:14px;" title="Remove">✕</button>' +
                    '</div>';
                }).join('') +
            '</div>' +

            // Add task
            '<div style="display:flex;gap:8px;margin-bottom:20px;">' +
                '<input id="mh-new-task" type="text" placeholder="Add a task..." style="flex:1;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:13px;padding:8px 10px;outline:none;" />' +
                '<button id="mh-add-task" style="padding:8px 14px;background:rgba(201,169,89,.15);border:1px solid rgba(201,169,89,.4);border-radius:4px;color:#c9a959;font-size:13px;cursor:pointer;">+ Add</button>' +
            '</div>' +

            // Chat area
            '<div style="font-family:Crimson Text,serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;">Mission Decree</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:20px;">' +
                '<textarea id="mh-chat-input" rows="2" placeholder="Send a message to this mission context..." style="flex:1;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:13px;padding:8px 10px;resize:none;outline:none;font-family:inherit;"></textarea>' +
                '<button id="mh-chat-send" style="padding:8px 14px;background:rgba(201,169,89,.15);border:1px solid rgba(201,169,89,.4);border-radius:4px;color:#c9a959;font-size:13px;cursor:pointer;align-self:flex-end;">📜 Send</button>' +
            '</div>' +

            // Action buttons
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
                (mission.status === 'active' ? '<button class="mh-action" data-action="pause" style="padding:8px 16px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.4);border-radius:4px;color:#fbbf24;font-size:12px;cursor:pointer;">⏸️ Pause</button>' : '') +
                (mission.status === 'paused' ? '<button class="mh-action" data-action="resume" style="padding:8px 16px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.4);border-radius:4px;color:#34d399;font-size:12px;cursor:pointer;">▶️ Resume</button>' : '') +
                (mission.status !== 'done' && mission.status !== 'archived' ? '<button class="mh-action" data-action="done" style="padding:8px 16px;background:rgba(156,163,175,.1);border:1px solid rgba(156,163,175,.4);border-radius:4px;color:#9ca3af;font-size:12px;cursor:pointer;">✅ Complete</button>' : '') +
                '<button class="mh-action" data-action="decommission" style="padding:8px 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);border-radius:4px;color:#f87171;font-size:12px;cursor:pointer;">🏚️ Demolish</button>' +
            '</div>';

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        activeOverlay = overlay;

        // Fade in
        requestAnimationFrame(function() { overlay.style.opacity = '1'; });

        // Wire close
        document.getElementById('mh-close').addEventListener('click', closeMissionOverlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeMissionOverlay(); });
        document.addEventListener('keydown', _escHandler);

        // Wire task checkbox toggle
        content.querySelectorAll('.mh-task-check').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var idx = parseInt(this.dataset.idx);
                if (mission.tasks[idx]) {
                    mission.tasks[idx].done = this.checked;
                    saveMissions();
                    updateHouseStatus(missionId);
                }
            });
        });

        // Wire task delete
        content.querySelectorAll('.mh-task-del').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx);
                mission.tasks.splice(idx, 1);
                saveMissions();
                closeMissionOverlay();
                showMissionOverlay(missionId);
            });
        });

        // Wire add task
        document.getElementById('mh-add-task').addEventListener('click', function() {
            var input = document.getElementById('mh-new-task');
            var text = input.value.trim();
            if (!text) return;
            mission.tasks = mission.tasks || [];
            mission.tasks.push({ text: text, done: false });
            saveMissions();
            closeMissionOverlay();
            showMissionOverlay(missionId);
        });
        document.getElementById('mh-new-task').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('mh-add-task').click();
        });

        // Wire chat send
        document.getElementById('mh-chat-send').addEventListener('click', function() {
            var input = document.getElementById('mh-chat-input');
            var text = input.value.trim();
            if (!text) return;
            // Prepend mission context for routing
            var fullMsg = '[Mission: ' + mission.name + '] ' + text;
            if (window.ThemeChat && typeof window.ThemeChat.sendMessage === 'function') {
                window.ThemeChat.sendMessage(fullMsg);
            } else {
                fetch('/api/oc/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: fullMsg })
                }).catch(function() {});
            }
            input.value = '';
            closeMissionOverlay();
            // Show chat panel
            var chatEl = document.getElementById('medievalChat');
            if (chatEl) { chatEl.style.display = 'flex'; chatEl.style.flexDirection = 'column'; }
        });

        // Wire action buttons
        content.querySelectorAll('.mh-action').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = this.dataset.action;
                if (action === 'pause') { mission.status = 'paused'; }
                else if (action === 'resume') { mission.status = 'active'; }
                else if (action === 'done') { mission.status = 'done'; }
                else if (action === 'decommission') {
                    if (!confirm('Demolish the ' + mission.name + ' house? Mission will be archived.')) return;
                    closeMissionOverlay();
                    decommissionHouse(missionId);
                    return;
                }
                saveMissions();
                updateHouseStatus(missionId);
                closeMissionOverlay();
                showMissionOverlay(missionId);
            });
        });
    }

    function _escHandler(e) {
        if (e.key === 'Escape' && activeOverlay) closeMissionOverlay();
    }

    function closeMissionOverlay() {
        if (!activeOverlay) return;
        activeOverlay.style.opacity = '0';
        var ov = activeOverlay;
        activeOverlay = null;
        setTimeout(function() { ov.remove(); }, 300);
        document.removeEventListener('keydown', _escHandler);
    }

    // ── Status update (change roof glow color) ────────────────────────
    function updateHouseStatus(missionId) {
        var mission = missions.find(function(m) { return m.id === missionId; });
        var group = houseGroups.get(missionId);
        if (!mission || !group) return;

        var statusColor = mission.status === 'active' ? 0x34d399 : mission.status === 'paused' ? 0xfbbf24 : 0x9ca3af;
        group.traverse(function(child) {
            if (child.name === 'statusLight' && child.material) {
                child.material.color.setHex(statusColor);
            }
        });
    }

    // ── Create Mission Dialog ─────────────────────────────────────────
    function showCreateDialog() {
        if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }

        var activeMissions = missions.filter(function(m) { return m.status !== 'archived'; });
        if (activeMissions.length >= MAX_HOUSES) {
            alert('Maximum ' + MAX_HOUSES + ' active houses. Demolish one first!');
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = 'mission-create-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(5,10,25,0.85);opacity:0;transition:opacity 0.3s;';

        var content = document.createElement('div');
        content.style.cssText = 'width:min(500px,90vw);background:rgba(15,25,50,.92);border:1px solid rgba(201,169,89,.4);border-radius:4px;padding:28px;box-shadow:0 0 60px rgba(201,169,89,.15);';

        var icons = ['🌐', '📱', '🎮', '🛡️', '🔮', '📦', '🎯', '⚗️', '🗂️', '🚀', '💎', '🏗️'];

        content.innerHTML = 
            '<h2 style="font-family:Crimson Text,serif;font-size:24px;color:#c9a959;margin:0 0 20px;text-align:center;text-shadow:0 0 15px rgba(201,169,89,.3);">🏗️ Build New Mission House</h2>' +
            '<div style="margin-bottom:16px;">' +
                '<label style="font-size:12px;color:rgba(168,162,153,.7);display:block;margin-bottom:4px;">Mission Name</label>' +
                '<input id="mc-name" type="text" placeholder="e.g. Translator, Remember, SpawnKit..." style="width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:15px;padding:10px 12px;outline:none;" autofocus />' +
            '</div>' +
            '<div style="margin-bottom:16px;">' +
                '<label style="font-size:12px;color:rgba(168,162,153,.7);display:block;margin-bottom:4px;">Icon</label>' +
                '<div id="mc-icons" style="display:flex;gap:8px;flex-wrap:wrap;">' +
                    icons.map(function(ic, i) {
                        return '<span class="mc-icon-pick" data-icon="' + ic + '" style="font-size:24px;cursor:pointer;padding:6px 8px;border-radius:6px;border:2px solid ' + (i === 0 ? 'rgba(201,169,89,.6)' : 'transparent') + ';background:rgba(255,255,255,.03);transition:border-color 0.15s;">' + ic + '</span>';
                    }).join('') +
                '</div>' +
            '</div>' +
            '<div style="margin-bottom:20px;">' +
                '<label style="font-size:12px;color:rgba(168,162,153,.7);display:block;margin-bottom:4px;">First Task (optional)</label>' +
                '<input id="mc-task" type="text" placeholder="What needs to be done first?" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:#f4e4bc;font-size:13px;padding:8px 10px;outline:none;" />' +
            '</div>' +
            '<div style="display:flex;gap:10px;justify-content:center;">' +
                '<button id="mc-cancel" style="padding:10px 24px;background:rgba(168,162,153,.1);border:1px solid rgba(168,162,153,.3);border-radius:4px;color:rgba(168,162,153,.7);font-size:14px;cursor:pointer;">Cancel</button>' +
                '<button id="mc-create" style="padding:10px 24px;background:rgba(201,169,89,.15);border:1px solid rgba(201,169,89,.5);border-radius:4px;color:#c9a959;font-family:Crimson Text,serif;font-size:16px;cursor:pointer;">🏗️ Build House</button>' +
            '</div>';

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        activeOverlay = overlay;
        requestAnimationFrame(function() { overlay.style.opacity = '1'; });

        var selectedIcon = icons[0];

        // Icon selection
        content.querySelectorAll('.mc-icon-pick').forEach(function(el) {
            el.addEventListener('click', function() {
                content.querySelectorAll('.mc-icon-pick').forEach(function(e) { e.style.borderColor = 'transparent'; });
                this.style.borderColor = 'rgba(201,169,89,.6)';
                selectedIcon = this.dataset.icon;
            });
        });

        // Cancel
        document.getElementById('mc-cancel').addEventListener('click', closeMissionOverlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeMissionOverlay(); });
        document.addEventListener('keydown', _escHandler);

        // Create
        document.getElementById('mc-create').addEventListener('click', function() {
            var name = document.getElementById('mc-name').value.trim();
            if (!name) { document.getElementById('mc-name').focus(); return; }

            var task = document.getElementById('mc-task').value.trim();
            var pos = getNextPosition();
            var colorIdx = missions.length % HOUSE_COLORS.length;

            var mission = {
                id: genId(),
                name: name,
                icon: selectedIcon,
                status: 'active',
                color: '#' + HOUSE_COLORS[colorIdx].roof.toString(16).padStart(6, '0'),
                agents: [],
                tasks: task ? [{ text: task, done: false }] : [],
                position: pos,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            };

            missions.push(mission);
            saveMissions();
            closeMissionOverlay();
            buildHouse3D(mission, true);

            if (window.castleApp && window.castleApp.addActivityLog) {
                window.castleApp.addActivityLog('🏗️ New mission house: ' + name, 'system');
            }
        });

        // Enter to create
        document.getElementById('mc-name').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') document.getElementById('mc-create').click();
        });

        // Focus
        setTimeout(function() { document.getElementById('mc-name').focus(); }, 100);
    }

    // ── Click Handler Integration ─────────────────────────────────────
    function handleBuildingClick(name) {
        // Check if clicked building is a mission house
        if (name && name.startsWith('🏠 ')) {
            var missionName = name.substring(3);
            var mission = missions.find(function(m) { return m.name === missionName; });
            if (mission) {
                showMissionOverlay(mission.id);
                return true; // consumed
            }
        }
        return false;
    }

    // ── Init: Restore houses on page load ─────────────────────────────
    function init() {
        loadMissions();
        
        // Wait for scene to be ready
        function tryBuild() {
            if (!window.castleApp || !window.castleApp.scene) {
                setTimeout(tryBuild, 500);
                return;
            }
            // Build all active/paused/done houses (no animation on restore)
            missions.forEach(function(m) {
                if (m.status !== 'archived' && m.position) {
                    buildHouse3D(m, false);
                }
            });
        }
        tryBuild();
    }

    // ── Public API ────────────────────────────────────────────────────
    window.MissionHouses = {
        create: showCreateDialog,
        show: showMissionOverlay,
        decommission: decommissionHouse,
        handleClick: handleBuildingClick,
        getMissions: function() { return missions.slice(); },
        addMission: function(name, icon) {
            var pos = getNextPosition();
            var colorIdx = missions.length % HOUSE_COLORS.length;
            var mission = {
                id: genId(), name: name, icon: icon || '🏠',
                status: 'active',
                color: '#' + HOUSE_COLORS[colorIdx].roof.toString(16).padStart(6, '0'),
                agents: [], tasks: [], position: pos,
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
            };
            missions.push(mission);
            saveMissions();
            buildHouse3D(mission, true);
            return mission;
        },
    };

    init();
})();
