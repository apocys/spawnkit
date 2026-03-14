/**
 * Mission Control — Awwwards-level mission dashboard overlay
 * Replaces the old Mission Chat right panel with a full-screen mission view.
 * 
 * Shows: Mission name, goal, elapsed time, tasks with live status,
 * agent/sub-agent roster, KPIs, and integrated chat.
 */
(function() {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'K' : String(n); }
  function relTime(ms) {
    if (!ms) return '—';
    var s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }
  function duration(ms) {
    if (!ms) return '0s';
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s/60) + 'm ' + (s%60) + 's';
    return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
  }
  var fetcher = function(url, opts) { return (window.skFetch || fetch)(url, opts); };
  var base = function() { return window.OC_API_URL || window.location.origin; };

  // ── CSS ─────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = `
    .mc-overlay {
      position: fixed; inset: 0; z-index: 10010;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      opacity: 0; pointer-events: none;
      transition: opacity 0.4s cubic-bezier(0.16,1,0.3,1);
      display: flex; align-items: center; justify-content: center;
    }
    .mc-overlay.open { opacity: 1; pointer-events: auto; }

    .mc-panel {
      width: 94vw; max-width: 1200px;
      height: 88vh; max-height: 900px;
      background: var(--bg-primary, #0a0a0a);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.08);
      display: grid;
      grid-template-columns: 1fr 360px;
      grid-template-rows: auto 1fr auto;
      overflow: hidden;
      transform: translateY(20px) scale(0.97);
      transition: transform 0.5s cubic-bezier(0.16,1,0.3,1);
      box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
    }
    .mc-overlay.open .mc-panel { transform: translateY(0) scale(1); }

    @media (max-width: 900px) {
      .mc-panel { grid-template-columns: 1fr; max-width: 600px; }
      .mc-sidebar { display: none; }
    }

    /* ── Header ───────────────────────────────────────────── */
    .mc-header {
      grid-column: 1 / -1;
      padding: 24px 32px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; gap: 20px;
    }
    .mc-header-back {
      background: none; border: none; color: var(--text-tertiary, #666);
      font-size: 24px; cursor: pointer; padding: 4px 8px; border-radius: 8px;
      transition: all 0.2s;
    }
    .mc-header-back:hover { background: rgba(255,255,255,0.06); color: var(--text-primary, #fff); }
    .mc-header-info { flex: 1; }
    .mc-header-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
      color: var(--text-tertiary, #666); font-weight: 500; margin-bottom: 2px;
    }
    .mc-header-title {
      font-size: clamp(18px, 2.5vw, 28px); font-weight: 700;
      color: var(--text-primary, #fff); letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .mc-header-meta {
      display: flex; gap: 20px; align-items: center;
    }
    .mc-header-meta-item {
      text-align: center;
    }
    .mc-header-meta-val {
      font-size: 20px; font-weight: 700; color: var(--text-primary, #fff);
      line-height: 1;
    }
    .mc-header-meta-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--text-tertiary, #666); margin-top: 2px;
    }
    .mc-close {
      background: none; border: none; color: var(--text-tertiary, #666);
      font-size: 24px; cursor: pointer; padding: 4px 10px; border-radius: 8px;
      transition: all 0.2s;
    }
    .mc-close:hover { background: rgba(255,255,255,0.06); color: var(--text-primary, #fff); }

    /* ── KPI Bar ──────────────────────────────────────────── */
    .mc-kpis {
      grid-column: 1 / -1;
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1px; background: rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .mc-kpi {
      background: var(--bg-primary, #0a0a0a);
      padding: 16px 20px; text-align: center;
    }
    .mc-kpi-val {
      font-size: 22px; font-weight: 700;
      background: linear-gradient(135deg, #007AFF, #5856D6);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .mc-kpi-val.green { background: linear-gradient(135deg, #34C759, #30D158); -webkit-background-clip: text; background-clip: text; }
    .mc-kpi-val.orange { background: linear-gradient(135deg, #FF9F0A, #FFD60A); -webkit-background-clip: text; background-clip: text; }
    .mc-kpi-val.red { background: linear-gradient(135deg, #FF3B30, #FF6961); -webkit-background-clip: text; background-clip: text; }
    .mc-kpi-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;
      color: var(--text-tertiary, #666); margin-top: 4px; font-weight: 500;
    }

    /* ── Main Content ─────────────────────────────────────── */
    .mc-main {
      overflow-y: auto; padding: 24px 28px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
    }

    .mc-section-title {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
      color: var(--text-tertiary, #666); font-weight: 600; margin: 0 0 12px;
      display: flex; align-items: center; gap: 8px;
    }
    .mc-section-title::after {
      content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06);
    }

    /* ── Task List ─────────────────────────────────────────── */
    .mc-task {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px 16px; border-radius: 12px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      margin-bottom: 8px;
      transition: all 0.25s ease;
    }
    .mc-task:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
    .mc-task-icon { font-size: 16px; margin-top: 2px; flex-shrink: 0; }
    .mc-task-body { flex: 1; min-width: 0; }
    .mc-task-name {
      font-size: 13px; font-weight: 600; color: var(--text-primary, #fff);
      margin-bottom: 2px; line-height: 1.4;
    }
    .mc-task-meta {
      font-size: 11px; color: var(--text-tertiary, #666);
    }
    .mc-task.done .mc-task-name { opacity: 0.4; text-decoration: line-through; }
    .mc-task.running .mc-task-name { color: #34C759; }

    /* ── Agent Roster ─────────────────────────────────────── */
    .mc-agents {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px; margin-bottom: 24px;
    }
    .mc-agent-card {
      padding: 14px 16px; border-radius: 12px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      cursor: pointer; transition: all 0.25s ease;
    }
    .mc-agent-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); transform: translateY(-2px); }
    .mc-agent-card.active { border-color: rgba(52,199,89,0.3); background: rgba(52,199,89,0.04); }
    .mc-agent-name {
      font-size: 13px; font-weight: 700; color: var(--text-primary, #fff);
      display: flex; align-items: center; gap: 6px;
    }
    .mc-agent-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--text-tertiary, #444);
    }
    .mc-agent-dot.active { background: #34C759; box-shadow: 0 0 6px rgba(52,199,89,0.5); }
    .mc-agent-role {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--text-tertiary, #666); margin-top: 3px;
    }
    .mc-agent-stat {
      font-size: 11px; color: var(--text-secondary, #999); margin-top: 6px;
    }

    /* ── Sidebar (Chat) ───────────────────────────────────── */
    .mc-sidebar {
      border-left: 1px solid rgba(255,255,255,0.06);
      display: flex; flex-direction: column;
      grid-row: 2 / 4;
    }
    .mc-chat-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.12em; color: var(--text-tertiary, #666);
    }
    .mc-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .mc-chat-msg {
      max-width: 90%; padding: 10px 14px; border-radius: 14px;
      font-size: 13px; line-height: 1.5;
    }
    .mc-chat-msg.user {
      align-self: flex-end;
      background: #007AFF; color: #fff;
      border-bottom-right-radius: 4px;
    }
    .mc-chat-msg.assistant {
      align-self: flex-start;
      background: rgba(255,255,255,0.06); color: var(--text-primary, #fff);
      border-bottom-left-radius: 4px;
    }
    .mc-chat-msg.system {
      align-self: center;
      background: none; color: var(--text-tertiary, #666);
      font-size: 11px; text-align: center;
    }
    .mc-chat-input-bar {
      padding: 16px 20px;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; gap: 8px;
    }
    .mc-chat-input {
      flex: 1; padding: 10px 14px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.04); color: var(--text-primary, #fff);
      font-size: 13px; font-family: inherit; outline: none;
      transition: border-color 0.2s;
    }
    .mc-chat-input:focus { border-color: rgba(0,122,255,0.5); }
    .mc-chat-input::placeholder { color: var(--text-tertiary, #555); }
    .mc-chat-send {
      background: #007AFF; color: #fff; border: none;
      width: 38px; height: 38px; border-radius: 12px;
      font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .mc-chat-send:hover { background: #0056CC; transform: scale(0.95); }

    /* ── Goal Section ─────────────────────────────────────── */
    .mc-goal {
      padding: 16px 20px; border-radius: 14px;
      background: linear-gradient(135deg, rgba(0,122,255,0.06), rgba(88,86,214,0.06));
      border: 1px solid rgba(0,122,255,0.1);
      margin-bottom: 24px;
      font-size: 14px; line-height: 1.6; color: var(--text-secondary, #ccc);
    }

    /* ── Timeline ─────────────────────────────────────────── */
    .mc-timeline {
      position: relative; padding-left: 24px; margin-bottom: 24px;
    }
    .mc-timeline::before {
      content: ''; position: absolute; left: 7px; top: 4px; bottom: 4px;
      width: 2px; background: rgba(255,255,255,0.06);
    }
    .mc-timeline-item {
      position: relative; padding: 8px 0 16px;
    }
    .mc-timeline-item::before {
      content: ''; position: absolute; left: -20px; top: 12px;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--text-tertiary, #444);
      border: 2px solid var(--bg-primary, #0a0a0a);
    }
    .mc-timeline-item.active::before { background: #34C759; box-shadow: 0 0 8px rgba(52,199,89,0.4); }
    .mc-timeline-item.done::before { background: #007AFF; }
    .mc-timeline-time {
      font-size: 10px; color: var(--text-tertiary, #666);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .mc-timeline-text {
      font-size: 13px; color: var(--text-primary, #fff); margin-top: 2px;
    }

    /* ── Reduced motion ───────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .mc-overlay, .mc-panel { transition: none; }
      .mc-task, .mc-agent-card { transition: none; }
    }
  `;
  document.head.appendChild(style);

  // ── State ───────────────────────────────────────────────────────
  var _overlay = null;
  var _pollTimer = null;
  var _missionData = null;
  var _chatHistory = [];

  // ── Build Overlay ───────────────────────────────────────────────
  function buildOverlay() {
    if (_overlay) _overlay.remove();
    var el = document.createElement('div');
    el.className = 'mc-overlay';
    el.id = 'missionControlOverlay';
    el.innerHTML = `
      <div class="mc-panel">
        <div class="mc-header">
          <button class="mc-header-back" id="mcBack" title="Back">←</button>
          <div class="mc-header-info">
            <div class="mc-header-label">Mission Control</div>
            <div class="mc-header-title" id="mcTitle">Loading...</div>
          </div>
          <div class="mc-header-meta" id="mcMeta"></div>
          <button class="mc-close" id="mcClose" title="Close">×</button>
        </div>
        <div class="mc-kpis" id="mcKpis"></div>
        <div class="mc-main" id="mcMain"></div>
        <div class="mc-sidebar">
          <div class="mc-chat-header">💬 Mission Chat</div>
          <div class="mc-chat-messages" id="mcChatMessages">
            <div class="mc-chat-msg system">Send a message to interact with this mission.</div>
          </div>
          <div class="mc-chat-input-bar">
            <input class="mc-chat-input" id="mcChatInput" placeholder="Ask about this mission..." />
            <button class="mc-chat-send" id="mcChatSend">↑</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    _overlay = el;

    // Bind events
    el.querySelector('#mcClose').onclick = close;
    el.querySelector('#mcBack').onclick = close;
    el.addEventListener('click', function(e) {
      if (e.target === el) close();
    });
    el.querySelector('#mcChatSend').onclick = sendChat;
    el.querySelector('#mcChatInput').onkeydown = function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    };

    return el;
  }

  // ── Fetch Mission Data ──────────────────────────────────────────
  async function fetchData() {
    try {
      var [sessRes, agentRes, taskRes, cronRes] = await Promise.all([
        fetcher(base() + '/api/oc/sessions').then(r => r.json()),
        fetcher(base() + '/api/oc/agents').then(r => r.json()),
        fetcher(base() + '/api/oc/tasks').then(r => r.json()),
        fetcher(base() + '/api/oc/crons').then(r => r.json()),
      ]);

      var sessions = Array.isArray(sessRes) ? sessRes : (sessRes.sessions || []);
      var agents = agentRes.agents || [];
      var tasks = taskRes.tasks || [];
      var crons = cronRes.crons || [];

      // Today boundary
      var todayStart = new Date(); todayStart.setHours(0,0,0,0);
      var todayMs = todayStart.getTime();

      // Compute KPIs
      var activeSessions = sessions.filter(function(s) { return s.status === 'active'; });
      var todaySessions = sessions.filter(function(s) { return (s.lastActive || 0) > todayMs; });
      var todayTokens = todaySessions.reduce(function(sum, s) { return sum + (s.totalTokens || 0); }, 0);
      var subagents = sessions.filter(function(s) { return s.kind === 'subagent'; });
      var completedToday = subagents.filter(function(s) { return s.status !== 'active' && (s.lastActive || 0) > todayMs; });

      // Main session
      var mainSession = sessions.find(function(s) { return s.key === 'agent:main:main'; });
      var missionStart = mainSession ? mainSession.lastActive : Date.now();
      var elapsed = Date.now() - missionStart;

      _missionData = {
        title: 'SpawnKit Executive Integration',
        goal: 'Fix all data integration issues: chat, brainstorm, agent roster, daily brief, and mission control. Ensure real-time data flows from OpenClaw workspace into the SpawnKit web UI.',
        sessions: sessions,
        agents: agents,
        tasks: tasks,
        crons: crons,
        kpis: {
          activeSessions: activeSessions.length,
          totalSessions: sessions.length,
          todayTokens: todayTokens,
          agents: agents.length,
          subagentsTotal: subagents.length,
          subagentsCompleted: completedToday.length,
          tasksTotal: tasks.length,
          tasksDone: tasks.filter(function(t) { return t.status === 'done'; }).length,
          cronJobs: crons.length,
          elapsed: elapsed,
          mainModel: mainSession ? mainSession.model : 'unknown',
        },
        timeline: buildTimeline(sessions, todayMs),
      };

      return _missionData;
    } catch(e) {
      console.error('[MissionControl] fetch error:', e);
      return null;
    }
  }

  function buildTimeline(sessions, todayMs) {
    var events = [];
    var todaySessions = sessions
      .filter(function(s) { return (s.lastActive || 0) > todayMs; })
      .sort(function(a, b) { return (b.lastActive || 0) - (a.lastActive || 0); });

    todaySessions.slice(0, 15).forEach(function(s) {
      events.push({
        time: s.lastActive,
        text: (s.label || s.key || 'Session').replace(/^agent:main:/, ''),
        status: s.status === 'active' ? 'active' : 'done',
        model: s.model,
        tokens: s.totalTokens,
      });
    });
    return events;
  }

  // ── Render ──────────────────────────────────────────────────────
  function render(data) {
    if (!data || !_overlay) return;

    // Title
    _overlay.querySelector('#mcTitle').textContent = data.title;

    // Header meta
    var meta = _overlay.querySelector('#mcMeta');
    meta.innerHTML = `
      <div class="mc-header-meta-item">
        <div class="mc-header-meta-val">${duration(data.kpis.elapsed)}</div>
        <div class="mc-header-meta-label">Elapsed</div>
      </div>
      <div class="mc-header-meta-item">
        <div class="mc-header-meta-val" style="color:#34C759;">${data.kpis.activeSessions}</div>
        <div class="mc-header-meta-label">Active</div>
      </div>
    `;

    // KPIs
    var kpis = _overlay.querySelector('#mcKpis');
    kpis.innerHTML = `
      <div class="mc-kpi">
        <div class="mc-kpi-val">${fmt(data.kpis.todayTokens)}</div>
        <div class="mc-kpi-label">Tokens Today</div>
      </div>
      <div class="mc-kpi">
        <div class="mc-kpi-val green">${data.kpis.tasksDone}/${data.kpis.tasksTotal}</div>
        <div class="mc-kpi-label">Tasks Complete</div>
      </div>
      <div class="mc-kpi">
        <div class="mc-kpi-val">${data.kpis.agents}</div>
        <div class="mc-kpi-label">Agents</div>
      </div>
      <div class="mc-kpi">
        <div class="mc-kpi-val orange">${data.kpis.subagentsTotal}</div>
        <div class="mc-kpi-label">Sub-Agents</div>
      </div>
      <div class="mc-kpi">
        <div class="mc-kpi-val">${data.kpis.cronJobs}</div>
        <div class="mc-kpi-label">Cron Jobs</div>
      </div>
      <div class="mc-kpi">
        <div class="mc-kpi-val">${data.kpis.totalSessions}</div>
        <div class="mc-kpi-label">Total Sessions</div>
      </div>
    `;

    // Main content
    var main = _overlay.querySelector('#mcMain');
    main.innerHTML = '';

    // Goal
    main.innerHTML += '<div class="mc-goal">🎯 <strong>Goal:</strong> ' + esc(data.goal) + '</div>';

    // Agent Roster
    main.innerHTML += '<div class="mc-section-title">Agent Roster</div>';
    var agentGrid = '<div class="mc-agents">';
    var ROLE_MAP = {
      'main': { name: 'ApoMac', role: 'CEO', color: '#FFD60A' },
      'cto-forge': { name: 'Forge', role: 'CTO', color: '#FF6B35' },
      'coo-atlas': { name: 'Atlas', role: 'COO', color: '#5856D6' },
      'cro-hunter': { name: 'Hunter', role: 'CRO', color: '#34C759' },
      'cmo-echo': { name: 'Echo', role: 'CMO', color: '#007AFF' },
      'sentinel': { name: 'Sentinel', role: 'CSO', color: '#FF3B30' },
    };
    data.agents.forEach(function(a) {
      var mapped = ROLE_MAP[a.id] || {};
      var isActive = a.status === 'active';
      agentGrid += '<div class="mc-agent-card' + (isActive ? ' active' : '') + '">' +
        '<div class="mc-agent-name"><span class="mc-agent-dot' + (isActive ? ' active' : '') + '"></span>' + esc(mapped.name || a.name || a.id) + '</div>' +
        '<div class="mc-agent-role">' + esc(mapped.role || 'Agent') + '</div>' +
        '<div class="mc-agent-stat">' + esc(a.model || 'unknown') + '</div>' +
      '</div>';
    });
    agentGrid += '</div>';
    main.innerHTML += agentGrid;

    // Tasks
    main.innerHTML += '<div class="mc-section-title">Tasks</div>';
    var taskHtml = '';
    data.tasks.forEach(function(t) {
      var isDone = t.status === 'done';
      var icon = isDone ? '✅' : '⬜';
      var cls = isDone ? 'done' : '';
      var title = (t.title || '').replace(/\*\*/g, '').replace(/\[.\]\s*/, '');
      if (title.length > 100) title = title.substring(0, 100) + '...';
      taskHtml += '<div class="mc-task ' + cls + '">' +
        '<span class="mc-task-icon">' + icon + '</span>' +
        '<div class="mc-task-body">' +
          '<div class="mc-task-name">' + esc(title) + '</div>' +
        '</div>' +
      '</div>';
    });
    if (!taskHtml) taskHtml = '<div class="mc-task"><span class="mc-task-icon">📋</span><div class="mc-task-body"><div class="mc-task-name" style="opacity:0.4;">No active tasks</div></div></div>';
    main.innerHTML += taskHtml;

    // Recent Activity Timeline
    if (data.timeline && data.timeline.length > 0) {
      main.innerHTML += '<div class="mc-section-title" style="margin-top:24px;">Recent Activity</div>';
      var tlHtml = '<div class="mc-timeline">';
      data.timeline.slice(0, 10).forEach(function(ev) {
        tlHtml += '<div class="mc-timeline-item ' + (ev.status || '') + '">' +
          '<div class="mc-timeline-time">' + relTime(ev.time) + (ev.tokens ? ' · ' + fmt(ev.tokens) + ' tokens' : '') + '</div>' +
          '<div class="mc-timeline-text">' + esc(ev.text) + '</div>' +
        '</div>';
      });
      tlHtml += '</div>';
      main.innerHTML += tlHtml;
    }
  }

  // ── Chat ────────────────────────────────────────────────────────
  function sendChat() {
    var input = _overlay.querySelector('#mcChatInput');
    var msg = (input.value || '').trim();
    if (!msg) return;
    input.value = '';

    // Add user message
    addChatMsg('user', msg);

    // Send to API
    fetcher(base() + '/api/oc/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok && d.reply) {
        addChatMsg('assistant', d.reply);
      } else {
        addChatMsg('system', 'No response received.');
      }
    })
    .catch(function() {
      addChatMsg('system', 'Connection error.');
    });
  }

  function addChatMsg(role, text) {
    var container = _overlay.querySelector('#mcChatMessages');
    var el = document.createElement('div');
    el.className = 'mc-chat-msg ' + role;
    el.innerHTML = esc(text).replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    _chatHistory.push({ role: role, text: text });
  }

  // ── Open / Close ────────────────────────────────────────────────
  async function open(missionTitle) {
    buildOverlay();
    // Force a reflow before adding class for CSS transition to work
    void _overlay.offsetWidth;
    _overlay.classList.add('open');

    var data = await fetchData();
    if (data) {
      if (missionTitle) data.title = missionTitle;
      render(data);
    }

    // Start polling for live updates
    _pollTimer = setInterval(async function() {
      var d = await fetchData();
      if (d) render(d);
    }, 15000);
  }

  function close() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    if (_overlay) {
      _overlay.classList.remove('open');
      setTimeout(function() { if (_overlay) { _overlay.remove(); _overlay = null; } }, 500);
    }
    _chatHistory = [];
  }

  // ── Expose ──────────────────────────────────────────────────────
  window.MissionControl = { open: open, close: close };

})();
