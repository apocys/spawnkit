/* medieval-panels.js — Building click → contextual side panel (IIFE) */
(function () {
    'use strict';

    // ── Panel config ────────────────────────────────────────────────────
    var BUILDING_PANELS = {
        '⚔️ Mission Hall': { icon: '⚔️', title: 'Mission Hall',      render: renderMissionHall },
        '🍺 Tavern':       { icon: '🍺', title: 'Brainstorm Tavern', render: renderTavern },
        '📚 Library':      { icon: '📚', title: 'Agent Library',     render: renderLibrary },
        '🔨 Forge Workshop':{ icon: '🔨', title: 'Skill Forge',      render: renderForge },
        '🏪 Market':       { icon: '🏪', title: 'Skill Marketplace', render: renderMarket },
        '🏠 Chapel':       { icon: '🏠', title: 'Settings',         render: renderSettings },
        '🏰 Rookery':      { icon: '🐦⬛', title: 'Allied Kingdoms',  render: function(c) { if (window.renderAlliedKingdoms) window.renderAlliedKingdoms(c); else c.innerHTML = '<div class="bp-empty">Rookery module not loaded.</div>'; } },
        '🏟️ Arena':        { icon: '🏟️', title: 'Arena Coliseum',    render: function(c) { if (window.MedievalArena) window.MedievalArena.render(c); else c.innerHTML = '<div class="bp-empty">⚔️ Arena not loaded yet.</div>'; } },
    };

    // Expose panels map for runtime registration (allows dynamic modules to add panels)
    window._buildingPanelsMap = BUILDING_PANELS;

    // ── Inject CSS ───────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = '.bp-card{background:rgba(22,33,62,0.6);border:1px solid var(--border-stone,rgba(168,162,153,0.2));border-radius:8px;padding:12px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s;}'
        + '.bp-card:hover{border-color:rgba(201,169,89,0.5);}.bp-card.bp-expanded{border-color:rgba(201,169,89,0.6);}'
        + '.bp-section-title{font-family:"Crimson Text",serif;font-size:14px;color:rgba(201,169,89,0.9);margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.5px;}'
        + '.bp-row{display:flex;align-items:center;gap:8px;}.bp-status{width:8px;height:8px;border-radius:50%;background:#666;flex-shrink:0;}'
        + '.bp-status.active{background:#4caf50;}.bp-status.idle{background:#ff9800;}.bp-status.thinking{background:#2196f3;animation:bp-pulse 1s infinite;}'
        + '@keyframes bp-pulse{0%,100%{opacity:1}50%{opacity:0.4}}'
        + '.bp-tag{font-size:10px;background:rgba(201,169,89,0.15);border:1px solid rgba(201,169,89,0.3);border-radius:4px;padding:1px 5px;color:rgba(201,169,89,0.8);}'
        + '.bp-btn{background:rgba(201,169,89,0.15);border:1px solid rgba(201,169,89,0.4);color:rgba(201,169,89,0.9);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;}'
        + '.bp-btn:hover{background:rgba(201,169,89,0.25);}.bp-input{width:100%;box-sizing:border-box;background:rgba(15,52,96,0.5);border:1px solid rgba(168,162,153,0.3);border-radius:6px;padding:8px;color:#f4e4bc;font-size:13px;resize:none;}'
        + '.bp-input:focus{outline:none;border-color:rgba(201,169,89,0.5);}.bp-progress-bar{height:4px;background:rgba(168,162,153,0.2);border-radius:2px;margin-top:6px;}'
        + '.bp-progress-fill{height:100%;background:rgba(201,169,89,0.7);border-radius:2px;transition:width 0.4s;}.bp-detail{margin-top:8px;font-size:12px;color:rgba(168,162,153,0.8);}'
        + '.bp-empty{text-align:center;color:rgba(168,162,153,0.5);padding:32px 16px;font-style:italic;}.bp-skill-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}'
        + '.bp-conn-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(168,162,153,0.1);}'
        /* Brainstorm expanded detail */
        + '.bp-brainstorm-detail{margin-top:10px;padding:10px;background:rgba(15,52,96,0.35);border-radius:6px;border:1px solid rgba(201,169,89,0.15);display:none;}'
        + '.bp-brainstorm-detail p{font-size:12px;color:#f4e4bc;margin:0 0 8px;white-space:pre-wrap;word-break:break-word;}'
        + '.bp-brainstorm-detail .bp-brainstorm-reply{font-size:11px;color:rgba(168,162,153,0.8);border-top:1px solid rgba(168,162,153,0.15);padding-top:8px;margin-top:4px;white-space:pre-wrap;word-break:break-word;}'
        /* Skill cards */
        + '.bp-skill-card{background:rgba(22,33,62,0.7);border:1px solid rgba(168,162,153,0.2);border-radius:8px;padding:10px 12px;margin-bottom:8px;transition:border-color 0.2s;}'
        + '.bp-skill-card:hover{border-color:rgba(201,169,89,0.4);}'
        + '.bp-skill-install{font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid rgba(201,169,89,0.4);background:rgba(201,169,89,0.1);color:rgba(201,169,89,0.9);cursor:pointer;}'
        + '.bp-skill-install:disabled{opacity:0.5;cursor:not-allowed;}';
    document.head.appendChild(style);

    // ── Ensure panel DOM exists — wires close button reliably ──────────
    function ensurePanelDOM() {
        var existing = document.getElementById('building-panel');
        if (existing) {
            // Fix: make sure the close button in the existing panel works
            // (index.html has one pre-rendered, button uses onclick="closeBuildingPanel()")
            // closeBuildingPanel is defined below — just ensure it's exposed globally
            return;
        }
        var p = document.createElement('div');
        p.id = 'building-panel';
        p.className = 'building-panel';
        p.innerHTML = [
            '<div class="building-panel-header">',
            '<span id="building-panel-icon"></span>',
            '<span id="building-panel-title"></span>',
            '<button class="panel-close-btn" id="building-panel-close-btn">✕</button>',
            '</div>',
            '<div id="building-panel-content" class="building-panel-content"></div>',
        ].join('');
        document.body.appendChild(p);
        // Wire close button via addEventListener (not inline onclick) so it always works
        p.querySelector('#building-panel-close-btn').addEventListener('click', function() {
            window.closeBuildingPanel();
        });
    }

    // Fix close button on pre-rendered panel (from index.html inline onclick)
    // The button uses onclick="closeBuildingPanel()" which resolves against window — so just define it early.
    // Do this immediately, before DOMContentLoaded.
    window.closeBuildingPanel = function () {
        var panel = document.getElementById('building-panel');
        if (panel) panel.classList.remove('panel-open');
        var app = window.castleApp;
        if (app) clearBuildingGlow(app);
    };

    // ── Global overlay dismiss — close ALL overlay systems before opening a new one ──
    window.dismissAllOverlays = function(except) {
        if (except !== 'buildingPanel') {
            var bp = document.getElementById('building-panel');
            if (bp) bp.classList.remove('panel-open');
            var app = window.castleApp;
            if (app) clearBuildingGlow(app);
        }
        if (except !== 'missionOverlay' && window.MissionHouses && window.MissionHouses._closeOverlay) {
            window.MissionHouses._closeOverlay();
        }
        if (except !== 'missionControl') {
            var mc = document.querySelector('.mc-overlay');
            if (mc && mc.classList.contains('visible')) {
                mc.classList.remove('visible');
                setTimeout(function() { mc.style.display = 'none'; }, 300);
            }
        }
        if (except !== 'royalCourt') {
            var rc = document.querySelector('.rc-overlay');
            if (rc) { rc.classList.remove('rc-faded-in'); rc.classList.remove('rc-visible'); }
        }
        if (except !== 'summonWizard' && window.SummonWizard && window.SummonWizard.close) {
            window.SummonWizard.close();
        }
        if (window.PersonaCard && window.PersonaCard.close) window.PersonaCard.close();
        var sidebar = document.querySelector('.castle-sidebar');
        if (sidebar) sidebar.classList.remove('panel-open');
    };

    // ── Public: open panel ──────────────────────────────────────────────
    window.openBuildingPanel = function (buildingName) {
        var cfg = BUILDING_PANELS[buildingName];
        if (!cfg) return;

        window.dismissAllOverlays('buildingPanel');
        ensurePanelDOM();
        document.getElementById('building-panel-icon').textContent  = cfg.icon;
        document.getElementById('building-panel-title').textContent = cfg.title;

        var content = document.getElementById('building-panel-content');
        content.innerHTML = '';
        cfg.render(content);

        document.getElementById('building-panel').classList.add('panel-open');

        if (window.MedievalBuildingSounds) window.MedievalBuildingSounds.play(buildingName);

        var app = window.castleApp;
        if (app && app._buildingGroups) {
            clearBuildingGlow(app);
            var grp = app._buildingGroups[buildingName];
            if (grp) {
                grp.traverse(function (mesh) {
                    if (mesh.isMesh && mesh.material) {
                        if (!mesh._origMaterial) mesh._origMaterial = mesh.material;
                        var oldColor = mesh.material.color ? mesh.material.color.getHex() : 0xcccccc;
                        mesh.material = new THREE.MeshStandardMaterial({ color: oldColor, emissive: 0xffaa00, emissiveIntensity: 0.6 });
                    }
                });
                app._selectedBuilding = grp;
            }
        }
    };

    function clearBuildingGlow(app) {
        if (!app._selectedBuilding) return;
        app._selectedBuilding.traverse(function (mesh) {
            if (mesh.isMesh && mesh._origMaterial) {
                if (mesh.material && mesh.material !== mesh._origMaterial) mesh.material.dispose();
                mesh.material = mesh._origMaterial;
                delete mesh._origMaterial;
            }
        });
        app._selectedBuilding = null;
    }

    // ── Render: Mission Hall ────────────────────────────────────────────
    function renderMissionHall(container) {
        var html = '';
        html += '<button class="bp-btn" id="bp-new-mission" style="width:100%;margin-bottom:12px;background:rgba(201,169,89,.15);border-color:rgba(201,169,89,.5);color:#c9a959;font-size:14px;">🏗️ New Mission</button>';
        html += '<button class="bp-btn" id="bp-open-mc" style="width:100%;margin-bottom:16px;font-size:12px;">⚔️ Open Mission Control</button>';
        html += '<div class="bp-section-title">Active Missions</div>';
        html += '<div id="bp-active-missions"></div>';
        html += '<div class="bp-section-title" style="margin-top:12px;">Mission History</div>';
        html += '<div id="bp-mission-history"></div>';
        container.innerHTML = html;

        document.getElementById('bp-new-mission').addEventListener('click', function() {
            window.closeBuildingPanel();
            setTimeout(function() {
                if (window.MissionHouses && window.MissionHouses.create) window.MissionHouses.create();
            }, 200);
        });
        document.getElementById('bp-open-mc').addEventListener('click', function() {
            window.closeBuildingPanel();
            setTimeout(function() { if (window.openMissionControl) window.openMissionControl(); }, 200);
        });

        var activeEl = document.getElementById('bp-active-missions');
        var histEl = document.getElementById('bp-mission-history');

        if (window.MissionHouses && window.MissionHouses.getMissions) {
            var allMissions = window.MissionHouses.getMissions();
            var active = allMissions.filter(function(m) { return m.status === 'active' || m.status === 'paused'; });
            var archived = allMissions.filter(function(m) { return m.status === 'done' || m.status === 'archived'; });

            if (active.length === 0) {
                activeEl.innerHTML = '<div class="bp-empty">No active missions.<br>Build a new one to start!</div>';
            } else {
                active.forEach(function(m) { activeEl.appendChild(missionHouseCard(m)); });
            }
            if (archived.length === 0) {
                histEl.innerHTML = '<div class="bp-empty">No completed missions yet.</div>';
            } else {
                archived.slice(0, 5).forEach(function(m) { histEl.appendChild(missionHouseCard(m)); });
            }
        } else {
            activeEl.innerHTML = '<div class="bp-empty">Mission system loading…</div>';
        }
    }

    function missionHouseCard(m) {
        var c = document.createElement('div');
        c.className = 'bp-card';
        c.style.cssText = 'cursor:pointer;transition:border-color 0.15s;';
        var tasks = m.tasks || [];
        var done = tasks.filter(function(t) { return t.done; }).length;
        var total = tasks.length;
        var pct = total > 0 ? Math.round(done / total * 100) : 0;
        var statusColors = { active: '#34d399', paused: '#fbbf24', done: '#9ca3af', archived: '#6b7280' };
        var statusLabel = m.status.charAt(0).toUpperCase() + m.status.slice(1);
        c.innerHTML =
            '<div class="bp-row">' +
                '<span style="font-size:18px;margin-right:6px;">' + esc(m.icon || '🏠') + '</span>' +
                '<strong style="flex:1;font-size:13px;color:#f4e4bc;">' + esc(m.name) + '</strong>' +
                '<span class="bp-tag" style="background:' + (statusColors[m.status] || '#6b7280') + '22;color:' + (statusColors[m.status] || '#6b7280') + ';">' + esc(statusLabel) + '</span>' +
            '</div>' +
            (total > 0 ? '<div style="margin-top:6px;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (statusColors[m.status] || '#6b7280') + ';border-radius:2px;"></div></div><div style="font-size:10px;color:rgba(168,162,153,.5);margin-top:2px;">' + done + '/' + total + ' tasks</div>' : '');
        c.addEventListener('click', function() {
            window.closeBuildingPanel();
            setTimeout(function() {
                if (m.position && window.castleApp && window.castleApp.focusPosition) {
                    window.castleApp.focusPosition(m.position.x, m.position.z);
                }
                if (window.MissionHouses && window.MissionHouses.show) window.MissionHouses.show(m.id);
            }, 200);
        });
        c.addEventListener('mouseenter', function() { c.style.borderColor = 'rgba(201,169,89,.4)'; });
        c.addEventListener('mouseleave', function() { c.style.borderColor = ''; });
        return c;
    }

    // ── Render: Tavern ──────────────────────────────────────────────────
    function renderTavern(container) {
        container.innerHTML = [
            '<div class="bp-section-title">Brainstorm Room</div>',
            '<textarea class="bp-input" rows="3" placeholder="Type a question to brainstorm…" id="bp-brainstorm-input"></textarea>',
            '<div style="margin:6px 0 16px;text-align:right">',
            '<button class="bp-btn" id="bp-brainstorm-send">🍺 Start Brainstorm</button>',
            '</div>',
            '<div class="bp-section-title">Recent Brainstorms</div>',
            '<div id="bp-brainstorm-list"><div class="bp-empty">Loading past brainstorms…</div></div>',
        ].join('');

        loadBrainstormHistory();

        document.getElementById('bp-brainstorm-send').addEventListener('click', async function () {
            var input = document.getElementById('bp-brainstorm-input');
            var q = input.value.trim();
            if (!q) return;
            var btn = document.getElementById('bp-brainstorm-send');
            btn.disabled = true;
            btn.textContent = '⏳ Consulting the oracle...';
            saveBrainstorm({ q: q, ts: new Date().toISOString(), source: 'tavern' });
            input.value = '';
            try {
                var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch)
                    ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
                var resp = await fetcher('/api/oc/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: '/brainstorm ' + q })
                });
                var data = await resp.json();
                var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
                    ? data.choices[0].message.content
                    : (data.reply || data.text || data.response || null);
                if (reply) {
                    // Update the last item with the reply
                    var hist = [];
                    try { hist = JSON.parse(localStorage.getItem('sk_brainstorms') || '[]'); } catch(e) {}
                    if (hist.length && hist[0].q === q) { hist[0].reply = reply; hist[0].replied = true; }
                    localStorage.setItem('sk_brainstorms', JSON.stringify(hist));
                }
            } catch(e) { /* silently queue */ }
            loadBrainstormHistory();
            btn.disabled = false;
            btn.textContent = '🍺 Start Brainstorm';
        });
    }

    function saveBrainstorm(item) {
        var history = [];
        try { history = JSON.parse(localStorage.getItem('sk_brainstorms') || '[]'); } catch(e) {}
        // item can be a string (legacy) or {q, ts, source, reply}
        var entry = typeof item === 'string'
            ? { q: item, ts: new Date().toISOString(), source: 'tavern' }
            : item;
        history.unshift(entry);
        if (history.length > 50) history = history.slice(0, 50);
        localStorage.setItem('sk_brainstorms', JSON.stringify(history));
    }

    function loadBrainstormHistory() {
        var list = document.getElementById('bp-brainstorm-list');
        if (!list) return;

        var local = [];
        try { local = JSON.parse(localStorage.getItem('sk_brainstorms') || '[]'); } catch(e) {}

        // Normalize legacy string entries
        local = local.map(function(item) {
            if (typeof item === 'string') return { q: item, ts: '', source: 'tavern' };
            return item;
        });

        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
        fetcher('/api/oc/chat').then(function(r) { return r.json(); }).then(function(msgs) {
            var arr = Array.isArray(msgs) ? msgs : [];

            // Build question→reply pairs from chat history
            var pairs = [];
            var questions = arr.filter(function(m) {
                var text = (m.content || m.text || '');
                return (m.role === 'user' || m.role === 'human') &&
                    (text.startsWith('/brainstorm') || text.startsWith('/mr ') || text.startsWith('/mission') || text.startsWith('/m '));
            });
            questions.reverse().slice(0, 15).forEach(function(q) {
                var qText = (q.content || q.text || '').replace(/^\/(brainstorm|mr|mission|m)\s*/i, '');
                var qTs = q.timestamp || q.ts || '';
                // Find the next assistant message after this question
                var qIdx = arr.indexOf(q);
                var replyMsg = null;
                for (var i = qIdx + 1; i < arr.length && i < qIdx + 5; i++) {
                    if (arr[i].role === 'assistant' || arr[i].role === 'system') {
                        replyMsg = arr[i].content || arr[i].text || '';
                        break;
                    }
                }
                pairs.push({ q: qText, ts: qTs, source: 'telegram', reply: replyMsg });
            });

            // Merge local + API pairs, newest first, dedup by question text
            var seen = new Set();
            var merged = [];
            local.forEach(function(item) { if (!seen.has(item.q)) { seen.add(item.q); merged.push(item); } });
            pairs.forEach(function(item) { if (!seen.has(item.q)) { seen.add(item.q); merged.push(item); } });
            merged.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });

            renderBrainstormList(list, merged.slice(0, 20));
        }).catch(function() {
            renderBrainstormList(list, local);
        });
    }

    function renderBrainstormList(list, items) {
        if (!items.length) {
            list.innerHTML = '<div class="bp-empty">The tavern is quiet… No brainstorms recorded yet.</div>';
            return;
        }
        list.innerHTML = '';
        items.forEach(function(item) {
            var card = document.createElement('div');
            card.className = 'bp-card';
            var icon = item.source === 'telegram' ? '📨' : '🍺';
            var time = item.ts ? new Date(item.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            var questionText = esc((item.q || '').substring(0, 120));
            var hasReply = !!(item.reply);

            // Header row: icon + truncated question + expand arrow
            var headerHTML = '<div style="display:flex;align-items:flex-start;gap:6px;">' +
                '<span style="flex-shrink:0;font-size:13px;">' + icon + '</span>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:12px;color:rgba(201,169,89,0.85);line-height:1.4;">' + questionText + '</div>' +
                    (time ? '<div style="font-size:10px;color:rgba(168,162,153,0.4);margin-top:3px;">' + esc(time) + (item.source === 'telegram' ? ' · Telegram' : '') + (hasReply ? ' · ✓ replied' : '') + '</div>' : '') +
                '</div>' +
                (hasReply ? '<span style="font-size:10px;color:rgba(201,169,89,0.5);flex-shrink:0;padding-top:2px;" class="bp-expand-arrow">▼</span>' : '') +
            '</div>';

            // Detail section: full question + reply
            var detailHTML = hasReply
                ? '<div class="bp-brainstorm-detail">' +
                    '<p>' + esc((item.q || '')) + '</p>' +
                    '<div class="bp-brainstorm-reply">🧠 ' + esc((item.reply || '').substring(0, 1200)) + (item.reply && item.reply.length > 1200 ? '…' : '') + '</div>' +
                  '</div>'
                : '';

            card.innerHTML = headerHTML + detailHTML;

            // Toggle detail on click
            if (hasReply) {
                var detail = card.querySelector('.bp-brainstorm-detail');
                var arrow = card.querySelector('.bp-expand-arrow');
                card.addEventListener('click', function() {
                    var open = detail.style.display === 'block';
                    detail.style.display = open ? 'none' : 'block';
                    if (arrow) arrow.textContent = open ? '▼' : '▲';
                    card.classList.toggle('bp-expanded', !open);
                });
            }

            list.appendChild(card);
        });
    }

    // ── Render: Library ─────────────────────────────────────────────────
    // Shows: active agents + installed skills from /api/oc/skills + ClaWHub browse link
    function renderLibrary(container) {
        container.innerHTML =
            '<div class="bp-section-title">🤖 Knights of the Realm</div>' +
            '<div id="bp-agent-list"><div class="bp-empty">Loading agents…</div></div>' +
            '<div class="bp-section-title" style="margin-top:4px;">📜 Installed Skills</div>' +
            '<div id="bp-skills-list"><div class="bp-empty">Loading skills…</div></div>' +
            '<div style="margin-top:12px;">' +
                '<a href="https://clawhub.com" target="_blank" rel="noopener" style="display:block;padding:10px 14px;background:rgba(201,169,89,0.1);border:1px solid rgba(201,169,89,0.35);border-radius:8px;color:#c9a959;font-size:13px;text-decoration:none;text-align:center;">' +
                    '🌐 Browse ClaWHub Marketplace →' +
                '</a>' +
            '</div>';

        // Load agents
        var agentList = document.getElementById('bp-agent-list');
        var agents = null;
        if (window.castleApp && window.castleApp.agents) {
            agents = window.castleApp.agents instanceof Map
                ? Array.from(window.castleApp.agents.values())
                : Object.values(window.castleApp.agents);
        }
        if (agents && agents.length) {
            renderAgentList(agentList, agents);
        } else {
            var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch)
                ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
            fetcher('/api/oc/agents').then(function(r) { return r.json(); }).then(function(data) {
                renderAgentList(agentList, Array.isArray(data) ? data : (data.agents || []));
            }).catch(function() {
                agentList.innerHTML = '<div class="bp-empty">Could not load agents.</div>';
            });
        }

        // Load skills
        var skillList = document.getElementById('bp-skills-list');
        var fetcher2 = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch)
            ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
        fetcher2('/api/oc/skills').then(function(r) { return r.json(); }).then(function(data) {
            var skills = Array.isArray(data) ? data : (data.skills || []);
            renderSkillList(skillList, skills);
        }).catch(function() {
            skillList.innerHTML = '<div class="bp-empty">Could not load skills.</div>';
        });
    }

    var SKILL_ICONS = {
        'coding-agent':'⚙️','github':'🐙','gh-issues':'🔖','healthcheck':'🛡️',
        'weather':'🌦️','youtube-transcript':'🎥','openai-whisper-api':'🎙️',
        'openai-image-gen':'🖼️','nano-banana-pro':'🍌','skill-creator':'🛠️',
        'clawhub':'🌐','tmux':'💻','video-frames':'🎞️','large-build':'🏗️',
        'systematic-debugging':'🐛','two-stage-review':'🔍','verify-before-done':'✅',
        'awwwards-frontend':'🎨',
    };

    function renderSkillList(container, skills) {
        if (!skills || !skills.length) {
            container.innerHTML = '<div class="bp-empty">No skills installed.<br><a href="https://clawhub.com" target="_blank" style="color:rgba(201,169,89,0.7);">Browse ClaWHub →</a></div>';
            return;
        }
        container.innerHTML = '';
        skills.forEach(function(sk) {
            var icon = SKILL_ICONS[sk.id] || sk.icon || '⚙️';
            var card = document.createElement('div');
            card.className = 'bp-skill-card';
            card.innerHTML =
                '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<span style="font-size:18px;flex-shrink:0;">' + icon + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:13px;color:#f4e4bc;font-weight:500;">' + esc(sk.name || sk.id) + '</div>' +
                        '<div style="font-size:10px;color:rgba(168,162,153,0.6);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc((sk.description || '').substring(0, 80)) + '</div>' +
                    '</div>' +
                    '<span class="bp-tag" style="flex-shrink:0;background:rgba(16,185,129,0.15);color:#34d399;border-color:rgba(16,185,129,0.3);">✓ installed</span>' +
                '</div>';
            container.appendChild(card);
        });
        // Add ClaWHub browse as last card
        var browse = document.createElement('div');
        browse.className = 'bp-skill-card';
        browse.style.cssText = 'cursor:pointer;border-style:dashed;text-align:center;';
        browse.innerHTML = '<div style="font-size:12px;color:rgba(168,162,153,0.5);">+ Install more from ClaWHub</div>';
        browse.addEventListener('click', function() { window.open('https://clawhub.com', '_blank'); });
        container.appendChild(browse);
    }

    function renderAgentList(list, agents) {
        list.innerHTML = '';
        if (!agents || !agents.length) {
            list.innerHTML = '<div class="bp-empty">No agents found.</div>';
            return;
        }
        agents.forEach(function (a) {
            var c = document.createElement('div');
            c.className = 'bp-card';
            var statusClass = a.thinking ? 'thinking' : (a.status === 'active' ? 'active' : 'idle');
            c.innerHTML = [
                '<div class="bp-row">',
                '<span class="bp-status ' + statusClass + '"></span>',
                '<span style="font-size:18px">' + esc(a.emoticon || a.emoji || '🤖') + '</span>',
                '<div style="flex:1"><div style="font-size:13px;color:#f4e4bc">' + esc(a.name || a.id) + '</div>',
                '<div style="font-size:11px;color:rgba(168,162,153,0.7)">' + esc(a.role || '') + '</div></div>',
                '</div>',
            ].join('');
            var detail = document.createElement('div');
            detail.style.display = 'none';
            detail.innerHTML = buildAgentDetail(a);
            c.appendChild(detail);
            c.addEventListener('click', function () {
                var open = detail.style.display !== 'none';
                detail.style.display = open ? 'none' : 'block';
                c.classList.toggle('bp-expanded', !open);
            });
            list.appendChild(c);
        });
    }

    function buildAgentDetail(a) {
        var p = a.progress || 0;
        var h = '<div class="bp-detail" style="margin-top:10px">';
        if (a.thinking) h += '<div style="color:#2196f3;margin-bottom:6px">💭 Thinking…</div>';
        h += '<div class="bp-progress-bar"><div class="bp-progress-fill" style="width:' + p + '%"></div></div>';
        h += '<div style="font-size:11px;color:rgba(168,162,153,0.6);margin-bottom:6px">' + p + '% complete</div>';
        if (a.todo && a.todo.length) {
            h += '<div style="font-size:11px;color:rgba(201,169,89,0.7);margin-bottom:4px">Tasks:</div>';
            a.todo.forEach(function (t) { h += '<div style="font-size:11px;padding-left:8px">• ' + esc(t) + '</div>'; });
        }
        if (a.skills && a.skills.length) {
            h += '<div style="font-size:11px;color:rgba(201,169,89,0.7);margin:6px 0 4px">Skills:</div><div class="bp-row" style="flex-wrap:wrap;gap:4px">';
            a.skills.forEach(function (sk) { h += '<span class="bp-tag">' + esc(sk) + '</span>'; });
            h += '</div>';
        }
        return h + '</div>';
    }

    // ── Render: Forge ───────────────────────────────────────────────────
    function renderForge(container) {
        if (window.SkillForge && typeof window.SkillForge.open === 'function') {
            window.SkillForge.open();
            container.innerHTML = '<div class="bp-empty">Skill Forge opened.</div>';
            return;
        }
        container.innerHTML =
            '<div class="bp-section-title">⚒️ The Forge — Craft a Skill</div>' +
            '<p style="font-size:12px;color:rgba(168,162,153,0.7);margin-bottom:12px;">Forge a custom skill for your knights. Skills are reusable instruction sets.</p>' +
            '<div style="margin-bottom:12px;">' +
            '<label style="font-size:12px;color:rgba(201,169,89,0.8);display:block;margin-bottom:4px;">Skill Name</label>' +
            '<input class="bp-input" id="forge-skill-name" placeholder="e.g. daily-standup" style="margin-bottom:8px;">' +
            '<label style="font-size:12px;color:rgba(201,169,89,0.8);display:block;margin-bottom:4px;">Description</label>' +
            '<input class="bp-input" id="forge-skill-desc" placeholder="What does this skill do?" style="margin-bottom:8px;">' +
            '<label style="font-size:12px;color:rgba(201,169,89,0.8);display:block;margin-bottom:4px;">Instructions</label>' +
            '<textarea class="bp-input" id="forge-skill-instructions" rows="4" placeholder="Step-by-step instructions for the agent..."></textarea>' +
            '</div>' +
            '<button class="bp-btn" id="forge-skill-btn" style="width:100%;margin-bottom:16px;">🔨 Forge Skill</button>' +
            '<div class="bp-section-title">📜 Skill Templates</div>' +
            '<div class="bp-skill-grid">' +
            ['Daily Standup','Code Review','Bug Hunter','Market Scout','Memory Keeper','Report Writer'].map(function(name) {
                return '<div class="bp-card" style="text-align:center;cursor:pointer;" onclick="document.getElementById(\x27forge-skill-name\x27).value=\x27' + name.toLowerCase().replace(/ /g,'-') + '\x27;document.getElementById(\x27forge-skill-desc\x27).value=\x27' + name + ' automation\x27">' +
                    '<div style="font-size:20px">⚙️</div>' +
                    '<div style="font-size:11px;color:#f4e4bc;margin-top:4px">' + name + '</div>' +
                    '</div>';
            }).join('') +
            '</div>';

        var btn = document.getElementById('forge-skill-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                var name = document.getElementById('forge-skill-name').value.trim();
                var desc = document.getElementById('forge-skill-desc').value.trim();
                var instructions = document.getElementById('forge-skill-instructions').value.trim();
                if (!name || !instructions) {
                    btn.textContent = '⚠️ Name + instructions required';
                    setTimeout(function() { btn.textContent = '🔨 Forge Skill'; }, 2000);
                    return;
                }
                var msg = 'Please create a skill named "' + name + '". Description: ' + desc + '. Instructions: ' + instructions;
                if (window.ThemeChat && window.ThemeChat._sendMessage) {
                    window.ThemeChat._sendMessage(msg);
                    var chatEl = document.getElementById('medievalChat');
                    if (chatEl) { chatEl.style.display = 'flex'; chatEl.style.flexDirection = 'column'; }
                }
                btn.textContent = '✨ Skill dispatched to forge!';
                btn.style.background = 'rgba(16,185,129,0.3)';
                setTimeout(function() {
                    btn.textContent = '🔨 Forge Skill';
                    btn.style.background = '';
                    document.getElementById('forge-skill-name').value = '';
                    document.getElementById('forge-skill-desc').value = '';
                    document.getElementById('forge-skill-instructions').value = '';
                }, 2000);
            });
        }
    }

    // ── Render: Market ──────────────────────────────────────────────────
    function renderMarket(container) {
        if (window.SkillMarketplace && typeof window.SkillMarketplace.open === 'function') {
            window.SkillMarketplace.open();
            container.innerHTML = '<div class="bp-empty">Marketplace opened.</div>';
            return;
        }
        container.innerHTML =
            '<div class="bp-section-title">🏪 Skill Marketplace</div>' +
            '<p style="font-size:12px;color:rgba(168,162,153,0.7);margin-bottom:14px;">Discover and install community skills from ClaWHub.</p>' +
            '<a href="https://clawhub.com" target="_blank" rel="noopener" style="display:block;padding:12px 14px;background:rgba(201,169,89,0.1);border:1px solid rgba(201,169,89,0.35);border-radius:8px;color:#c9a959;font-size:13px;text-decoration:none;text-align:center;margin-bottom:14px;">' +
                '🌐 Open ClaWHub.com →' +
            '</a>' +
            '<div class="bp-section-title">Installed Skills</div>' +
            '<div id="bp-market-installed"><div class="bp-empty">Loading…</div></div>';

        var grid = document.getElementById('bp-market-installed');
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch)
            ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
        fetcher('/api/oc/skills').then(function(r) { return r.json(); }).then(function(data) {
            var skills = Array.isArray(data) ? data : (data.skills || []);
            renderSkillList(grid, skills);
        }).catch(function() {
            grid.innerHTML = '<div class="bp-empty">Could not load skills.</div>';
        });
    }

    // ── Render: Settings ────────────────────────────────────────────────
    function renderSettings(container) {
        var channelDefs = [
            ['✈️', 'Telegram', 'telegram'],
            ['📱', 'WhatsApp', 'whatsapp'],
            ['🎮', 'Discord', 'discord'],
            ['🔔', 'Signal', 'signal'],
            ['🍎', 'iMessage', 'imessage'],
            ['💼', 'Slack', 'slack'],
        ];
        var rows = channelDefs.map(function(c) {
            var wizardConnected = window.ChannelOnboarding ? window.ChannelOnboarding.isChannelConnected(c[2]) : false;
            var ocActive = window._ocChannelInfo ? !!(window._ocChannelInfo[c[2]]) : false;
            var connected = wizardConnected || ocActive;
            return '<div class="bp-conn-row" style="cursor:pointer;" onclick="' +
                (window.ChannelOnboarding ? 'window.ChannelOnboarding.openQuickConnect(\"' + c[2] + '\")' : '') + '">' +
                '<span>' + c[0] + ' ' + c[1] + '</span>' +
                '<span>' + (connected ? '✅ Active' : '<span style="color:rgba(168,162,153,0.4);font-size:11px">Not configured</span>') + '</span>' +
                '</div>';
        }).join('');

        if (!window._ocChannelFetched) {
            window._ocChannelFetched = true;
            (async function() {
                try {
                    var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
                    var resp = await fetcher('/api/oc/health');
                    if (resp.ok) {
                        var data = await resp.json();
                        var channels = data.channels || data.activeChannels || {};
                        window._ocChannelInfo = channels;
                        if (Object.keys(channels).length > 0) {
                            window._ocChannelFetched = false;
                            renderSettings(container);
                        }
                    }
                } catch(e) {}
                window._ocChannelFetched = false;
            })();
        }

        container.innerHTML =
            '<div class="bp-section-title">⛪ Chapel — Royal Communications</div>' +
            '<p style="font-size:12px;color:rgba(168,162,153,0.7);margin-bottom:12px;">Connect your channels to receive messages from the realm.</p>' +
            '<div style="margin-bottom:12px;">' + rows + '</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
            '<button class="bp-btn" style="flex:1;" id="bp-open-channel-wizard">⚙️ Channel Wizard</button>' +
            '</div>' +
            '<div class="bp-section-title">🗺️ Realm</div>' +
            '<button class="bp-btn" style="width:100%;margin-bottom:8px;" id="bp-open-allied">🏰 Allied Kingdoms (Rookery)</button>' +
            '<button class="bp-btn" style="width:100%;margin-bottom:8px;border-color:rgba(201,169,89,.4);color:rgba(201,169,89,.9);" id="bp-open-wizard">📜 Forge Agent Blueprint</button>' +
            '<button class="bp-btn" style="width:100%;margin-bottom:8px;" id="bp-open-theme-switcher">🎨 Switch Theme / Realm</button>' +
            '<div style="font-size:11px;color:rgba(168,162,153,0.5);text-align:center;">Medieval Castle · v4.2</div>';

        var wizBtn = document.getElementById('bp-open-channel-wizard');
        if (wizBtn) wizBtn.addEventListener('click', function() { if (window.ChannelOnboarding) window.ChannelOnboarding.open(); });
        var wizardBtn = document.getElementById('bp-open-wizard');
        if (wizardBtn) wizardBtn.addEventListener('click', function() {
            window.closeBuildingPanel();
            setTimeout(function() { if (window.SetupWizard) window.SetupWizard.open('medieval'); }, 200);
        });
        var alliedBtn = document.getElementById('bp-open-allied');
        if (alliedBtn) alliedBtn.addEventListener('click', function() {
            window.closeBuildingPanel();
            setTimeout(function() { if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏰 Rookery'); }, 200);
        });
        var themeBtn = document.getElementById('bp-open-theme-switcher');
        if (themeBtn) themeBtn.addEventListener('click', function() {
            var overlay = document.getElementById('themeSwitcherOverlay');
            if (overlay) { overlay.style.display = 'flex'; setTimeout(function() { overlay.classList.add('visible'); }, 50); }
        });
    }

    // ── Utility ─────────────────────────────────────────────────────────
    function esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Hook into building click ─────────────────────────────────────────
    var BUILDING_DEFS = [
        { name: '⚔️ Mission Hall', x: -10, z: 20 },
        { name: '🍺 Tavern',        x: -4,  z: 23 },
        { name: '📚 Library',       x: 4,   z: 22 },
        { name: '🔨 Forge Workshop',x: 10,  z: 20 },
        { name: '🏪 Market',        x: 6,   z: 26 },
        { name: '🏠 Chapel',        x: -8,  z: 26 },
    ];

    function patchBuildingClick(app) {
        if (!app._buildingGroups) {
            app._buildingGroups = {};
            var groups = app.scene.children.filter(function (o) { return o.isGroup; });
            BUILDING_DEFS.forEach(function (def) {
                var match = groups.find(function (g) {
                    return Math.abs(g.position.x - def.x) < 0.5 && Math.abs(g.position.z - def.z) < 0.5;
                });
                if (match) {
                    match.userData.buildingName = def.name;
                    app._buildingGroups[def.name] = match;
                }
            });
        }

        var origClick = app.onSceneClick.bind(app);
        app.onSceneClick = function (event) {
            var ndc = app.getMouseNDC(event);
            app.raycaster.setFromCamera(ndc, app.camera);

            var buildingMeshes = [];
            Object.values(app._buildingGroups || {}).forEach(function (grp) {
                grp.traverse(function (m) { if (m.isMesh) buildingMeshes.push(m); });
            });

            if (buildingMeshes.length) {
                var hits = app.raycaster.intersectObjects(buildingMeshes, false);
                if (hits.length) {
                    var obj = hits[0].object;
                    while (obj && !obj.userData.buildingName) obj = obj.parent;
                    if (obj && obj.userData.buildingName) {
                        if (obj.userData.buildingName === '🏰 Royal Court' && window.RoyalCourt) {
                            window.RoyalCourt.show();
                        } else if (window.MissionHouses && window.MissionHouses.handleClick(obj.userData.buildingName)) {
                            // Mission house click consumed
                        } else {
                            window.openBuildingPanel(obj.userData.buildingName);
                        }
                        return;
                    }
                }
            }
            origClick(event);
        };
    }

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        ensurePanelDOM();

        // Wire close button on pre-rendered panel (index.html uses onclick="closeBuildingPanel()")
        // closeBuildingPanel is already defined globally above, so this works.
        // But also attach via addEventListener as a safety net for dynamically created panels.
        var closeBtn = document.getElementById('building-panel-close-btn');
        if (closeBtn && !closeBtn._wired) {
            closeBtn.addEventListener('click', window.closeBuildingPanel);
            closeBtn._wired = true;
        }

        var app = window.castleApp;
        if (app && app.scene && typeof app.onSceneClick === 'function') {
            patchBuildingClick(app);
        } else {
            var attempts = 0;
            var poll = setInterval(function () {
                attempts++;
                var a = window.castleApp;
                if (a && a.scene && typeof a.onSceneClick === 'function') {
                    clearInterval(poll);
                    patchBuildingClick(a);
                } else if (attempts > 60) {
                    clearInterval(poll);
                    console.warn('[medieval-panels] castleApp not ready after 30s');
                }
            }, 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
