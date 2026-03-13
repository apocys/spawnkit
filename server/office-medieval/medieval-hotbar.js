(function() {
    var hotbar = document.getElementById('roblox-hotbar');
    if (!hotbar) return;
    if (hotbar._hotbarInited) return;
    hotbar._hotbarInited = true;

    // Clear any existing children to prevent duplicates
    hotbar.innerHTML = '';

    // ── Core items (always visible) ─────────────────────────────
    var items = [
        { key: '1', icon: '🗡️', label: 'Missions', action: function() {
            if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('⚔️ Mission Hall');
            else if (typeof openMissionControl === 'function') openMissionControl();
        }},
        { key: '2', icon: '💬', label: 'Chat', action: function() {
            var chatEl = document.getElementById('medievalChat');
            if (chatEl) {
                if (chatEl.style.display === 'none' || !chatEl.style.display) {
                    chatEl.style.display = 'flex';
                    chatEl.style.flexDirection = 'column';
                    if (window.ThemeChat) ThemeChat.show();
                } else {
                    chatEl.style.display = 'none';
                    if (window.ThemeChat) ThemeChat.hide();
                }
            }
        }},
        { key: '3', icon: '📜', label: 'Skills', action: function() {
            if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏪 Market');
        }},
        { key: '4', icon: '🗺️', label: 'Map', action: function() {
            var minimap = document.getElementById('minimap-overlay');
            if (minimap) {
                minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
            } else if (window.castleApp) {
                window.castleApp.resetCamera();
            }
        }},
        { key: '5', icon: '⚡', label: 'Arena', action: function() {
            if (window.ArenaIntegration && window.ArenaIntegration.startBattle) {
                window.ArenaIntegration.startBattle('config-fix');
            } else if (window.showToast) {
                window.showToast('Arena battles coming soon!', 'info');
            }
        }},
        { key: '6', icon: '⚔️', label: 'Summon', action: function() {
            if (window.SummonWizard && typeof window.SummonWizard.open === 'function') {
                window.SummonWizard.open();
                return;
            }
            var overlay = document.getElementById('summonOverlay');
            if (!overlay) return;
            overlay.style.display = 'flex';
            setTimeout(function() { overlay.classList.add('visible'); }, 50);
        }},
        { key: '7', icon: '🏰', label: 'Allies', action: function() {
            if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏰 Rookery');
        }},
        { key: '8', icon: '⋯', label: 'More', action: function() {
            showMoreMenu();
        }}
    ];

    // ── Build hotbar slots ──────────────────────────────────────
    function makeSlot(item) {
        var slot = document.createElement('div');
        slot.className = 'hotbar-slot';
        slot.style.cssText = 'width:52px;height:52px;background:rgba(30,30,30,0.85);border:2px solid rgba(255,255,255,0.15);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;position:relative;';
        slot.innerHTML = '<span style="font-size:20px;line-height:1;">' + item.icon + '</span>' +
            '<span style="font-size:8px;color:rgba(255,255,255,0.5);margin-top:1px;">' + item.label + '</span>' +
            '<span style="position:absolute;top:2px;left:4px;font-size:9px;color:rgba(255,255,255,0.3);">' + item.key + '</span>';
        slot.title = item.label + ' [' + item.key + ']';
        slot.addEventListener('mouseenter', function() { slot.style.borderColor = 'rgba(255,200,50,0.6)'; slot.style.transform = 'translateY(-2px)'; });
        slot.addEventListener('mouseleave', function() { slot.style.borderColor = 'rgba(255,255,255,0.15)'; slot.style.transform = 'none'; });
        slot.addEventListener('click', function() { item.action(); });
        return slot;
    }

    items.forEach(function(item) {
        hotbar.appendChild(makeSlot(item));
    });

    // ── Keyboard shortcuts ──────────────────────────────────────
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        var idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < items.length) {
            items[idx].action();
            var slot = hotbar.children[idx];
            if (slot) {
                slot.style.borderColor = 'rgba(255,200,50,0.9)';
                setTimeout(function() { slot.style.borderColor = 'rgba(255,255,255,0.15)'; }, 200);
            }
        }
    });

    // ── [...] More menu ─────────────────────────────────────────
    function showMoreMenu() {
        var existing = document.getElementById('hotbar-more-menu');
        if (existing) { existing.remove(); return; }

        var menu = document.createElement('div');
        menu.id = 'hotbar-more-menu';
        menu.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(20,12,5,0.95);border:1px solid var(--castle-gold);border-radius:8px;padding:8px;z-index:1000;display:flex;flex-direction:column;gap:4px;min-width:160px;backdrop-filter:blur(8px);';

        var moreItems = [
            { icon: '⚙️', label: 'Settings', action: function() {
                if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏠 Chapel');
                else if (window.ThemeCustomize) ThemeCustomize.show();
            }},
            { icon: '🏗️', label: 'Edit Mode', action: function() {
                if (window.MissionHouses && typeof window.MissionHouses.toggleEditMode === 'function') {
                    window.MissionHouses.toggleEditMode();
                }
            }},
            { icon: '🔊', label: 'Audio', action: function() {
                if (window.SpatialAudio && window.SpatialAudio.toggleAudio) {
                    window.SpatialAudio.toggleAudio();
                }
            }},
            { icon: '☀️', label: 'Weather', action: function() {
                // Cycle weather
                var WEATHER = ['☀️ Clear','⛅ Cloudy','🌧️ Rain','❄️ Snow','🌫️ Fog'];
                window._weatherIdx = ((window._weatherIdx || 0) + 1) % WEATHER.length;
                var w = WEATHER[window._weatherIdx];
                if (window.showToast) window.showToast(w, 'info');
                if (window.castleWeather && window.castleWeather.setWeather) {
                    window.castleWeather.setWeather(w.split(' ')[1].toLowerCase());
                }
            }},
            { icon: '🎨', label: 'Themes', action: function() {
                var overlay = document.getElementById('themeSwitcherOverlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    setTimeout(function() { overlay.classList.add('visible'); }, 50);
                }
            }}
        ];

        moreItems.forEach(function(item) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-radius:4px;transition:background 0.15s;font-family:var(--font-serif);color:var(--castle-gold);font-size:13px;';
            row.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
            row.addEventListener('mouseenter', function() { this.style.background = 'rgba(201,169,89,0.2)'; });
            row.addEventListener('mouseleave', function() { this.style.background = ''; });
            row.addEventListener('click', function() { item.action(); menu.remove(); });
            menu.appendChild(row);
        });

        document.body.appendChild(menu);

        // Close on outside click
        setTimeout(function() {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // Remove floating buttons that duplicate hotbar
    setTimeout(function() {
        var floatingBtns = document.querySelectorAll('.theme-floating-btn, .floating-actions');
        floatingBtns.forEach(function(btn) { btn.style.display = 'none'; });
    }, 1000);
})();
