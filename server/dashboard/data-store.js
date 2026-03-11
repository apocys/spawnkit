/* SpawnKit Real-Time Dashboard — DataStore Singleton */

(function () {
  'use strict';

  const DataStore = {
    _agents: [],
    _missions: [],
    _metrics: {},
    _connectionState: 'connecting', // 'ok' | 'error' | 'connecting'
    _listeners: new Map(),
    _pollTimer: null,
    _ws: null,
    _config: {
      pollInterval: 5000,
      apiBase: '/api/dashboard',
      gatewayUrl: '',
      gatewayToken: '',
    },
    _wasError: false,

    /* ── Lifecycle ── */

    init(config = {}) {
      const pollOverride = window.DASHBOARD_POLL_MS;
      this._config = {
        pollInterval: pollOverride || config.pollInterval || 5000,
        apiBase: config.apiBase || '/api/dashboard',
        gatewayUrl: config.gatewayUrl || '',
        gatewayToken: config.gatewayToken || '',
      };

      this._startPolling();
      this._connectWebSocket();
      return this.refresh();
    },

    destroy() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
      if (this._ws) {
        this._ws.onclose = null; // prevent reconnect on intentional close
        this._ws.close();
        this._ws = null;
      }
      this._listeners.clear();
    },

    /* ── Event Bus ── */

    on(event, cb) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(cb);
    },

    off(event, cb) {
      const set = this._listeners.get(event);
      if (set) set.delete(cb);
    },

    emit(event, data) {
      const set = this._listeners.get(event);
      if (!set) return;
      set.forEach((cb) => {
        try { cb(data); } catch (e) { console.error(`[DataStore] listener error (${event}):`, e); }
      });
    },

    /* ── Getters ── */

    getAgents() { return this._agents; },
    getMissions() { return this._missions; },
    getMetrics() { return this._metrics; },
    getConnectionState() { return this._connectionState; },

    /* ── Refresh ── */

    refresh() {
      return this._poll();
    },

    /* ── Polling ── */

    _startPolling() {
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(() => this._poll(), this._config.pollInterval);
    },

    async _poll() {
      const url = `${this._config.apiBase}/snapshot`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Reconnection toast
        if (this._wasError) {
          this._wasError = false;
          this.emit('toast', { message: 'Reconnected to server', type: 'success' });
        }

        // Update internal state
        if (data.agents) {
          this._agents = data.agents;
          this.emit('agents', { agents: this._agents });
        }
        if (data.missions) {
          this._missions = data.missions;
          this.emit('missions', { missions: this._missions });
        }
        if (data.metrics) {
          this._metrics = data.metrics;
          this.emit('metrics', { metrics: this._metrics });
        }

        // Connection OK
        this._connectionState = 'ok';
        this.emit('connection', { state: 'ok' });
      } catch (err) {
        console.warn('[DataStore] poll failed:', err.message);
        this._connectionState = 'error';
        this._wasError = true;
        this.emit('connection', { state: 'error' });
      }
    },

    /* ── WebSocket ── */

    _connectWebSocket() {
      const gwUrl = this._config.gatewayUrl;
      if (!gwUrl) return;

      try {
        const wsProto = gwUrl.startsWith('https') ? 'wss' : 'ws';
        const base = gwUrl.replace(/^https?/, wsProto).replace(/\/+$/, '');
        const wsUrl = this._config.gatewayToken
          ? `${base}/ws/dashboard?token=${encodeURIComponent(this._config.gatewayToken)}`
          : `${base}/ws/dashboard`;

        this._ws = new WebSocket(wsUrl);

        this._ws.onopen = () => {
          console.log('[DataStore] WebSocket connected');
        };

        this._ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            this._handleWsMessage(msg);
          } catch (e) {
            console.warn('[DataStore] WS parse error:', e);
          }
        };

        this._ws.onclose = () => {
          console.log('[DataStore] WebSocket closed, falling back to polling');
          this._ws = null;
          // Polling is already running as fallback
        };

        this._ws.onerror = (err) => {
          console.warn('[DataStore] WebSocket error:', err);
        };
      } catch (err) {
        console.warn('[DataStore] WebSocket init failed:', err.message);
      }
    },

    _handleWsMessage(msg) {
      const { type, data } = msg;
      if (!type) return;

      switch (type) {
        case 'agents':
          if (data && data.agents) {
            this._agents = data.agents;
            this.emit('agents', { agents: this._agents });
          }
          break;
        case 'missions':
          if (data && data.missions) {
            this._missions = data.missions;
            this.emit('missions', { missions: this._missions });
          }
          break;
        case 'metrics':
          if (data && data.metrics) {
            this._metrics = data.metrics;
            this.emit('metrics', { metrics: this._metrics });
          }
          break;
        case 'connection':
          if (data && data.state) {
            this._connectionState = data.state;
            this.emit('connection', data);
          }
          break;
        case 'toast':
          this.emit('toast', data);
          break;
        default:
          // Unknown event type — emit it anyway for extensibility
          this.emit(type, data);
      }
    },
  };

  window.DataStore = DataStore;
})();
