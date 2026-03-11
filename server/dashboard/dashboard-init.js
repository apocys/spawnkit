/**
 * dashboard-init.js — App bootstrap, header clock, connection status, ticker
 * Called after all panel scripts are loaded.
 */
(function(global) {
  'use strict';

  // ── Config injected by server or detected ─────────────────

  const CONFIG = global.DASHBOARD_CONFIG || {};
  const API_BASE      = CONFIG.apiBase      || '';
  const GATEWAY_URL   = CONFIG.gatewayUrl   || '';
  const GATEWAY_TOKEN = CONFIG.gatewayToken || '';
  const POLL_MS       = CONFIG.pollInterval || 5000;

  // ── Clock ─────────────────────────────────────────────────

  function _startClock() {
    const el = document.getElementById('hdr-clock');
    if (!el) return;
    function tick() {
      const now = new Date();
      el.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Connection status ─────────────────────────────────────

  function _updateConnStatus(state) {
    const el = document.getElementById('hdr-status');
    if (!el) return;
    el.classList.remove('connection-ok', 'connection-error');
    const dot  = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');
    if (state === 'ok') {
      el.classList.add('connection-ok');
      if (text) text.textContent = 'Live';
    } else if (state === 'error') {
      el.classList.add('connection-error');
      if (text) text.textContent = 'Disconnected';
    } else {
      if (text) text.textContent = 'Connecting…';
    }
  }

  // ── Refresh button ────────────────────────────────────────

  function _initRefreshBtn() {
    const btn = document.getElementById('hdr-refresh-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.classList.add('spinning');
      DataStore.refresh();
      setTimeout(() => btn.classList.remove('spinning'), 800);
    });
  }

  // ── Toast system ──────────────────────────────────────────

  function _showToast({ message, type }) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'sk-toast sk-toast--' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity    = '0';
      toast.style.transform  = 'translateX(20px)';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ── Ticker ────────────────────────────────────────────────

  function _buildTickerItems(agents, missions, metrics) {
    const items = [];

    if (metrics) {
      items.push({ dot: metrics.cpu > 70 ? 'amber' : 'green',  text: `CPU ${(metrics.cpu||0).toFixed(1)}%` });
      items.push({ dot: metrics.memory > 80 ? 'amber' : 'green', text: `RAM ${(metrics.memory||0).toFixed(1)}%` });
      if (metrics.uptimeSeconds) {
        const h = Math.floor(metrics.uptimeSeconds / 3600);
        items.push({ dot: 'blue', text: `Uptime ${h}h` });
      }
      if (metrics.fleetPeers > 0) {
        items.push({ dot: 'green', text: `${metrics.fleetPeers} fleet peer${metrics.fleetPeers !== 1 ? 's' : ''}` });
      }
    }

    if (agents) {
      const active  = agents.filter(a => a.status === 'active').length;
      const total   = agents.length;
      items.push({ dot: active > 0 ? 'green' : '', text: `${active}/${total} agents active` });
      agents.filter(a => a.status === 'active' && a.task).slice(0, 3).forEach(a => {
        items.push({ dot: 'blue', text: `${a.name}: ${a.task}` });
      });
    }

    if (missions) {
      const running = missions.filter(m => m.status === 'running' || m.status === 'planning');
      running.slice(0, 4).forEach(m => {
        items.push({ dot: 'blue', text: `${m.icon || '📋'} ${m.name} — ${m.progress || 0}%` });
      });
    }

    return items;
  }

  function _updateTicker(agents, missions, metrics) {
    const inner = document.querySelector('.ticker-inner');
    if (!inner) return;
    const items  = _buildTickerItems(agents, missions, metrics);
    if (items.length === 0) return;

    // Duplicate for seamless loop
    const all = [...items, ...items];
    inner.innerHTML = all.map(item => `
      <div class="ticker-item">
        <span class="tick-dot ${item.dot || ''}"></span>
        ${item.text}
      </div>
    `).join('');
  }

  // ── Fade-in on load ───────────────────────────────────────

  function _fadeIn() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });
    });
  }

  // ── Main init ─────────────────────────────────────────────

  function init() {
    _fadeIn();
    _startClock();
    _initRefreshBtn();

    // Init panels (they subscribe to DataStore internally)
    if (global.AgentsPanel)  AgentsPanel.init();
    if (global.MissionsPanel) MissionsPanel.init();
    if (global.MetricsPanel) MetricsPanel.init();

    // Init DataStore — triggers first fetch
    DataStore.init({
      apiBase:      API_BASE,
      gatewayUrl:   GATEWAY_URL,
      gatewayToken: GATEWAY_TOKEN,
      pollInterval: POLL_MS,
    });

    // Wire connection status to header
    DataStore.on('connection', ({ state }) => _updateConnStatus(state));
    _updateConnStatus('connecting');

    // Wire toasts
    DataStore.on('toast', _showToast);

    // Wire ticker updates
    let _tickerAgents, _tickerMissions, _tickerMetrics;
    function _tickerMaybeUpdate() {
      if (_tickerAgents !== undefined || _tickerMissions !== undefined || _tickerMetrics !== undefined) {
        _updateTicker(_tickerAgents, _tickerMissions, _tickerMetrics);
      }
    }
    DataStore.on('agents',   ({ agents })   => { _tickerAgents   = agents;   _tickerMaybeUpdate(); });
    DataStore.on('missions', ({ missions }) => { _tickerMissions = missions; _tickerMaybeUpdate(); });
    DataStore.on('metrics',  ({ metrics })  => { _tickerMetrics  = metrics;  _tickerMaybeUpdate(); });
  }

  // Boot when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
