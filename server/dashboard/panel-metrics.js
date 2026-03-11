/**
 * MetricsPanel — System metrics: CPU, memory, uptime, services
 * Reads from /api/dashboard/metrics and renders live gauges.
 */
(function(global) {
  'use strict';

  let _panelEl     = null;
  let _bodyEl      = null;
  let _prevMetrics = {};

  // ── Helpers ───────────────────────────────────────────────

  function _fmtUptime(secs) {
    if (!secs) return '—';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function _fmtBytes(mb) {
    if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
    return Math.round(mb) + ' MB';
  }

  function _colorClass(pct) {
    if (pct >= 90) return 'value-red';
    if (pct >= 70) return 'value-amber';
    return 'value-green';
  }

  function _fillClass(pct) {
    if (pct >= 90) return 'fill-red';
    if (pct >= 70) return 'fill-amber';
    return 'fill-green';
  }

  function _loadClass(load) {
    // rough: >2 = high, >1 = medium
    if (load > 2) return 'value-red';
    if (load > 1) return 'value-amber';
    return '';
  }

  // ── Build metrics HTML ────────────────────────────────────

  function _buildHTML(m) {
    const cpu    = typeof m.cpu    === 'number' ? m.cpu.toFixed(1)    : '—';
    const mem    = typeof m.memory === 'number' ? m.memory.toFixed(1) : '—';
    const cpuN   = typeof m.cpu    === 'number' ? m.cpu    : 0;
    const memN   = typeof m.memory === 'number' ? m.memory : 0;
    const uptime = _fmtUptime(m.uptimeSeconds || 0);
    const sess   = m.activeSessions || 0;
    const disk   = m.diskUsedPct   || 0;
    const loadAvg = m.loadAvg || [0, 0, 0];
    const services = m.services || [];
    const peers    = m.fleetPeers || 0;

    const memDetail = (m.memoryUsedMb && m.memoryTotalMb)
      ? `${_fmtBytes(m.memoryUsedMb)} / ${_fmtBytes(m.memoryTotalMb)}`
      : (mem + '%');

    return `
      <div class="metrics-grid">

        <!-- CPU -->
        <div class="metric-tile">
          <div class="metric-label">CPU Usage</div>
          <div class="metric-value ${_colorClass(cpuN)}" id="metric-cpu">${cpu}<small style="font-size:14px;font-weight:400;color:var(--text-muted)">%</small></div>
          <div class="progress-track">
            <div class="progress-fill ${_fillClass(cpuN)}" id="metric-cpu-bar" style="width:${Math.min(cpuN,100)}%"></div>
          </div>
          <div class="metric-sub">${loadAvg.length ? 'Load ' + loadAvg[0].toFixed(2) : ''}</div>
        </div>

        <!-- Memory -->
        <div class="metric-tile">
          <div class="metric-label">Memory</div>
          <div class="metric-value ${_colorClass(memN)}" id="metric-mem">${mem}<small style="font-size:14px;font-weight:400;color:var(--text-muted)">%</small></div>
          <div class="progress-track">
            <div class="progress-fill ${_fillClass(memN)}" id="metric-mem-bar" style="width:${Math.min(memN,100)}%"></div>
          </div>
          <div class="metric-sub">${memDetail}</div>
        </div>

        <!-- Uptime -->
        <div class="metric-tile">
          <div class="metric-label">Uptime</div>
          <div class="metric-value" id="metric-uptime">${uptime}</div>
          <div class="metric-sub">Node.js / Gateway</div>
        </div>

        <!-- Sessions -->
        <div class="metric-tile">
          <div class="metric-label">Active Sessions</div>
          <div class="metric-value ${sess > 0 ? 'value-green' : ''}" id="metric-sessions">${sess}</div>
          <div class="metric-sub">${peers > 0 ? peers + ' fleet peer' + (peers !== 1 ? 's' : '') : 'No peers'}</div>
        </div>

        <!-- Load Average -->
        <div class="metric-tile full-width">
          <div class="metric-label">Load Average</div>
          <div class="loadavg-row">
            <div class="loadavg-chip">
              <span class="chip-label">1 min</span>
              <span class="chip-val ${_loadClass(loadAvg[0])}">${(loadAvg[0] || 0).toFixed(2)}</span>
            </div>
            <div class="loadavg-chip">
              <span class="chip-label">5 min</span>
              <span class="chip-val ${_loadClass(loadAvg[1])}">${(loadAvg[1] || 0).toFixed(2)}</span>
            </div>
            <div class="loadavg-chip">
              <span class="chip-label">15 min</span>
              <span class="chip-val ${_loadClass(loadAvg[2])}">${(loadAvg[2] || 0).toFixed(2)}</span>
            </div>
            ${disk > 0 ? `
            <div class="loadavg-chip">
              <span class="chip-label">Disk</span>
              <span class="chip-val ${_colorClass(disk)}">${disk}%</span>
            </div>` : ''}
          </div>
        </div>

        ${services.length > 0 ? `
        <!-- Services -->
        <div class="metric-tile full-width">
          <div class="metric-label">Services</div>
          <div class="services-list">
            ${services.map(s => `
            <div class="service-row">
              <span class="service-name">${s.name || s.id}</span>
              <span class="service-badge ${s.running ? 'up' : 'down'}">${s.running ? 'UP' : 'DOWN'}</span>
              ${s.port ? `<span class="service-badge port">:${s.port}</span>` : ''}
            </div>`).join('')}
          </div>
        </div>` : ''}

      </div>
    `;
  }

  // ── Smooth value transition ───────────────────────────────

  function _animateValue(el, fromVal, toVal, suffix, colorFn) {
    if (!el) return;
    const duration = 600;
    const start    = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease-in-out quad
      const val  = fromVal + (toVal - fromVal) * ease;
      el.innerHTML = val.toFixed(1) + `<small style="font-size:14px;font-weight:400;color:var(--text-muted)">${suffix}</small>`;
      if (colorFn) el.className = 'metric-value ' + colorFn(val);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Public render ─────────────────────────────────────────

  function render(metrics) {
    if (!_bodyEl) return;
    if (_panelEl) _panelEl.classList.remove('is-loading', 'is-error');

    const prev = _prevMetrics;
    const isFirst = Object.keys(prev).length === 0;

    if (isFirst) {
      // Full render on first data
      _bodyEl.innerHTML = _buildHTML(metrics);
    } else {
      // Smooth numeric updates
      const cpuEl    = document.getElementById('metric-cpu');
      const cpuBar   = document.getElementById('metric-cpu-bar');
      const memEl    = document.getElementById('metric-mem');
      const memBar   = document.getElementById('metric-mem-bar');
      const uptimeEl = document.getElementById('metric-uptime');
      const sessEl   = document.getElementById('metric-sessions');

      if (cpuEl && typeof metrics.cpu === 'number') {
        _animateValue(cpuEl, prev.cpu || 0, metrics.cpu, '%', _colorClass);
      }
      if (cpuBar && typeof metrics.cpu === 'number') {
        cpuBar.style.width = Math.min(metrics.cpu, 100) + '%';
        cpuBar.className   = 'progress-fill ' + _fillClass(metrics.cpu);
      }
      if (memEl && typeof metrics.memory === 'number') {
        _animateValue(memEl, prev.memory || 0, metrics.memory, '%', _colorClass);
      }
      if (memBar && typeof metrics.memory === 'number') {
        memBar.style.width = Math.min(metrics.memory, 100) + '%';
        memBar.className   = 'progress-fill ' + _fillClass(metrics.memory);
      }
      if (uptimeEl) uptimeEl.textContent = _fmtUptime(metrics.uptimeSeconds);
      if (sessEl)   sessEl.textContent   = metrics.activeSessions || 0;

      // Re-render services + loadavg sections if changed
      const servicesChanged = JSON.stringify(metrics.services) !== JSON.stringify(prev.services);
      if (servicesChanged || isFirst) {
        // Re-render body entirely for structural changes
        _bodyEl.innerHTML = _buildHTML(metrics);
      }
    }

    _prevMetrics = Object.assign({}, metrics);
  }

  // ── Init ──────────────────────────────────────────────────

  function init() {
    _panelEl = document.getElementById('panel-metrics');
    _bodyEl  = _panelEl ? _panelEl.querySelector('.sk-panel-body') : null;

    if (!_panelEl) { console.error('[MetricsPanel] #panel-metrics not found'); return; }

    if (_bodyEl) {
      _bodyEl.innerHTML = `
        <div class="skeleton" style="height:80px"></div>
        <div class="skeleton" style="height:80px;opacity:0.7;margin-top:10px"></div>
        <div class="skeleton" style="height:60px;opacity:0.5;margin-top:10px"></div>
      `;
    }
    _panelEl.classList.add('is-loading');

    DataStore.on('metrics', ({ metrics }) => render(metrics));
  }

  global.MetricsPanel = { init, render };
})(window);
