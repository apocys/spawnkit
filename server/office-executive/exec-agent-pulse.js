/**
 * exec-agent-pulse.js — Real-time Agent Status Rings + Tooltips
 * 
 * Adds animated status rings to all agent avatars across Executive Office.
 * Pulls from OcStore session data. Updates every 15s.
 */
(function () {
    'use strict';

    /* ── CSS ─────────────────────────────────────────────────── */
    var style = document.createElement('style');
    style.textContent = [
        '.eap-ring{position:absolute;inset:-3px;border-radius:50%;border:2px solid transparent;pointer-events:none;transition:border-color 0.4s;}',
        '.eap-ring--active{border-color:var(--status-active,#30D158);animation:eap-glow 2s ease-in-out infinite;}',
        '.eap-ring--idle{border-color:var(--exec-gray-300,#aeaeb2);}',
        '.eap-ring--thinking{border-image:conic-gradient(var(--color-accent,#007AFF),#BF5AF2,var(--color-accent,#007AFF)) 1;animation:eap-spin 1.5s linear infinite;}',
        '.eap-ring--error{border-color:var(--status-error,#FF453A);animation:eap-flash 1s ease-in-out infinite;}',
        '@keyframes eap-glow{0%,100%{box-shadow:0 0 0 0 rgba(48,209,88,0.3);}50%{box-shadow:0 0 8px 2px rgba(48,209,88,0.3);}}',
        '@keyframes eap-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}',
        '@keyframes eap-flash{0%,100%{opacity:1;}50%{opacity:0.3;}}',
        '.eap-tooltip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);',
        'background:var(--exec-gray-900,#1C1C1E);color:#fff;padding:6px 10px;border-radius:8px;',
        'font-size:11px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;z-index:100;}',
        '.eap-tooltip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);',
        'border:5px solid transparent;border-top-color:var(--exec-gray-900,#1C1C1E);}',
        '.md-agent:hover .eap-tooltip,.md-agent-icon:hover .eap-tooltip{opacity:1;}',
    ].join('\n');
    document.head.appendChild(style);

    /* ── State ────────────────────────────────────────────────── */
    var _agentStatuses = {};
    var _observer = null;

    /* ── Helpers ──────────────────────────────────────────────── */
    function inferStatus(sessions, agentId) {
        if (!sessions || !sessions.length) return { status: 'idle', label: '' };
        var lower = agentId.toLowerCase();
        for (var i = 0; i < sessions.length; i++) {
            var s = sessions[i];
            var sKey = ((s.key || '') + ' ' + (s.label || '')).toLowerCase();
            if (sKey.includes(lower) || (lower === 'sycopa' && sKey.includes('main'))) {
                var st = (s.status || '').toLowerCase();
                var label = s.label || s.task || '';
                if (label.length > 40) label = label.substring(0, 37) + '…';
                var elapsed = '';
                if (s.startedAt || s.createdAt) {
                    var mins = Math.floor((Date.now() - new Date(s.startedAt || s.createdAt).getTime()) / 60000);
                    elapsed = mins < 1 ? 'just now' : mins + 'm ago';
                }
                if (st === 'active' || st === 'running') {
                    // Check for error keywords
                    if ((label + ' ' + (s.task || '')).toLowerCase().match(/error|fail|crash|bug/)) {
                        return { status: 'error', label: label, elapsed: elapsed };
                    }
                    return { status: 'thinking', label: label, elapsed: elapsed };
                }
                return { status: 'active', label: label, elapsed: elapsed };
            }
        }
        return { status: 'idle', label: '' };
    }

    function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    /* ── Apply Rings ─────────────────────────────────────────── */
    function applyRings() {
        var avatars = document.querySelectorAll('.md-agent-avatar, .md-agent-icon');
        avatars.forEach(function (el) {
            var parent = el.closest('[data-agent-id]');
            if (!parent) return;
            var agentId = parent.dataset.agentId;
            var info = _agentStatuses[agentId] || { status: 'idle', label: '' };

            // Ensure avatar container is positioned for absolute children
            if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative';
            }

            // Ring
            var ring = el.querySelector('.eap-ring');
            if (!ring) {
                ring = document.createElement('div');
                ring.className = 'eap-ring';
                el.appendChild(ring);
            }
            ring.className = 'eap-ring eap-ring--' + info.status;

            // Tooltip
            var tip = el.querySelector('.eap-tooltip');
            if (!tip) {
                tip = document.createElement('div');
                tip.className = 'eap-tooltip';
                el.appendChild(tip);
            }
            if (info.label) {
                tip.innerHTML = '<strong>' + esc(agentId.charAt(0).toUpperCase() + agentId.slice(1)) + '</strong> — ' + esc(info.label) + (info.elapsed ? ' <span style="opacity:0.6;">(' + esc(info.elapsed) + ')</span>' : '');
            } else {
                tip.innerHTML = '<strong>' + esc(agentId.charAt(0).toUpperCase() + agentId.slice(1)) + '</strong> — idle';
            }
        });
    }

    /* ── Poll Sessions ───────────────────────────────────────── */
    function pollStatus() {
        var fetcher = window.skFetch || fetch;
        fetcher('/api/oc/sessions').then(function (r) { return r.ok ? r.json() : []; }).then(function (data) {
            var sessions = Array.isArray(data) ? data : (data.sessions || []);
            var agents = ['sycopa', 'forge', 'atlas', 'hunter', 'echo', 'sentinel'];
            agents.forEach(function (id) {
                _agentStatuses[id] = inferStatus(sessions, id);
            });
            applyRings();
        }).catch(function () { /* silent */ });
    }

    /* ── MutationObserver for dynamic agent elements ─────────── */
    function startObserver() {
        if (_observer) return;
        _observer = new MutationObserver(function () {
            applyRings();
        });
        _observer.observe(document.body, { childList: true, subtree: true });
    }

    /* ── Bootstrap ───────────────────────────────────────────── */
    function init() {
        if (document.body.classList.contains('sk-auth-pending')) {
            setTimeout(init, 500);
            return;
        }

        pollStatus();
        setInterval(pollStatus, 15000);
        startObserver();

        console.log('[AgentPulse] ✅ Real-time status rings ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
