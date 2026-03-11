(function() {
    const hotbar = document.getElementById('roblox-hotbar');
    if (!hotbar) return;
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
        { key: '5', icon: '⚙️', label: 'Settings', action: function() {
            if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏠 Chapel');
            else if (window.ThemeCustomize) ThemeCustomize.show();
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
        { key: '7', icon: '🏗️', label: 'Edit', action: function() {
            if (window.MissionHouses && typeof window.MissionHouses.toggleEditMode === 'function') {
                window.MissionHouses.toggleEditMode();
            }
        }},
        { key: '8', icon: '🏰', label: 'Allies', action: function() {
            if (typeof window.openBuildingPanel === 'function') window.openBuildingPanel('🏰 Rookery');
        }},
        { key: '9', icon: '🔊', label: 'Sound', action: function() {
            var isMuted = window.castleApp && window.castleApp.soundEnabled === false;
            if (window.castleAudio) {
                window.castleAudio.setMuted(!isMuted);
            } else {
                // Fallback — toggle via castleApp
                if (window.castleApp) window.castleApp.soundEnabled = isMuted;
            }
            // Update icon + scene toggle
            var btn = document.getElementById('btn-toggle-sound');
            if (btn) btn.textContent = isMuted ? '🔊' : '🔇';
            // Update hotbar slot icon
            var slot = hotbar.children[8];
            if (slot) {
                slot.querySelector('span:first-child').textContent = isMuted ? '🔊' : '🔇';
                slot.querySelector('span:nth-child(2)').textContent = isMuted ? 'Sound' : 'Muted';
            }
        }},
        { key: '0', icon: '🌙', label: 'Night', action: function() {
            // Toggle forced day/night override
            window._forcedDayNight = window._forcedDayNight === 'night' ? 'day' : 'night';
            var isNight = window._forcedDayNight === 'night';
            var slot = hotbar.children[9];
            if (slot) {
                slot.querySelector('span:first-child').textContent = isNight ? '☀️' : '🌙';
                slot.querySelector('span:nth-child(2)').textContent = isNight ? 'Day' : 'Night';
            }
            // Apply lighting immediately
            if (window.castleApp && window.castleApp.applyForcedDayNight) {
                window.castleApp.applyForcedDayNight(window._forcedDayNight);
            } else if (window.castleApp) {
                var app = window.castleApp;
                if (app.sunLight) {
                    app.sunLight.intensity = isNight ? 0.15 : 1.8;
                    app.sunLight.color.setHex(isNight ? 0x334466 : 0xffe8cc);
                }
                if (app.ambientLight) {
                    app.ambientLight.intensity = isNight ? 0.06 : 0.45;
                    app.ambientLight.color.setHex(isNight ? 0x223355 : 0xfff5e0);
                }
                if (app.hemiLight) app.hemiLight.intensity = isNight ? 0.08 : 0.25;
                if (app.torchLights) app.torchLights.forEach(function(t) { t.intensity = isNight ? 5 : 2; });
                if (app.bloomPass) app.bloomPass.strength = isNight ? 0.7 : 0.25;
                var skyBg = document.getElementById('scene-container');
                if (skyBg) skyBg.style.background = isNight ? 'linear-gradient(180deg,#060b1a 0%,#0d1b3a 60%,#1a2040 100%)' : '';
            }
        }},
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

    items.forEach(function(item) {
        var slot = document.createElement('div');
        slot.style.cssText = 'width:52px;height:52px;background:rgba(30,30,30,0.85);border:2px solid rgba(255,255,255,0.15);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;position:relative;';
        slot.innerHTML = '<span style="font-size:20px;line-height:1;">' + item.icon + '</span><span style="font-size:8px;color:rgba(255,255,255,0.5);margin-top:1px;">' + item.label + '</span><span style="position:absolute;top:2px;left:4px;font-size:9px;color:rgba(255,255,255,0.3);">' + item.key + '</span>';
        slot.addEventListener('mouseenter', function() { slot.style.borderColor = 'rgba(255,200,50,0.6)'; slot.style.transform = 'translateY(-2px)'; });
        slot.addEventListener('mouseleave', function() { slot.style.borderColor = 'rgba(255,255,255,0.15)'; slot.style.transform = 'none'; });
        slot.addEventListener('click', function() { item.action(); });
        hotbar.appendChild(slot);
    });
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        var idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < items.length) {
            hotbar.children[idx].click();
            hotbar.children[idx].style.borderColor = 'rgba(255,200,50,0.9)';
            setTimeout(function() { hotbar.children[idx].style.borderColor = 'rgba(255,255,255,0.15)'; }, 200);
        }
    });

    // Remove floating buttons on the right side (they duplicate hotbar)
    setTimeout(function() {
        var floatingBtns = document.querySelectorAll('.theme-floating-btn, .floating-actions');
        floatingBtns.forEach(function(btn) { btn.style.display = 'none'; });
    }, 1000);
})();
