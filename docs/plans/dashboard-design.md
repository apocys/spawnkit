# Dashboard Design — Unified SpawnKit Dashboard

## Status: ✅ APPROVED (self-approved per task spec)

## Architecture

**Single HTML file** (`dashboard.html`) at project root that:
1. Shows a full-screen theme selector on first visit (or when no theme saved)
2. Loads the chosen theme office inside a 100% viewport `<iframe>`
3. Provides a floating sidebar overlay for agent management
4. Persists theme choice and sidebar state in localStorage

### Why iframe?
- Theme offices (GameBoy, GameBoy Color, Sims) are complete standalone HTML apps with PixiJS canvases, their own scripts, fonts, styles
- iframe gives perfect isolation: no CSS/JS conflicts
- Theme offices don't need any modification
- Sidebar floats on top of everything via z-index

## Component Breakdown

### 1. Theme Selector Screen
- Full viewport dark background with starfield animation
- 3 animated cards: GameBoy 🎮, GameBoy Color 🌈, The Sims 💎
- Each card: emoji (floating animation), name, 2-line description, "Enter Office" button
- Cards animate in with staggered entrance
- JetBrains Mono font, consistent with existing theme-selector.html styling

### 2. Iframe Container
- `<iframe>` at 100% width/height, no border, position fixed
- Loading spinner overlay while iframe loads
- iframe `onload` event hides spinner

### 3. Sidebar Panel (Desktop)
- 300px wide, slides in from left
- Semi-transparent dark background (`rgba(10,10,20,0.92)`) with backdrop-filter blur
- Toggled via floating hamburger button (top-left, 48px, always visible)
- Content: agent list, "Create Agent" button, expandable agent details
- Close button inside sidebar (X)

### 4. Mobile Bottom Sheet (< 768px)
- Sidebar transforms into bottom sheet
- Slides up from bottom, max-height 60vh
- Drag handle at top
- Same content as sidebar

## State Management

| Key | Type | Purpose |
|-----|------|---------|
| `spawnkit-dashboard-theme` | string | Selected theme ID (`gameboy`, `gameboy-color`, `sims`) |
| `spawnkit-dashboard-sidebar` | string | `open` or `closed` |
| `spawnkit-dashboard-visited` | string | `true` — tracks first visit for tooltip overlay |

## UX Flow

1. **First visit** → Theme selector screen + tooltip overlay ("Pick your favorite office style!")
2. **User picks theme** → Loading spinner → iframe loads office → sidebar button appears
3. **Returning visit** → Saved theme auto-loads (skip selector)
4. **Sidebar** → Click hamburger → agent panel slides in
5. **Change theme** → Sidebar has "Switch Theme" button → returns to selector

## Theme iframe Paths

- GameBoy: `./office-gameboy/index.html`
- GameBoy Color: `./office-gameboy-color/index.html`
- The Sims: `./office-sims/index.html`

## Grandma Rules

- All buttons ≥ 44px touch targets
- No jargon in visible text (no "iframe", "localStorage", "API")
- Loading states for everything async
- Tooltips on hover for icon-only buttons
- Clear visual feedback on every interaction
- Error state if iframe fails to load

## Security

- Zero innerHTML with user data (use textContent exclusively)
- No eval, no dynamic script injection
- iframe sandbox: allow-scripts allow-same-origin (needed for PixiJS)
- All user-facing text is static or from textContent

## Target Size

- 400-800 lines total
- Single file, zero external dependencies beyond Google Fonts CDN
