(function() {
    const hotbar = document.getElementById('roblox-hotbar');
    if (!hotbar) return;
    // Guard: only run once (prevents duplicate slots on script re-injection)
    if (hotbar._hotbarInited) return;
    hotbar._hotbarInited = true;
    const items = [
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
            // Toggle minimap overlay
            var minimap = document.getElementById('minimap-overlay');
            if (minimap) {
                minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
            } else {
                // Reset camera to overview position
                if (window.castleApp) window.castleApp.resetCamera();
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
            // Prefer the new SummonKnight wizard when available
            if (window.SummonWizard && typeof window.SummonWizard.open === 'function') {
                window.SummonWizard.open();
                return;
            }
            // Fallback to legacy summon overlay
            var overlay = document.getElementById('summonOverlay');
            if (!overlay) return;
            overlay.style.display = 'flex';
            setTimeout(function() { overlay.classList.add('visible'); }, 50);
        }},
        { key: '7', icon: '⋯', label: 'More', action: function() {
            showMoreMenu();
        }},
        { key: '8', icon: '🏰', label: 'Allies', action: function() {
            if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏰 Rookery');
        }}
    ];

    // ── Weather button ──────────────────────────────────────────
    var WEATHER_CYCLE = [
        { id: 'clear',  icon: '☀️',  label: 'Clear'  },
        { id: 'cloudy', icon: '⛅',  label: 'Cloudy' },
        { id: 'rain',   icon: '🌧️', label: 'Rain'   },
        { id: 'snow',   icon: '❄️',  label: 'Snow'   },
        { id: 'fog',    icon: '🌫️', label: 'Fog'    },
    ];
    var _weatherIdx = 0;

    var weatherSlot = document.createElement('div');
    weatherSlot.id = 'hotbar-weather';
    weatherSlot.style.cssText = 'width:52px;height:52px;background:rgba(30,30,30,0.85);border:2px solid rgba(255,255,255,0.15);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;position:relative;';
    weatherSlot.innerHTML = '<span id="hotbar-weather-icon" style="font-size:20px;line-height:1;">☀️</span>' +
        '<span id="hotbar-weather-label" style="font-size:8px;color:rgba(255,255,255,0.5);margin-top:1px;">Weather</span>';
    weatherSlot.addEventListener('mouseenter', function() { weatherSlot.style.borderColor = 'rgba(100,200,255,0.6)'; weatherSlot.style.transform = 'translateY(-2px)'; });
    weatherSlot.addEventListener('mouseleave', function() { weatherSlot.style.borderColor = 'rgba(255,255,255,0.15)'; weatherSlot.style.transform = 'none'; });
    weatherSlot.addEventListener('click', function() {
        _weatherIdx = (_weatherIdx + 1) % WEATHER_CYCLE.length;
        var w = WEATHER_CYCLE[_weatherIdx];
        document.getElementById('hotbar-weather-icon').textContent = w.icon;
        document.getElementById('hotbar-weather-label').textContent = w.label;
        weatherSlot.style.borderColor = 'rgba(100,200,255,0.8)';
        setTimeout(function() { weatherSlot.style.borderColor = 'rgba(255,255,255,0.15)'; }, 300);
        if (window.castleWeather && typeof window.castleWeather.setWeather === 'function') {
            window.castleWeather.setWeather(w.id);
        }
    });
    hotbar.appendChild(weatherSlot);

    var _hotbarExpanded = false;
    var secondarySlots = [];
    items.forEach(function(item) {
        var slot = document.createElement('div');
        slot.style.cssText = 'width:52px;height:52px;background:rgba(30,30,30,0.85);border:2px solid rgba(255,255,255,0.15);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;position:relative;';
        if (item.secondary) slot.style.display = 'none';
        slot.innerHTML = '<span style="font-size:20px;line-height:1;">' + item.icon + '</span><span style="font-size:8px;color:rgba(255,255,255,0.5);margin-top:1px;">' + item.label + '</span><span style="position:absolute;top:2px;left:4px;font-size:9px;color:rgba(255,255,255,0.3);">' + item.key + '</span>';
        slot.title = item.label + ' [' + item.key + ']';
        slot.addEventListener('mouseenter', function() { slot.style.borderColor = 'rgba(255,200,50,0.6)'; slot.style.transform = 'translateY(-2px)'; });
        slot.addEventListener('mouseleave', function() { slot.style.borderColor = 'rgba(255,255,255,0.15)'; slot.style.transform = 'none'; });
        slot.addEventListener('click', function() { item.action(); });
        if (item.secondary) secondarySlots.push(slot);
        hotbar.appendChild(slot);
    });
    // More button to expand secondary items
    var moreSlot = document.createElement('div');
    moreSlot.style.cssText = 'width:52px;height:52px;background:rgba(30,30,30,0.85);border:2px solid rgba(255,255,255,0.1);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;position:relative;';
    moreSlot.innerHTML = '<span style="font-size:16px;line-height:1;opacity:0.5;">•••</span><span style="font-size:8px;color:rgba(255,255,255,0.3);margin-top:1px;">More</span>';
    moreSlot.title = 'Toggle extra controls';
    moreSlot.addEventListener('mouseenter', function() { moreSlot.style.borderColor = 'rgba(255,200,50,0.4)'; });
    moreSlot.addEventListener('mouseleave', function() { moreSlot.style.borderColor = 'rgba(255,255,255,0.1)'; });
    moreSlot.addEventListener('click', function() {
        _hotbarExpanded = !_hotbarExpanded;
        secondarySlots.forEach(function(s) { s.style.display = _hotbarExpanded ? 'flex' : 'none'; });
        moreSlot.querySelector('span').textContent = _hotbarExpanded ? '✕' : '•••';
    });
    hotbar.appendChild(moreSlot);
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        var idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < items.length) {
            hotbar.children[idx].click();
            hotbar.children[idx].style.borderColor = 'rgba(255,200,50,0.9)';
            setTimeout(function() { hotbar.children[idx].style.borderColor = 'rgba(255,255,255,0.15)'; }, 200);
        }
    });

    // More menu function
    function showMoreMenu() {
        // Remove existing menu
        var existing = document.getElementById('hotbar-more-menu');
        if (existing) {
            existing.remove();
            return;
        }

        var menu = document.createElement('div');
        menu.id = 'hotbar-more-menu';
        menu.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 12, 5, 0.95);
            border: 1px solid var(--castle-gold);
            border-radius: 8px;
            padding: 8px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 160px;
            backdrop-filter: blur(8px);
        `;

        var menuItems = [
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
            { icon: '🌙', label: 'Night Mode', action: function() {
                document.body.classList.toggle('night-mode');
            }},
            { icon: '🌦️', label: 'Weather', action: function() {
                if (window.showToast) window.showToast('Weather system coming soon!', 'info');
            }},
            { icon: '🎨', label: 'Themes', action: function() {
                if (window.ThemeCustomize) ThemeCustomize.show();
            }}
        ];

        menuItems.forEach(function(item) {
            var menuItem = document.createElement('div');
            menuItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                transition: background 0.15s;
                font-family: var(--font-serif);
                color: var(--castle-gold);
                font-size: 13px;
            `;
            
            menuItem.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
            
            menuItem.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(201, 169, 89, 0.2)';
            });
            
            menuItem.addEventListener('mouseleave', function() {
                this.style.background = '';
            });
            
            menuItem.addEventListener('click', function() {
                item.action();
                menu.remove();
            });

            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(function() {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // Remove floating buttons on the right side (they duplicate hotbar)
    setTimeout(function() {
        var floatingBtns = document.querySelectorAll('.theme-floating-btn, .floating-actions');
        floatingBtns.forEach(function(btn) { btn.style.display = 'none'; });
    }, 1000);
})();
