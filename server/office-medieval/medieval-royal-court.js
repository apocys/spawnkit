(function () {
  'use strict';

  var STORAGE_KEY = 'medieval-court-seen-v2';

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var CONFIG_KEY = 'spawnkit-config';

  var KNIGHTS = [
    { id: 'Sycopa',   title: 'Lord Commander',  icon: '🎭', color: '#FFD700' },
    { id: 'Forge',    title: 'Master Smith',     icon: '⚒️', color: '#FF6600' },
    { id: 'Atlas',    title: 'Royal Scribe',     icon: '📜', color: '#3366FF' },
    { id: 'Hunter',   title: 'Royal Huntsman',   icon: '🏹', color: '#33CC33' },
    { id: 'Echo',     title: 'Court Bard',       icon: '🎵', color: '#CC33FF' },
    { id: 'Sentinel', title: 'Castle Guard',     icon: '🛡️', color: '#666699' },
  ];

  var QUESTS = [
    { label: '⚒️ Forge New Code',   fn: function () { window.openBuildingPanel && window.openBuildingPanel('🔨 Forge Workshop'); } },
    { label: '⚔️ Summon a Knight',  fn: function () { window.SummonWizard && window.SummonWizard.open && window.SummonWizard.open(); } },
    { label: '📜 Review the Realm', fn: function () { window.openMissionControl && window.openMissionControl(); } },
  ];

  var TIME_SUBTEXTS = {
    dawn: 'The sun rises on your realm',
    morning: 'Your court awaits your command',
    midday: 'The realm prospers under your rule',
    afternoon: "The day's work continues",
    dusk: 'The sun sets on another day of glory',
    night: 'The castle sleeps, but the watch endures',
  };

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent =
      '#royal-court-overlay{position:fixed;inset:0;z-index:9998;display:none;background:rgba(5,10,25,0.82);align-items:center;justify-content:center;opacity:0;transition:opacity .4s ease}' +
      '#royal-court-overlay.rc-visible{display:flex}#royal-court-overlay.rc-faded-in{opacity:1}' +
      '.rc-content{position:relative;width:min(900px,95vw);max-height:90vh;overflow-y:auto;background:rgba(15,25,50,.92);border:1px solid rgba(201,169,89,.4);border-radius:4px;padding:32px;box-shadow:0 0 60px rgba(201,169,89,.15),inset 0 0 80px rgba(0,0,0,.4)}' +
      '.rc-close-btn{position:absolute;top:12px;right:16px;cursor:pointer;color:rgba(168,162,153,.7);font-size:20px;background:none;border:none;padding:4px 8px;transition:color .2s}.rc-close-btn:hover{color:#c9a959}' +
      '#rc-greeting{text-align:center;margin-bottom:28px}' +
      '#rc-greeting h1{font-family:"Crimson Text",serif;font-size:clamp(22px,4vw,36px);color:#c9a959;margin:0 0 6px;text-shadow:0 0 20px rgba(201,169,89,.4);letter-spacing:.04em}' +
      '#rc-greeting p{color:rgba(168,162,153,.7);font-size:14px;margin:0;font-style:italic}' +
      '.rc-divider{width:60%;margin:0 auto 24px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,169,89,.4),transparent)}' +
      '.rc-section-label{font-family:"Crimson Text",serif;color:rgba(201,169,89,.6);font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px}' +
      '#rc-knight-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}' +
      '.rc-knight-card{display:flex;flex-direction:column;align-items:center;padding:14px 10px;border-radius:3px;cursor:pointer;background:rgba(255,255,255,.03);border:1px solid rgba(168,162,153,.2);transition:transform .18s,box-shadow .18s,border-color .18s}.rc-knight-card:hover{transform:translateY(-3px);background:rgba(255,255,255,.06)}' +
      '.rc-knight-avatar{font-size:32px;line-height:1;margin-bottom:8px}' +
      '.rc-knight-title{color:#f4e4bc;font-size:13px;font-weight:600;margin-bottom:2px;text-align:center}' +
      '.rc-knight-role{color:rgba(168,162,153,.7);font-size:11px;text-align:center}' +
      '.rc-bottom-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}' +
      '#rc-quest-grid{display:flex;flex-direction:column;gap:8px}' +
      '.rc-quest-tile{padding:10px 14px;border:1px solid rgba(201,169,89,.3);border-radius:3px;cursor:pointer;color:#f4e4bc;font-size:13px;background:rgba(201,169,89,.04);transition:background .15s,border-color .15s}.rc-quest-tile:hover{background:rgba(201,169,89,.1);border-color:rgba(201,169,89,.6)}' +
      '#rc-command-scroll{background:rgba(244,228,188,.08);border:1px solid rgba(201,169,89,.25);border-radius:3px;padding:14px}' +
      '#rc-command-input{width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid rgba(168,162,153,.3);border-radius:2px;color:#f4e4bc;font-size:13px;padding:8px 10px;resize:none;font-family:inherit;margin-bottom:10px;outline:none}' +
      '#rc-command-input::placeholder{color:rgba(168,162,153,.5)}#rc-command-input:focus{border-color:rgba(201,169,89,.5)}' +
      '#rc-command-send{width:100%;padding:9px;background:rgba(201,169,89,.15);border:1px solid rgba(201,169,89,.4);border-radius:2px;color:#c9a959;font-family:"Crimson Text",serif;font-size:14px;cursor:pointer;transition:background .15s}#rc-command-send:hover{background:rgba(201,169,89,.25)}' +
      '@media(max-width:600px){#rc-knight-grid{grid-template-columns:repeat(2,1fr)}.rc-bottom-row{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }

  function getUserName() {
    try { var c = JSON.parse(localStorage.getItem(CONFIG_KEY)); if (c && c.userName) return c.userName; } catch (e) {}
    return 'Commander';
  }

  function getTimeOfDay() {
    if (window.MedievalLifecycle && typeof window.MedievalLifecycle.getTimeOfDay === 'function') return window.MedievalLifecycle.getTimeOfDay();
    var h = new Date().getHours();
    if (h >= 5 && h < 7)  return 'dawn';
    if (h >= 7 && h < 12) return 'morning';
    if (h >= 12 && h < 14) return 'midday';
    if (h >= 14 && h < 18) return 'afternoon';
    if (h >= 18 && h < 21) return 'dusk';
    return 'night';
  }

  function markSeen() { try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {} }

  function sendMessage(text) {
    if (window.ThemeChat && typeof window.ThemeChat.sendMessage === 'function') {
      window.ThemeChat.sendMessage(text);
    } else {
      fetch('/api/oc/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) }).catch(function () {});
    }
  }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e[k] = attrs[k]; });
    return e;
  }

  function buildOverlay() {
    var overlay = el('div', { id: 'royal-court-overlay', className: 'rc-overlay' });
    var content = el('div', { className: 'rc-content' });

    var closeBtn = el('button', { className: 'rc-close-btn', innerHTML: '✕' });
    closeBtn.setAttribute('aria-label', 'Dismiss Royal Court');
    content.appendChild(closeBtn);

    var userName = getUserName();
    var tod = getTimeOfDay();
    var greeting = el('div', { id: 'rc-greeting' });
    greeting.innerHTML = '<h1>⚜ Welcome to the Kingdom, ' + esc(userName) + ' ⚜</h1><p>' + (TIME_SUBTEXTS[tod] || TIME_SUBTEXTS.morning) + '</p>';
    content.appendChild(greeting);

    var divider = el('div', { className: 'rc-divider' });
    content.appendChild(divider);

    var rLabel = el('div', { className: 'rc-section-label', textContent: 'Your Royal Court' });
    content.appendChild(rLabel);

    var knightGrid = el('div', { id: 'rc-knight-grid' });
    KNIGHTS.forEach(function (k) {
      var card = el('div', { className: 'rc-knight-card' });
      card.style.cssText = 'border-color:' + k.color + '33;box-shadow:0 0 8px ' + k.color + '22;';
      card.innerHTML = '<span class="rc-knight-avatar">' + k.icon + '</span><span class="rc-knight-title">' + k.id + '</span><span class="rc-knight-role">' + k.title + '</span>';
      card.addEventListener('mouseenter', function () { card.style.boxShadow = '0 0 16px ' + k.color + '55'; card.style.borderColor = k.color + '88'; });
      card.addEventListener('mouseleave', function () { card.style.boxShadow = '0 0 8px ' + k.color + '22'; card.style.borderColor = k.color + '33'; });
      card.addEventListener('click', function () {
        window.RoyalCourt.hide();
        if (window.PersonaCard && typeof window.PersonaCard.open === 'function') window.PersonaCard.open(k.id);
      });
      knightGrid.appendChild(card);
    });
    content.appendChild(knightGrid);

    var bottomRow = el('div', { className: 'rc-bottom-row' });

    // Quests
    var qWrap = el('div');
    qWrap.appendChild(el('div', { className: 'rc-section-label', textContent: 'Quick Quests' }));
    var questGrid = el('div', { id: 'rc-quest-grid' });
    QUESTS.forEach(function (q) {
      var tile = el('div', { className: 'rc-quest-tile', textContent: q.label });
      tile.addEventListener('click', function () { window.RoyalCourt.hide(); q.fn(); });
      questGrid.appendChild(tile);
    });
    qWrap.appendChild(questGrid);
    bottomRow.appendChild(qWrap);

    // Command scroll
    var sWrap = el('div');
    sWrap.appendChild(el('div', { className: 'rc-section-label', textContent: 'Royal Decree' }));
    var scroll = el('div', { id: 'rc-command-scroll' });
    var textarea = el('textarea', { id: 'rc-command-input', rows: 3, placeholder: 'Write your decree...' });
    var sendBtn = el('button', { id: 'rc-command-send', textContent: '📜 Send Royal Decree' });
    sendBtn.addEventListener('click', function () {
      var text = textarea.value.trim();
      if (!text) return;
      sendMessage(text);
      window.RoyalCourt.hide();
    });
    textarea.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendBtn.click(); });
    scroll.appendChild(textarea);
    scroll.appendChild(sendBtn);
    sWrap.appendChild(scroll);
    bottomRow.appendChild(sWrap);

    content.appendChild(bottomRow);
    overlay.appendChild(content);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) window.RoyalCourt.hide(); });
    closeBtn.addEventListener('click', function () { window.RoyalCourt.hide(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { var o = document.getElementById('royal-court-overlay'); if (o && o.classList.contains('rc-visible')) window.RoyalCourt.hide(); }
    });

    return overlay;
  }

  function getOrCreate() {
    return document.getElementById('royal-court-overlay') || (function () { var o = buildOverlay(); document.body.appendChild(o); return o; })();
  }

  window.RoyalCourt = {
    isFirstVisit: function () { try { return localStorage.getItem(STORAGE_KEY) !== 'true'; } catch (e) { return false; } },
    show: function () { var o = getOrCreate(); o.classList.add('rc-visible'); void o.offsetWidth; o.classList.add('rc-faded-in'); },
    hide: function () {
      var o = document.getElementById('royal-court-overlay');
      if (!o) return;
      markSeen();
      o.classList.remove('rc-faded-in');
      setTimeout(function () { o.classList.remove('rc-visible'); }, 320);
    },
  };

  injectStyles();
  if (window.RoyalCourt.isFirstVisit()) {
    // Show only after auth overlay is gone from the DOM (event-driven, no timeouts)
    function showWhenReady() {
      // If no auth overlay exists, show immediately
      if (!document.getElementById('skAuthOverlay')) {
        window.RoyalCourt.show();
        return;
      }
      // Auth overlay present — watch for its removal
      var authEl = document.getElementById('skAuthOverlay');
      if (authEl && typeof MutationObserver !== 'undefined') {
        var parent = authEl.parentNode || document.body;
        var obs = new MutationObserver(function (mutations) {
          if (!document.getElementById('skAuthOverlay')) {
            obs.disconnect();
            window.RoyalCourt.show();
          }
        });
        obs.observe(parent, { childList: true });
      } else if (window.ThemeAuth && typeof window.ThemeAuth.onAuth === 'function') {
        // Fallback: use onAuth callback + verify overlay gone
        window.ThemeAuth.onAuth(function () {
          var check = setInterval(function () {
            if (!document.getElementById('skAuthOverlay')) {
              clearInterval(check);
              window.RoyalCourt.show();
            }
          }, 100);
        });
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showWhenReady);
    } else {
      showWhenReady();
    }
  }

})();
