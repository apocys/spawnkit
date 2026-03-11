# SpawnKit Real-Time Dashboard — Interface Contract

## Files Structure
```
server/dashboard/
  index.html          — Main HTML shell (loads all modules)
  dashboard.css       — Shared design tokens + layout grid
  data-store.js       — DataStore singleton: fetch + poll + WebSocket
  panel-agents.js     — Agent status panel
  panel-missions.js   — Mission progress panel
  panel-metrics.js    — System metrics panel
  dashboard-init.js   — App bootstrap + layout glue
```

## Design System
- Background: `#0d0d1a` (near-black blue)
- Panel bg: `#131325` with border `rgba(255,255,255,0.06)`
- Accent blue: `#4f8ef7`
- Accent green: `#2dd36f`
- Accent amber: `#ffd60a`
- Accent red: `#ff3b30`
- Text primary: `#f0f0f8`
- Text muted: `rgba(240,240,248,0.5)`
- Font: `'Inter', -apple-system, sans-serif`
- Border radius: `12px` panels, `8px` cards, `4px` badges
- Panel padding: `20px`
- Grid gap: `16px`

## DOM IDs (exact — never deviate)
- `#dashboard-root`        — app mount point
- `#panel-agents`          — agent status panel wrapper
- `#panel-missions`        — mission progress panel wrapper
- `#panel-metrics`         — system metrics panel wrapper
- `#hdr-clock`             — header clock text node
- `#hdr-status`            — header connection status dot+text
- `#hdr-refresh-btn`       — manual refresh button
- `#agents-list`           — agents ul/div inside panel-agents
- `#agents-count`          — "N agents" badge in panel-agents header
- `#missions-list`         — missions ul/div inside panel-missions
- `#missions-active-count` — "N active" badge
- `#metric-cpu`            — CPU % value span
- `#metric-mem`            — Memory % value span
- `#metric-uptime`         — Uptime text span
- `#metric-sessions`       — Active sessions count span
- `#metric-cpu-bar`        — CPU progress bar fill div
- `#metric-mem-bar`        — Memory progress bar fill div
- `#toast-container`       — toast notification container

## CSS Classes (shared)
- `.sk-panel`              — panel card base
- `.sk-panel-header`       — panel title row
- `.sk-panel-title`        — h2 inside header
- `.sk-panel-badge`        — small count badge
- `.sk-panel-body`         — scrollable content area
- `.agent-card`            — agent row card
- `.agent-avatar`          — 36px avatar circle
- `.agent-status`          — status dot (+ modifier classes below)
- `.agent-status--active`  — green dot
- `.agent-status--idle`    — amber dot
- `.agent-status--offline` — grey dot
- `.agent-status--error`   — red dot
- `.agent-name`            — agent name text
- `.agent-role`            — role/model subtitle
- `.agent-task`            — current task text (truncated)
- `.mission-card`          — mission item row
- `.mission-name`          — mission title
- `.mission-progress-bar`  — progress bar track
- `.mission-progress-fill` — progress bar fill (width set via style)
- `.mission-pct`           — "42%" label
- `.mission-status`        — status badge (running/done/pending/failed)
- `.metric-row`            — a single metric display row
- `.metric-label`          — metric name
- `.metric-value`          — large value text
- `.progress-track`        — progress bar outer
- `.progress-fill`         — progress bar inner fill
- `.sk-toast`              — toast notification
- `.sk-toast--success`     — green toast
- `.sk-toast--error`       — red toast
- `.sk-toast--info`        — blue toast
- `.is-loading`            — skeleton shimmer state on panel
- `.is-error`              — error state on panel
- `.connection-ok`         — on #hdr-status when connected
- `.connection-error`      — on #hdr-status when disconnected

## DataStore API (data-store.js exports `window.DataStore`)
```js
DataStore.init(config)              // config: { pollInterval, apiBase, gatewayUrl, gatewayToken }
DataStore.on(event, callback)       // subscribe: 'agents', 'missions', 'metrics', 'connection'
DataStore.off(event, callback)      // unsubscribe
DataStore.emit(event, data)         // internal use
DataStore.refresh()                 // force immediate refresh all
DataStore.getAgents()               // returns current agent array
DataStore.getMissions()             // returns current missions array
DataStore.getMetrics()              // returns current metrics object
DataStore.getConnectionState()      // returns 'ok'|'error'|'connecting'
DataStore.destroy()                 // cleanup timers/WS
```

## Data Shapes

### Agent object
```json
{
  "id": "main",
  "name": "Sycopa",
  "role": "CEO",
  "model": "claude-sonnet-4-6",
  "status": "active",          // active | idle | offline | error
  "task": "Reviewing PR #42",
  "lastSeen": 1710000000000,
  "health": 100,               // 0-100
  "sessionKey": "agent:main:..."
}
```

### Mission object
```json
{
  "id": "mission_abc123",
  "name": "Build Real-Time Dashboard",
  "status": "running",         // running | done | pending | failed
  "progress": 45,              // 0-100
  "tasksTotal": 7,
  "tasksDone": 3,
  "startedAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### Metrics object
```json
{
  "cpu": 34.2,
  "memory": 61.5,
  "memoryUsedMb": 1542,
  "memoryTotalMb": 4096,
  "uptimeSeconds": 86400,
  "activeSessions": 3,
  "loadAvg": [0.5, 0.4, 0.3],
  "timestamp": 1710000000000
}
```

## API Endpoints (server-side additions needed in server.js)
- `GET /api/dashboard/agents`  — list agents with status
- `GET /api/dashboard/missions` — list missions with progress  
- `GET /api/dashboard/metrics`  — system metrics (cpu/mem/uptime)
- `GET /api/dashboard/snapshot` — all three in one call (used for initial load)

## Events Emitted by DataStore
- `'agents'` → payload: `{ agents: [...] }`
- `'missions'` → payload: `{ missions: [...] }`
- `'metrics'` → payload: `{ metrics: {...} }`
- `'connection'` → payload: `{ state: 'ok'|'error'|'connecting' }`
- `'toast'` → payload: `{ message, type: 'success'|'error'|'info' }`

## Panel Render Functions (each panel exports to window)
```js
window.AgentsPanel.init()     // called once by dashboard-init.js
window.AgentsPanel.render(agents)
window.MissionsPanel.init()
window.MissionsPanel.render(missions)
window.MetricsPanel.init()
window.MetricsPanel.render(metrics)
```

## Refresh Behavior
- Auto-poll every 5 seconds (configurable via `DASHBOARD_POLL_MS`)
- WebSocket support: if `OC_GATEWAY_WS` is available, subscribe to live events
- On WS disconnect: fallback to polling automatically
- Manual refresh button triggers `DataStore.refresh()`
- Loading skeletons shown on first load only

## Server API additions needed (dashboard-api.js)
The server needs a new route file `dashboard-api.js` that plugs into server.js.
It collects data from:
1. OpenClaw Gateway (`/api/sessions` → agents)
2. Mission Orchestrator (missions list)
3. `os` module (cpu/mem/uptime)
