# SpawnKit v2

**Your AI team, visualized.**

Watch your AI agents work, collaborate, and complete missions in a living virtual office. Three cinematic themes. One powerful engine.

## ⚠️ Canonical Codebase

**This is the ONLY SpawnKit codebase.** All other copies (`fleetkit-v2/`, `products/spawnkit-dashboard/`, etc.) are dead legacy versions and should be deleted on sight.

- **Production URL**: https://app.spawnkit.ai
- **Repo**: `apocys/spawnkit` on GitHub
- **Deployed from**: Hetzner server (`/mnt/HC_Volume_104509196/home_apocyz_runner/spawnkit/`)
- **Local dev clone**: `~/.openclaw/workspace/spawnkit/`

## 🏗️ Architecture

```
spawnkit/
├── server/                      # BACKEND + THEMES (production)
│   ├── server.js                # Main Express server (108KB)
│   ├── mission-orchestrator.js  # Mission system
│   ├── dashboard-api.js         # Dashboard API endpoints
│   ├── agent-templates.js       # Agent configuration
│   ├── channel-verifier.js      # Channel verification
│   ├── provision-server.js      # Server provisioning
│   ├── lib/                     # Shared backend libraries
│   ├── shared/                  # Shared frontend modules
│   ├── skills/                  # Skill system
│   ├── auth/                    # Authentication
│   ├── blueprints/              # Agent blueprints
│   ├── office-executive/        # Executive theme (production)
│   │   ├── index.html           # Main entry point
│   │   ├── app.js               # Application logic
│   │   ├── oc-data-store.js     # Data store (OcStore)
│   │   ├── mission-desk.js      # Mission desk UI
│   │   ├── src/                 # Source modules
│   │   │   └── data-bridge.js   # Data bridge (API integration)
│   │   └── ...
│   ├── office-medieval/         # Medieval theme
│   ├── office-medieval-v2/      # Medieval v2 theme
│   └── office-simcity-nature/   # SimCity Nature theme
├── landing/                     # Marketing landing page
├── arena/                       # Agent arena/sparring
├── electron/                    # Desktop app wrapper
├── test/                        # Playwright E2E tests
├── scripts/                     # Utility scripts
├── deploy.sh                    # Deployment script
└── playwright.config.js         # Test configuration
```

## ⚡ Quick Start

```bash
# Start the server
cd server
node server.js

# Run tests
npx playwright test
```

## 🎮 Themes

| Theme | Path | Status |
|-------|------|--------|
| **Executive** | `server/office-executive/` | ✅ Production |
| **Medieval** | `server/office-medieval/` | ✅ Production |
| **Medieval v2** | `server/office-medieval-v2/` | 🔄 In progress |
| **SimCity Nature** | `server/office-simcity-nature/` | 🔄 In progress |

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Command palette (Spotlight-style) |
| `X` | New mission |
| `TAB` | Stats & achievements |
| `?` | All keyboard shortcuts |
| `M` | Team meeting |
| `C` | Celebrate |
| `N` | Toggle sound |
| `ESC` | Close any overlay |

## 🚫 Dead Versions (DO NOT USE)

The following directories are **obsolete** and should be deleted if found:

- `fleetkit-v2/` — Old development repo, replaced by `spawnkit/`
- `products/spawnkit-dashboard/` — Old standalone dashboard attempt
- `products/spawnkit-quality-fix/` — Temporary fix attempt
- `spawnkit-fixes/` — One-off fix directory
- `spawnkit-mission-fix/` — One-off mission fix
- `.spawnkit-missions/` — Legacy mission data
- `fleetkit-packages/staging/spawnkit-*` — Old staging themes

**Rule**: If it's not in `spawnkit/`, it's not SpawnKit.

## 📄 License

MIT

## 💜 Powered by [OpenClaw](https://openclaw.ai)

Built with obsession. Every pixel matters.