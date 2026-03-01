/**
 * Medieval Allied Kingdoms — Panel UI
 * ════════════════════════════════════
 * Building panel content: peer list, invite generation, disconnect.
 * Depends on: medieval-raven-anim.js (RavenAnim)
 *
 * Exports: window.renderAlliedKingdoms, window.AlliedKingdoms
 * @version 2.0.0
 */
(function() {
    'use strict';

    var API_BASE = (function() {
        if (window.OC_API_URL) return window.OC_API_URL;
        if (window.location.hostname.includes('spawnkit.ai')) return window.location.origin;
        return 'http://127.0.0.1:8222';
    })();

    // ── CSS ──────────────────────────────────────
    var s = document.createElement('style');
    s.textContent = [
        '.ak-kingdom-card{background:rgba(22,33,62,.6);border:1px solid rgba(168,162,153,.25);border-radius:8px;padding:12px;margin-bottom:8px;position:relative;overflow:hidden;transition:border-color .3s}',
        '.ak-kingdom-card:hover{border-color:rgba(201,169,89,.5)}',
        '.ak-kingdom-card.ak-home{border-color:rgba(76,175,80,.4);background:rgba(22,33,62,.75)}',
        '.ak-kingdom-header{display:flex;justify-content:space-between;align-items:flex-start}',
        '.ak-kingdom-info{display:flex;gap:10px;align-items:center}',
        '.ak-kingdom-emoji{font-size:28px}',
        '.ak-kingdom-name{font-family:"Crimson Text",serif;font-size:15px;color:var(--castle-gold,#c9a959)}',
        '.ak-kingdom-status{font-size:11px;margin-top:2px}',
        '.ak-kingdom-status.online{color:#4caf50}.ak-kingdom-status.offline{color:rgba(168,162,153,.5)}.ak-kingdom-status.stale{color:#ff9800}',
        '.ak-kingdom-meta{font-size:10px;color:rgba(168,162,153,.5);margin-top:6px}',
        '.ak-banner-flag{position:absolute;top:0;right:12px;width:20px;height:32px;clip-path:polygon(0 0,100% 0,100% 80%,50% 100%,0 80%)}',
        '.ak-banner-flag.online{background:linear-gradient(180deg,#4caf50,#2e7d32)}.ak-banner-flag.offline{background:linear-gradient(180deg,#666,#444)}',
        '.ak-break-btn{font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid rgba(255,69,58,.3);color:#ff453a;background:transparent;cursor:pointer;font-family:"Crimson Text",serif;transition:all .2s}',
        '.ak-break-btn:hover{background:rgba(255,69,58,.15);border-color:rgba(255,69,58,.5)}',
        '.ak-raven-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:1px solid rgba(201,169,89,.4);background:rgba(201,169,89,.1);color:rgba(201,169,89,.9);cursor:pointer;font-family:"Crimson Text",serif;font-size:13px;transition:all .2s;margin-bottom:12px}',
        '.ak-raven-btn:hover{background:rgba(201,169,89,.2);border-color:rgba(201,169,89,.6);transform:translateY(-1px)}',
        '.ak-invite-scroll{display:none;margin-bottom:14px;padding:14px;border-radius:8px;background:linear-gradient(135deg,rgba(62,48,30,.8),rgba(44,34,22,.9));border:1px solid rgba(201,169,89,.4)}',
        '.ak-invite-scroll.visible{display:block;animation:ak-unroll .5s ease-out}',
        '@keyframes ak-unroll{from{opacity:0;max-height:0;padding:0 14px}to{opacity:1;max-height:200px;padding:14px}}',
        '.ak-invite-title{font-family:"Crimson Text",serif;font-size:13px;color:rgba(201,169,89,.9);margin-bottom:8px}',
        '.ak-invite-code{font-family:monospace;font-size:11px;padding:6px 10px;border-radius:4px;background:rgba(15,52,96,.6);border:1px solid rgba(168,162,153,.2);color:var(--castle-parchment,#f4e4bc);width:100%;box-sizing:border-box}',
        '.ak-invite-copy{padding:5px 12px;border-radius:4px;background:rgba(201,169,89,.2);border:1px solid rgba(201,169,89,.4);color:rgba(201,169,89,.9);cursor:pointer;font-size:11px;font-family:"Crimson Text",serif}',
        '.ak-invite-copy:hover{background:rgba(201,169,89,.3)}',
        '.ak-invite-note{font-size:10px;color:rgba(168,162,153,.5);margin-top:6px;font-style:italic}',
    ].join('\n');
    document.head.appendChild(s);

    // ── Helpers ──────────────────────────────────
    function esc(t) { return typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function skFetch(url, opts) {
        var h = (opts && opts.headers) || {};
        var tk = window.localStorage.getItem('sk_token');
        if (tk) h['Authorization'] = 'Bearer ' + tk;
        return fetch(url, Object.assign({}, opts || {}, { headers: h }));
    }

    // ── Render Panel ────────────────────────────
    function renderAlliedKingdoms(container) {
        var html = '';

        html += '<button class="ak-raven-btn" id="akSendRaven">';
        html += '<span style="font-size:18px">&#x1F426;&#x200D;&#x2B1B;</span>';
        html += '<span>Send Raven (Generate Invite)</span></button>';

        html += '<div class="ak-invite-scroll" id="akInviteScroll">';
        html += '<div class="ak-invite-title">\uD83D\uDCDC Sealed Scroll \u2014 Invitation to Alliance</div>';
        html += '<div style="display:flex;gap:8px;align-items:center">';
        html += '<input class="ak-invite-code" id="akInviteCode" readonly>';
        html += '<button class="ak-invite-copy" id="akCopyCode">Copy</button></div>';
        html += '<div class="ak-invite-note">Single-use seal. Expires within one day\'s march.</div></div>';

        html += '<div class="bp-section-title" style="margin-top:4px">Allied Kingdoms</div>';
        html += '<div id="akPeerList"><div class="bp-empty">Consulting the ravens\u2026</div></div>';

        container.innerHTML = html;
        loadPeers();
        document.getElementById('akSendRaven').addEventListener('click', handleSendRaven);
        document.getElementById('akCopyCode').addEventListener('click', handleCopyCode);
    }

    // ── Load Peers ──────────────────────────────
    async function loadPeers() {
        var list = document.getElementById('akPeerList');
        if (!list) return;
        try {
            var resp = await skFetch(API_BASE + '/api/fleet/peers');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            var peers = data.peers || [];

            if (peers.length === 0) {
                list.innerHTML = '<div class="bp-empty">No allied kingdoms yet. Send a raven to forge an alliance.</div>';
                return;
            }

            var html = '';
            peers.forEach(function(p) {
                var home = p.officeId === 'sycopa';
                var cls = p.online ? 'online' : (p.status === 'stale' ? 'stale' : 'offline');
                var txt = p.online ? '\u2694\uFE0F Banner Raised' : (p.status === 'stale' ? '\uD83D\uDD6F\uFE0F Flickering Flame' : '\uD83D\uDCA4 Gates Closed');

                html += '<div class="ak-kingdom-card' + (home ? ' ak-home' : '') + '">';
                html += '<div class="ak-banner-flag ' + cls + '"></div>';
                html += '<div class="ak-kingdom-header"><div class="ak-kingdom-info">';
                html += '<span class="ak-kingdom-emoji">' + esc(p.emoji || '\uD83C\uDFF0') + '</span><div>';
                html += '<div class="ak-kingdom-name">' + esc(p.name || p.officeId);
                if (home) html += ' <span style="font-size:10px;opacity:.6">(Your Realm)</span>';
                html += '</div><div class="ak-kingdom-status ' + cls + '">' + txt;
                if (p.agents > 0) html += ' \u2022 ' + p.agents + ' knight(s)';
                html += '</div></div></div>';
                if (!home) html += '<button class="ak-break-btn" data-pid="' + esc(p.officeId) + '">\uD83D\uDD25 Break Alliance</button>';
                html += '</div>';

                if (!home && p.lastSeen) {
                    var ago = Math.round((Date.now() - p.lastSeen) / 60000);
                    var at = ago < 1 ? 'moments ago' : (ago < 60 ? ago + ' candles ago' : Math.round(ago/60) + ' watches ago');
                    html += '<div class="ak-kingdom-meta">Last raven: ' + at;
                    if (p.pairedBy) html += ' \u2022 Forged by ' + esc(p.pairedBy);
                    html += '</div>';
                }
                if (home) html += '<div class="ak-kingdom-meta">fleet.spawnkit.ai \u2022 The Keep</div>';
                html += '</div>';
            });

            list.innerHTML = html;
            list.querySelectorAll('.ak-break-btn').forEach(function(b) {
                b.addEventListener('click', function() { handleBreakAlliance(b.getAttribute('data-pid')); });
            });
        } catch(e) {
            list.innerHTML = '<div class="bp-empty">\u26A0 The ravens could not reach the rookery.</div>';
        }
    }

    // ── Handlers ────────────────────────────────
    async function handleSendRaven() {
        var btn = document.getElementById('akSendRaven');
        if (!btn) return;
        btn.disabled = true;
        btn.querySelector('span:last-child').textContent = 'Preparing scroll\u2026';
        if (window.RavenAnim) window.RavenAnim.playSend();
        try {
            var resp = await skFetch(API_BASE + '/api/fleet/invite', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiresInHours: 24 })
            });
            var d = await resp.json();
            if (d.ok && d.code) {
                var scroll = document.getElementById('akInviteScroll');
                var input = document.getElementById('akInviteCode');
                if (scroll && input) { input.value = d.code; scroll.classList.add('visible'); }
            } else { alert('Raven returned empty: ' + (d.error || '?')); }
        } catch(e) { alert('Rookery unreachable: ' + e.message); }
        btn.disabled = false;
        btn.querySelector('span:last-child').textContent = 'Send Raven (Generate Invite)';
    }

    function handleCopyCode() {
        var inp = document.getElementById('akInviteCode'), btn = document.getElementById('akCopyCode');
        if (inp && inp.value) navigator.clipboard.writeText(inp.value).then(function() {
            btn.textContent = '\u2713 Sealed'; setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        });
    }

    async function handleBreakAlliance(id) {
        if (!confirm('Break alliance with ' + id + '?\nBanner lowered, raven token revoked.')) return;
        try {
            var resp = await skFetch(API_BASE + '/api/fleet/peer/' + id, { method: 'DELETE' });
            var d = await resp.json();
            if (d.ok) { loadPeers(); if (window.RavenAnim) window.RavenAnim.setCEOEmoticon('\u2694\uFE0F', 3000); }
            else alert('Failed: ' + (d.error || '?'));
        } catch(e) { alert('Error: ' + e.message); }
    }

    // ── Exports ─────────────────────────────────
    window.renderAlliedKingdoms = renderAlliedKingdoms;
    window.AlliedKingdoms = {
        render: renderAlliedKingdoms,
        loadPeers: loadPeers
    };
})();
