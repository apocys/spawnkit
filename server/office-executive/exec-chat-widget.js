/**
 * exec-chat-widget.js — Floating Chat Widget for Executive Office
 * 
 * Persistent chat pill (bottom-right) that expands to a floating panel.
 * Routes through /api/oc/chat. Persists across view changes.
 * Supports agent selection, typing indicators, message history.
 */
(function () {
    'use strict';

    /* ── Config ─────────────────────────────────────────────── */
    var API_URL = window.OC_API_URL || window.location.origin;
    var MAX_HISTORY = 50;

    var AGENTS = [
        { id: 'sycopa',   name: 'Sycopa',   role: 'Commander', emoji: '🎭', color: '#007AFF' },
        { id: 'forge',    name: 'Forge',     role: 'CTO',      emoji: '⚒️', color: '#FF9F0A' },
        { id: 'atlas',    name: 'Atlas',     role: 'COO',      emoji: '📜', color: '#BF5AF2' },
        { id: 'hunter',   name: 'Hunter',    role: 'CRO',      emoji: '🏹', color: '#FF453A' },
        { id: 'echo',     name: 'Echo',      role: 'CMO',      emoji: '🎵', color: '#0A84FF' },
        { id: 'sentinel', name: 'Sentinel',  role: 'QA',       emoji: '🛡️', color: '#30D158' },
    ];

    var _isOpen = false;
    var _activeAgent = AGENTS[0];
    var _messages = [];
    var _sending = false;

    /* ── Inject CSS ─────────────────────────────────────────── */
    var style = document.createElement('style');
    style.textContent = [
        '#ecw-pill{position:fixed;bottom:24px;right:24px;z-index:10000;display:flex;align-items:center;gap:8px;padding:10px 18px;',
        'background:var(--color-accent,#007AFF);color:#fff;border:none;border-radius:var(--radius-pill,980px);',
        'font-family:var(--font-body,Inter,sans-serif);font-size:14px;font-weight:500;cursor:pointer;',
        'box-shadow:0 4px 20px rgba(0,122,255,0.35);transition:all 0.2s;}',
        '#ecw-pill:hover{transform:translateY(-2px);box-shadow:0 6px 28px rgba(0,122,255,0.45);}',
        '#ecw-pill .ecw-dot{width:8px;height:8px;border-radius:50%;background:#30D158;animation:ecw-pulse 2s infinite;}',
        '@keyframes ecw-pulse{0%,100%{opacity:1}50%{opacity:0.5}}',

        '#ecw-panel{position:fixed;bottom:24px;right:24px;z-index:10000;width:400px;height:560px;',
        'background:var(--color-surface,#fff);border-radius:var(--radius-lg,16px);',
        'box-shadow:var(--shadow-lg,0 8px 40px rgba(0,0,0,0.12));display:none;flex-direction:column;overflow:hidden;',
        'border:1px solid var(--color-border-light,#e5e5ea);transition:opacity 0.2s,transform 0.2s;}',
        '#ecw-panel.ecw-visible{display:flex;opacity:1;transform:translateY(0);}',
        '#ecw-panel.ecw-entering{display:flex;opacity:0;transform:translateY(8px);}',

        '.ecw-header{display:flex;align-items:center;gap:10px;padding:14px 16px;',
        'border-bottom:1px solid var(--color-border-light,#e5e5ea);background:var(--color-bg-secondary,#f5f5f7);}',
        '.ecw-header-agent{display:flex;align-items:center;gap:8px;flex:1;cursor:pointer;position:relative;}',
        '.ecw-header-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;}',
        '.ecw-header-info{display:flex;flex-direction:column;}',
        '.ecw-header-name{font-weight:600;font-size:14px;color:var(--text-primary,#1d1d1f);}',
        '.ecw-header-role{font-size:11px;color:var(--text-secondary,#86868b);}',
        '.ecw-header-close{background:none;border:none;font-size:18px;color:var(--text-secondary,#86868b);cursor:pointer;padding:4px 8px;border-radius:6px;}',
        '.ecw-header-close:hover{background:var(--color-bg-tertiary,#e8e8ed);}',

        '.ecw-agent-picker{position:absolute;top:100%;left:0;background:var(--color-surface,#fff);border-radius:var(--radius-md,12px);',
        'box-shadow:var(--shadow-md,0 4px 16px rgba(0,0,0,0.08));border:1px solid var(--color-border-light,#e5e5ea);',
        'display:none;min-width:200px;z-index:10;}',
        '.ecw-agent-picker.ecw-picker-open{display:block;}',
        '.ecw-agent-option{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;transition:background 0.15s;}',
        '.ecw-agent-option:hover{background:var(--color-bg-secondary,#f5f5f7);}',
        '.ecw-agent-option:first-child{border-radius:12px 12px 0 0;}.ecw-agent-option:last-child{border-radius:0 0 12px 12px;}',

        '.ecw-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;}',
        '.ecw-msg{max-width:80%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.45;word-wrap:break-word;}',
        '.ecw-msg-user{align-self:flex-end;background:var(--color-accent,#007AFF);color:#fff;border-bottom-right-radius:4px;}',
        '.ecw-msg-agent{align-self:flex-start;background:var(--color-bg-secondary,#f5f5f7);color:var(--text-primary,#1d1d1f);border-bottom-left-radius:4px;}',
        '.ecw-msg-time{font-size:10px;color:var(--text-tertiary,#aeaeb2);margin-top:2px;}',
        '.ecw-msg-agent .ecw-msg-time{text-align:left;}.ecw-msg-user .ecw-msg-time{text-align:right;}',

        '.ecw-typing{align-self:flex-start;padding:10px 14px;background:var(--color-bg-secondary,#f5f5f7);border-radius:16px;display:none;}',
        '.ecw-typing.ecw-typing-show{display:flex;}',

        '.ecw-input-row{display:flex;align-items:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--color-border-light,#e5e5ea);background:var(--color-surface,#fff);}',
        '.ecw-input{flex:1;border:1px solid var(--color-border,#d2d2d7);border-radius:var(--radius-md,12px);padding:10px 14px;',
        'font-family:var(--font-body,Inter,sans-serif);font-size:14px;resize:none;max-height:100px;outline:none;',
        'color:var(--text-primary,#1d1d1f);background:var(--color-surface,#fff);}',
        '.ecw-input:focus{border-color:var(--color-accent,#007AFF);box-shadow:0 0 0 3px rgba(0,122,255,0.1);}',
        '.ecw-send{width:36px;height:36px;border-radius:50%;background:var(--color-accent,#007AFF);color:#fff;border:none;',
        'cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:opacity 0.15s;}',
        '.ecw-send:hover{opacity:0.85;}.ecw-send:disabled{opacity:0.4;cursor:default;}',

        '.ecw-empty{text-align:center;color:var(--text-tertiary,#aeaeb2);padding:40px 20px;font-size:14px;}',
        '.ecw-empty-emoji{font-size:40px;margin-bottom:12px;}',
    ].join('\n');
    document.head.appendChild(style);

    /* ── Helpers ─────────────────────────────────────────────── */
    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function timeStr() {
        var d = new Date();
        return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
    }

    function fmt(text) {
        var s = esc(text);
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:4px;font-size:12px;">$1</code>');
        s = s.replace(/\n/g, '<br>');
        return s;
    }

    function skFetch(url, opts) {
        return (window.skFetch || fetch)(url, opts);
    }

    /* ── Build DOM ──────────────────────────────────────────── */
    function createPill() {
        var pill = document.createElement('button');
        pill.id = 'ecw-pill';
        pill.innerHTML = '<span class="ecw-dot"></span>💬 Chat with ' + esc(_activeAgent.name);
        pill.addEventListener('click', togglePanel);
        document.body.appendChild(pill);
        return pill;
    }

    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'ecw-panel';
        panel.innerHTML = [
            '<div class="ecw-header">',
            '  <div class="ecw-header-agent" id="ecw-agent-toggle">',
            '    <div class="ecw-header-avatar" id="ecw-avatar" style="background:' + _activeAgent.color + '22">' + _activeAgent.emoji + '</div>',
            '    <div class="ecw-header-info">',
            '      <div class="ecw-header-name" id="ecw-agent-name">' + esc(_activeAgent.name) + ' ▾</div>',
            '      <div class="ecw-header-role" id="ecw-agent-role">' + esc(_activeAgent.role) + '</div>',
            '    </div>',
            '    <div class="ecw-agent-picker" id="ecw-picker"></div>',
            '  </div>',
            '  <button class="ecw-header-close" id="ecw-close-btn">✕</button>',
            '</div>',
            '<div class="ecw-messages" id="ecw-messages">',
            '  <div class="ecw-empty"><div class="ecw-empty-emoji">' + _activeAgent.emoji + '</div>Start a conversation with ' + esc(_activeAgent.name) + '</div>',
            '</div>',
            '<div class="ecw-typing" id="ecw-typing">',
            '  <div class="typing-dots"><span></span><span></span><span></span></div>',
            '</div>',
            '<div class="ecw-input-row">',
            '  <textarea class="ecw-input" id="ecw-input" rows="1" placeholder="Message ' + esc(_activeAgent.name) + '…"></textarea>',
            '  <button class="ecw-send" id="ecw-send" title="Send">↑</button>',
            '</div>',
        ].join('\n');
        document.body.appendChild(panel);

        // Bind events
        document.getElementById('ecw-close-btn').addEventListener('click', closePanel);
        document.getElementById('ecw-send').addEventListener('click', sendMessage);
        document.getElementById('ecw-agent-toggle').addEventListener('click', togglePicker);

        var input = document.getElementById('ecw-input');
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
        // Auto-resize textarea
        input.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });

        // Build picker
        var picker = document.getElementById('ecw-picker');
        AGENTS.forEach(function (a) {
            var opt = document.createElement('div');
            opt.className = 'ecw-agent-option';
            opt.innerHTML = '<span style="font-size:18px;">' + a.emoji + '</span><span>' + esc(a.name) + '</span><span style="font-size:11px;color:var(--text-tertiary)">' + esc(a.role) + '</span>';
            opt.addEventListener('click', function (e) {
                e.stopPropagation();
                switchAgent(a);
            });
            picker.appendChild(opt);
        });

        // Close picker on outside click
        document.addEventListener('click', function (e) {
            var picker = document.getElementById('ecw-picker');
            if (picker && !picker.contains(e.target) && e.target.id !== 'ecw-agent-toggle') {
                picker.classList.remove('ecw-picker-open');
            }
        });

        return panel;
    }

    /* ── Panel Toggle ───────────────────────────────────────── */
    function togglePanel() {
        if (_isOpen) closePanel(); else openPanel();
    }

    function openPanel(agentId) {
        if (agentId) {
            var a = AGENTS.find(function (x) { return x.id === agentId; });
            if (a) switchAgent(a);
        }
        var pill = document.getElementById('ecw-pill');
        var panel = document.getElementById('ecw-panel');
        if (pill) pill.style.display = 'none';
        panel.classList.add('ecw-entering');
        requestAnimationFrame(function () {
            panel.classList.remove('ecw-entering');
            panel.classList.add('ecw-visible');
        });
        _isOpen = true;
        var input = document.getElementById('ecw-input');
        if (input) setTimeout(function () { input.focus(); }, 200);
    }

    function closePanel() {
        var pill = document.getElementById('ecw-pill');
        var panel = document.getElementById('ecw-panel');
        panel.classList.remove('ecw-visible');
        if (pill) pill.style.display = 'flex';
        _isOpen = false;
    }

    /* ── Agent Switching ────────────────────────────────────── */
    function togglePicker(e) {
        e.stopPropagation();
        var picker = document.getElementById('ecw-picker');
        picker.classList.toggle('ecw-picker-open');
    }

    function switchAgent(agent) {
        _activeAgent = agent;
        document.getElementById('ecw-avatar').textContent = agent.emoji;
        document.getElementById('ecw-avatar').style.background = agent.color + '22';
        document.getElementById('ecw-agent-name').innerHTML = esc(agent.name) + ' ▾';
        document.getElementById('ecw-agent-role').textContent = agent.role;
        document.getElementById('ecw-input').placeholder = 'Message ' + agent.name + '…';
        document.getElementById('ecw-picker').classList.remove('ecw-picker-open');

        var pill = document.getElementById('ecw-pill');
        if (pill) pill.innerHTML = '<span class="ecw-dot"></span>💬 Chat with ' + esc(agent.name);

        // Reload messages for this agent
        loadHistory();
        renderMessages();
    }

    /* ── Messages ───────────────────────────────────────────── */
    function renderMessages() {
        var container = document.getElementById('ecw-messages');
        if (_messages.length === 0) {
            container.innerHTML = '<div class="ecw-empty"><div class="ecw-empty-emoji">' + _activeAgent.emoji + '</div>Start a conversation with ' + esc(_activeAgent.name) + '</div>';
            return;
        }
        container.innerHTML = _messages.map(function (m) {
            var cls = m.role === 'user' ? 'ecw-msg ecw-msg-user' : 'ecw-msg ecw-msg-agent';
            return '<div class="' + cls + '">' + fmt(m.text) + '<div class="ecw-msg-time">' + esc(m.time) + '</div></div>';
        }).join('');
        container.scrollTop = container.scrollHeight;
    }

    function saveHistory() {
        var key = 'ecw-history-' + _activeAgent.id;
        try { localStorage.setItem(key, JSON.stringify(_messages.slice(-MAX_HISTORY))); } catch (e) { }
    }

    function loadHistory() {
        var key = 'ecw-history-' + _activeAgent.id;
        try { _messages = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { _messages = []; }
    }

    /* ── Send Message ───────────────────────────────────────── */
    function sendMessage() {
        if (_sending) return;
        var input = document.getElementById('ecw-input');
        var text = input.value.trim();
        if (!text) return;

        // Add user message
        _messages.push({ role: 'user', text: text, time: timeStr() });
        renderMessages();
        saveHistory();
        input.value = '';
        input.style.height = 'auto';

        // Show typing
        _sending = true;
        document.getElementById('ecw-send').disabled = true;
        document.getElementById('ecw-typing').classList.add('ecw-typing-show');
        scrollToBottom();

        // Prefix with agent persona if not the default
        var prefix = _activeAgent.id !== 'sycopa' ? '[Speaking to ' + _activeAgent.name + '] ' : '';

        // Try to find an active sessionKey for this agent from OcStore
        var sessionKey = null;
        if (window.OcStore && window.OcStore.sessions) {
            var agentLower = (_activeAgent.id || '').toLowerCase();
            for (var si = 0; si < window.OcStore.sessions.length; si++) {
                var sess = window.OcStore.sessions[si];
                if (agentLower === 'sycopa' || agentLower === 'ceo') {
                    if (sess.key && sess.key.startsWith('agent:main')) { sessionKey = sess.key; break; }
                } else if (sess.kind === 'subagent' && sess.label && sess.label.toLowerCase().indexOf(agentLower) >= 0) {
                    sessionKey = sess.key; break;
                }
            }
        }

        skFetch(API_URL + '/api/oc/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prefix + text, persona: _activeAgent.id, sessionKey: sessionKey }),
        }).then(function (r) { return r.json(); }).then(function (data) {
            var reply = '';
            if (data.choices && data.choices[0] && data.choices[0].message) {
                reply = data.choices[0].message.content || '';
            } else {
                reply = data.reply || data.text || data.response || data.message || 'Sent to agent';
            }
            _messages.push({ role: 'agent', text: reply, time: timeStr() });
            renderMessages();
            saveHistory();
        }).catch(function (err) {
            _messages.push({ role: 'agent', text: '⚠️ Could not reach agent: ' + err.message, time: timeStr() });
            renderMessages();
            saveHistory();
        }).finally(function () {
            _sending = false;
            document.getElementById('ecw-send').disabled = false;
            document.getElementById('ecw-typing').classList.remove('ecw-typing-show');
        });
    }

    function scrollToBottom() {
        var container = document.getElementById('ecw-messages');
        if (container) setTimeout(function () { container.scrollTop = container.scrollHeight; }, 50);
    }

    /* ── Bootstrap ──────────────────────────────────────────── */
    function init() {
        // Don't init if in auth-pending state
        if (document.body.classList.contains('sk-auth-pending')) {
            setTimeout(init, 500);
            return;
        }

        createPill();
        createPanel();
        loadHistory();
        renderMessages();

        // Public API
        window.ExecChatWidget = {
            open: openPanel,
            close: closePanel,
            toggle: togglePanel,
        };

        console.log('[ChatWidget] ✅ Floating chat widget ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
