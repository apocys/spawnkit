/* ═══════════════════════════════════════════════
   SpawnKit Executive — Settings Panel
   ═══════════════════════════════════════════════ */
(function() {
    'use strict';
    var E = window.Exec;
    var API = E.API;
    var esc = E.esc;
    var showToast = E.showToast;

    // DOM refs (local to IIFE)
    var settingsOverlay = document.getElementById('settingsOverlay');
    var settingsBackdropEl = document.getElementById('settingsBackdrop');
    var settingsCloseBtn = document.getElementById('settingsClose');
    var settingsBody = document.getElementById('settingsBody');

    function openSettingsPanel() {
        window.closeAllPanels();
        settingsOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        renderSettings();
    }
    function closeSettingsPanel() {
        settingsOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    document.getElementById('settingsBtn').addEventListener('click', openSettingsPanel);
    settingsBackdropEl.addEventListener('click', closeSettingsPanel);
    settingsCloseBtn.addEventListener('click', closeSettingsPanel);

    async function renderSettings() {
        var html = '';

        // AI Provider section
        html += '<div class="cron-group"><div class="cron-group-title">🤖 AI Provider</div>';
        html += '<div class="cron-item" style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.2);border-radius:10px;padding:12px;">';
        html += '<div class="cron-item-info" style="flex:1;">';
        html += '<div class="cron-item-name">✨ Recommended (automatic)</div>';
        html += '<div class="cron-item-schedule" style="color:rgba(255,255,255,0.5);">Best AI model, automatically configured — just works</div>';
        html += '</div>';
        html += '<button id="useRecommendedBtn" style="padding:6px 14px;border-radius:8px;border:none;background:var(--exec-blue);color:#fff;font-size:12px;cursor:pointer;font-weight:600;">Use Recommended</button>';
        html += '</div>';
        html += '<div style="margin:8px 0 4px;text-align:center;">';
        html += '<button id="toggleAdvancedProviders" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:11px;cursor:pointer;text-decoration:underline;">Advanced: choose provider manually ▾</button>';
        html += '</div>';
        html += '<div id="advancedProvidersSection" style="display:none;">';

        // API Keys section
        html += '<div class="cron-group-title" style="margin-top:8px;">\u{1F511} API Keys</div>';

        var providers = ['anthropic', 'openai', 'elevenlabs', 'google'];
        var providerLabels = { anthropic: 'Anthropic', openai: 'OpenAI', elevenlabs: 'ElevenLabs', google: 'Google' };
        var providerPrefixes = { anthropic: 'sk-ant-', openai: 'sk-', elevenlabs: '', google: '' };

        var currentKeys = {};
        if (API) {
            try { currentKeys = await API.getApiKeys(); } catch(e) {}
        }

        providers.forEach(function(prov) {
            var info = currentKeys[prov] || {};
            var masked = info.hasKey ? info.masked : 'Not set';
            var hasKey = info.hasKey || false;

            html += '<div class="cron-item" style="flex-wrap:wrap;">';
            html += '<div class="cron-item-info" style="flex:1;min-width:150px;">';
            html += '<div class="cron-item-name">' + providerLabels[prov] + '</div>';
            // Note: esc() sanitises user-facing values before insertion
            html += '<div class="cron-item-schedule" style="font-family:monospace;font-size:11px;">' + esc(masked) + '</div>';
            html += '</div>';
            html += '<div style="display:flex;gap:4px;align-items:center;">';
            html += '<input type="password" id="apikey-' + prov + '" placeholder="' + (providerPrefixes[prov] || '') + '..." style="width:160px;padding:4px 8px;border-radius:6px;border:1px solid var(--border-medium);font-size:11px;font-family:monospace;background:var(--bg-tertiary);color:var(--text-primary);" />';
            html += '<button class="apikey-save-btn" data-provider="' + prov + '" style="padding:4px 10px;border-radius:6px;border:none;background:var(--exec-blue);color:#fff;font-size:11px;cursor:pointer;font-weight:500;">Save</button>';
            if (hasKey) {
                html += '<button class="apikey-delete-btn" data-provider="' + prov + '" style="padding:4px 8px;border-radius:6px;border:1px solid var(--status-error);background:transparent;color:var(--status-error);font-size:11px;cursor:pointer;">\u{1F5D1}\uFE0F</button>';
            }
            html += '</div>';
            html += '</div>';
        });
        html += '</div>'; // close advancedProvidersSection
        html += '</div>'; // close cron-group

        // Skills section
        var skillsList = [
            { name: 'large-build', desc: 'Decompose large projects into parallel sub-agent modules', icon: '\u{1F3D7}\uFE0F' },
            { name: 'research', desc: 'Deep web research with synthesis and summary', icon: '\u{1F50D}' },
            { name: 'brainstorm', desc: 'Creative ideation and strategic planning sessions', icon: '\u{1F4A1}' },
            { name: 'code-review', desc: 'Automated code review and quality analysis', icon: '\u{1F50E}' },
            { name: 'tiktok-pipeline', desc: 'HeyGen avatar video generation pipeline', icon: '\u{1F3AC}' },
            { name: 'memory-update', desc: 'Update and consolidate fleet memory', icon: '\u{1F9E0}' },
            { name: 'fleet-relay', desc: 'Inter-office messaging via Fleet Relay', icon: '\u{1F4E1}' }
        ];
        // Try to load from API
        try {
            var apiUrl2 = window.OC_API_URL || (window.location.origin);
            (window.skFetch || fetch)(apiUrl2 + '/api/oc/agents').then(function(r) {
                if (r.ok) return r.json();
            }).then(function(data) {
                if (data && data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
                    // Dynamically update if API returns skills
                }
            }).catch(function() {});
        } catch(e) {}
        html += '<div class="cron-group"><div class="cron-group-title">\u26A1 Available Skills</div>';
        html += '<div style="display:flex;flex-direction:column;gap:6px;">';
        skillsList.forEach(function(sk) {
            html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-tertiary);border-radius:10px;">';
            html += '<div style="font-size:22px;min-width:28px;text-align:center;">' + sk.icon + '</div>';
            html += '<div><div style="font-size:13px;font-weight:600;color:var(--text-primary);">' + esc(sk.name) + '</div>';
            html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">' + esc(sk.desc) + '</div></div>';
            html += '</div>';
        });
        html += '</div></div>';

        // Village Profile section
        html += '<div class="cron-group"><div class="cron-group-title">\u{1F3E1} Village Profile</div>';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-tertiary);border-radius:10px;">';
        html += '<div>';
        html += '<div style="font-size:13px;font-weight:600;color:var(--text-primary);">Creator Profile &amp; Village Settings</div>';
        html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Manage village name, share link &amp; identity</div>';
        html += '</div>';
        html += '<button id="openCreatorProfileBtn" style="padding:8px 14px;border-radius:8px;border:none;background:var(--exec-blue);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Open Profile</button>';
        html += '</div></div>';

        settingsBody.innerHTML = html; // all dynamic values sanitised via esc()

        // Wire creator profile button
        var cpBtn = document.getElementById('openCreatorProfileBtn');
        if (cpBtn && typeof window.openCreatorProfile === 'function') {
            cpBtn.addEventListener('click', function() {
                closeSettingsPanel();
                window.openCreatorProfile();
            });
        }

        // Wire recommended provider button
        var recBtn = document.getElementById('useRecommendedBtn');
        if (recBtn) {
            recBtn.addEventListener('click', async function() {
                recBtn.disabled = true;
                recBtn.textContent = 'Setting up...';
                try {
                    var resp = await (window.skFetch || fetch)('/api/wizard/providers/setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ providerId: 'recommended', modelId: 'claude-sonnet-4-6', modelName: 'Claude Sonnet 4.6' })
                    });
                    if (resp.ok) {
                        showToast('✨ Recommended provider configured!');
                        recBtn.textContent = '✅ Active';
                    } else {
                        showToast('⚠️ Setup failed — try advanced options');
                        recBtn.disabled = false;
                        recBtn.textContent = 'Use Recommended';
                    }
                } catch(e) {
                    showToast('⚠️ Connection error');
                    recBtn.disabled = false;
                    recBtn.textContent = 'Use Recommended';
                }
            });
        }

        // Wire advanced toggle
        var toggleBtn = document.getElementById('toggleAdvancedProviders');
        var advSection = document.getElementById('advancedProvidersSection');
        if (toggleBtn && advSection) {
            toggleBtn.addEventListener('click', function() {
                var visible = advSection.style.display !== 'none';
                advSection.style.display = visible ? 'none' : 'block';
                toggleBtn.textContent = visible ? 'Advanced: choose provider manually ▾' : 'Hide advanced ▴';
            });
        }

        // Wire up API key save buttons
        document.querySelectorAll('.apikey-save-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var prov = btn.dataset.provider;
                var input = document.getElementById('apikey-' + prov);
                var key = input ? input.value.trim() : '';
                if (!key) { showToast('Please enter an API key'); return; }
                if (API) {
                    var result = await API.saveApiKey(prov, key);
                    if (result && result.success) {
                        showToast('\u2705 ' + providerLabels[prov] + ' key saved');
                        input.value = '';
                        renderSettings();
                    } else {
                        showToast('\u26A0\uFE0F Failed: ' + (result.error || 'unknown'));
                    }
                }
            });
        });

        // Wire up API key delete buttons
        document.querySelectorAll('.apikey-delete-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var prov = btn.dataset.provider;
                if (API) {
                    var result = await API.deleteApiKey(prov);
                    if (result && result.success) {
                        showToast('\u{1F5D1}\uFE0F ' + providerLabels[prov] + ' key deleted');
                        renderSettings();
                    }
                }
            });
        });
    }

    // Exports
    window.openSettingsPanel = openSettingsPanel;
    window.closeSettingsPanel = closeSettingsPanel;
})();
