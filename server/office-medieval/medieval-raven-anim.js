/**
 * Medieval Raven Animations + CEO Emoticon
 * ══════════════════════════════════════════
 * Raven arrival (new peer joins), raven send (invite created),
 * and CEO floating emoji reactions.
 *
 * Exports: window.RavenAnim = { playArrival, playSend, setCEOEmoticon }
 * @version 1.0.0
 */
(function() {
    'use strict';

    // ── CSS ──────────────────────────────────────
    var s = document.createElement('style');
    s.textContent = [
        '.ak-raven-arrival{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:10000}',
        '.ak-raven-sprite{position:absolute;font-size:48px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.7));animation:ak-raven-fly 3s ease-in-out forwards}',
        '@keyframes ak-raven-fly{0%{top:-60px;left:110%;transform:rotate(-15deg) scale(.5);opacity:0}15%{opacity:1;transform:rotate(-10deg) scale(1)}50%{top:35vh;left:50%;transform:rotate(5deg) scale(1.2)}70%{top:50vh;left:40%;transform:rotate(-5deg) scale(1)}100%{top:60vh;left:50%;transform:rotate(0) scale(.8);opacity:0}}',
        '.ak-raven-message{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,rgba(62,48,30,.95),rgba(44,34,22,.97));border:2px solid rgba(201,169,89,.6);border-radius:10px;padding:20px 28px;text-align:center;animation:ak-msg-in .5s ease-out 1.5s both;font-family:"Crimson Text",serif;box-shadow:0 8px 32px rgba(0,0,0,.6)}',
        '@keyframes ak-msg-in{from{opacity:0;transform:translate(-50%,-50%) scale(.8)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
        '.ak-raven-msg-title{font-size:18px;color:rgba(201,169,89,.95);margin-bottom:6px}',
        '.ak-raven-msg-body{font-size:14px;color:var(--castle-parchment,#f4e4bc)}',
        '.ak-raven-send{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:10000}',
        '.ak-raven-send-sprite{position:absolute;font-size:36px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.7));animation:ak-raven-depart 2.5s ease-in forwards}',
        '@keyframes ak-raven-depart{0%{bottom:45vh;left:50%;opacity:1;transform:scale(1) rotate(0)}30%{bottom:55vh;left:55%;transform:scale(1.1) rotate(-10deg)}100%{bottom:110vh;left:110%;opacity:0;transform:scale(.4) rotate(-20deg)}}',
        '@keyframes ak-emoji-bounce{0%{transform:translateX(-50%) scale(0) translateY(10px)}50%{transform:translateX(-50%) scale(1.3) translateY(-5px)}100%{transform:translateX(-50%) scale(1) translateY(0)}}',
    ].join('\n');
    document.head.appendChild(s);

    // ── Helpers ──────────────────────────────────
    function esc(t) { return typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // ── Raven Arrival ───────────────────────────
    function playArrival(name, emoji) {
        var c = document.createElement('div');
        c.className = 'ak-raven-arrival';

        var r = document.createElement('div');
        r.className = 'ak-raven-sprite';
        r.innerHTML = '&#x1F426;&#x200D;&#x2B1B;';
        c.appendChild(r);

        var m = document.createElement('div');
        m.className = 'ak-raven-message';
        m.innerHTML = '<div class="ak-raven-msg-title">\uD83D\uDCDC A Raven Arrives!</div>'
            + '<div class="ak-raven-msg-body">' + esc(emoji || '\uD83C\uDFF0') + ' <strong>' + esc(name) + '</strong><br>has joined the Alliance</div>';
        c.appendChild(m);
        document.body.appendChild(c);

        setCEOEmoticon('\uD83E\uDD85', 8000);
        if (window.MedievalAudio && window.MedievalAudio.playOneShot) window.MedievalAudio.playOneShot('herald');

        setTimeout(function() {
            c.style.transition = 'opacity .5s'; c.style.opacity = '0';
            setTimeout(function() { c.remove(); }, 500);
        }, 4500);
    }

    // ── Raven Send ──────────────────────────────
    function playSend() {
        var c = document.createElement('div');
        c.className = 'ak-raven-send';
        var r = document.createElement('div');
        r.className = 'ak-raven-send-sprite';
        r.innerHTML = '&#x1F426;&#x200D;&#x2B1B;';
        c.appendChild(r);
        document.body.appendChild(c);
        setCEOEmoticon('\uD83E\uDD85', 4000);
        setTimeout(function() { c.remove(); }, 3000);
    }

    // ── CEO Emoticon ────────────────────────────
    function setCEOEmoticon(emoji, ms) {
        ms = ms || 5000;
        // Agent lifecycle hook
        if (window.AgentLifecycle && window.AgentLifecycle.setEmoji) {
            window.AgentLifecycle.setEmoji('sycopa', emoji, ms);
            return;
        }
        // DOM fallback
        var el = document.querySelector('[data-agent-id="sycopa"]')
              || document.querySelector('[data-agent-role="CEO"]')
              || document.querySelector('.agent-sprite-sycopa');
        if (!el) {
            var all = document.querySelectorAll('.medieval-agent,[data-agent-name]');
            for (var i = 0; i < all.length; i++) {
                if ((all[i].dataset && all[i].dataset.agentName === 'sycopa') || all[i].textContent.indexOf('Sycopa') !== -1) { el = all[i]; break; }
            }
        }
        if (el) {
            var b = document.createElement('div');
            b.style.cssText = 'position:absolute;top:-30px;left:50%;transform:translateX(-50%);font-size:24px;animation:ak-emoji-bounce .5s ease-out;z-index:100;pointer-events:none;text-shadow:0 2px 8px rgba(0,0,0,.5)';
            b.textContent = emoji;
            el.style.position = el.style.position || 'relative';
            el.appendChild(b);
            setTimeout(function() { b.style.transition = 'opacity .5s'; b.style.opacity = '0'; setTimeout(function() { b.remove(); }, 500); }, ms);
        }
        // 3D sprite hook
        if (window.castleApp && window.castleApp._agentSprites) {
            var sp = window.castleApp._agentSprites['sycopa'];
            if (sp && sp._emojiEl) {
                sp._emojiEl.textContent = emoji;
                setTimeout(function() { if (sp._emojiEl) sp._emojiEl.textContent = sp._defaultEmoji || '\uD83C\uDFAD'; }, ms);
            }
        }
    }

    // ── Exports ─────────────────────────────────
    window.RavenAnim = { playArrival: playArrival, playSend: playSend, setCEOEmoticon: setCEOEmoticon };
})();
