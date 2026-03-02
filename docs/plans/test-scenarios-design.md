# SpawnKit Dashboard — E2E Scenario Test Design

> **Version:** 1.0  
> **Date:** 2026-02-20  
> **Author:** Forge (CTO Agent)  
> **Status:** Active

---

## 1. Test Philosophy

SpawnKit must pass the **Grandma Test**: a non-technical 68-year-old should be able to open the page, pick a theme, and understand what she's looking at — with zero confusion, zero errors, zero broken states.

All tests run in-browser (vanilla JS, no dependencies). Tests are independently runnable, grouped by scenario, and produce clear pass/fail/skip output.

---

## 2. Test Personas

### 👵 Grandma Marie (68, retired teacher)
- **Device:** iPad Air, Safari
- **Mental model:** "I click things and they should work"
- **Expectations:** Big clear buttons, no jargon, visual feedback for every action
- **Journey:** First visit → sees welcome tooltip → reads it → clicks "Got it!" → picks a theme card → sees office load → notices hamburger menu → opens sidebar → sees agents → clicks one → reads detail → closes sidebar

### ✍️ Newsletter Creator Sarah (32, solopreneur)
- **Device:** MacBook Pro, Chrome
- **Mental model:** "I want to manage my AI team efficiently"
- **Expectations:** Theme switching works fast, keyboard shortcuts, agent XP tracking
- **Journey:** Returns (has saved theme) → auto-loads office → opens sidebar via Tab → reviews agents → creates new agent → assigns mission → completes mission → checks XP/level → switches to different theme → data persists

### 📋 Agency PM Marcus (45, manages 15-person team)
- **Device:** Windows laptop + external monitor, Edge; also iPhone 14
- **Mental model:** "I'll stress-test this before recommending it"
- **Expectations:** Handles rapid actions, responsive on mobile, keyboard accessible
- **Journey:** Rapid theme cycling (1→2→3→1) → resize to mobile → resize back → keyboard shortcut navigation → open/close sidebar rapidly → check all states survive

---

## 3. User Journey Test Scenarios

### 3.1 Grandma Marie's First Visit
| # | Step | Expected |
|---|------|----------|
| M1 | Page loads fresh (no localStorage) | Theme selector visible, cards animate in |
| M2 | Welcome tooltip appears | Overlay with "Welcome to SpawnKit!" text |
| M3 | Click "Got it!" | Tooltip disappears, localStorage visited=true |
| M4 | Click GameBoy card | Loading overlay shows, then office iframe loads |
| M5 | Office loaded | Loading overlay gone, iframe visible, menu button visible |
| M6 | Click hamburger menu | Sidebar opens, backdrop visible |
| M7 | See agents listed | 5 agents rendered with emoji, name, role, level bar |
| M8 | Click agent "Nova" | Detail section expands with description |
| M9 | Click another agent "Cipher" | Nova collapses, Cipher expands |
| M10 | Click close (×) | Sidebar closes, backdrop hidden |

### 3.2 Sarah's Returning Power User
| # | Step | Expected |
|---|------|----------|
| S1 | Page loads with saved theme | Goes directly to office (no selector) |
| S2 | Press Tab key | Sidebar opens |
| S3 | Click "Create Agent" | Shows "Coming soon!" feedback |
| S4 | Dashboard API: addAgent({name:'Writer'}) | Agent added, count increases |
| S5 | Dashboard API: createMission({title:'Draft newsletter', assignee: agentId}) | Mission created with active status |
| S6 | Dashboard API: completeMission(missionId) | Mission done, XP awarded to assignee |
| S7 | Check agent level progress | XP reflects reward, level calculated correctly |
| S8 | Click "Switch Office Style" | Returns to theme selector, frame cleared |
| S9 | Pick new theme | New theme loads, all agent data persists |
| S10 | Reload page | New theme auto-loads, agents + missions still there |

### 3.3 Marcus's Stress Testing
| # | Step | Expected |
|---|------|----------|
| X1 | Rapid theme selection (1,2,3,1,2,3) | No crash, final theme loads correctly |
| X2 | Open/close sidebar 10x rapidly | No state corruption, final state correct |
| X3 | Press all keyboard shortcuts | Each fires correct action, no overlap |
| X4 | Viewport 320px wide | Cards stack vertically, sidebar is bottom sheet |
| X5 | Viewport 768px | Responsive breakpoints work |
| X6 | All interactive elements ≥48px | Touch targets meet mobile guidelines |
| X7 | Tab through all focusable elements | Focus order is logical, focus visible |
| X8 | Escape closes any open overlay | Help, sidebar, tooltip all close on Esc |

---

## 4. Edge Case Scenarios

| ID | Case | Expected Behavior |
|----|------|-------------------|
| E1 | localStorage corrupted (invalid JSON) | Graceful fallback to defaults |
| E2 | localStorage quota exceeded | Fails silently, app still works |
| E3 | Iframe fails to load (404) | Loading overlay times out after 8s, menu still shows |
| E4 | XSS in agent name (`<script>alert(1)</script>`) | Sanitized via textContent, no execution |
| E5 | Agent limit reached (20 agents) | addAgent returns null, no crash |
| E6 | Mission limit reached (100 missions) | createMission returns null |
| E7 | Create/delete 100 agents | Memory stable, no leaks |
| E8 | Invalid theme ID | selectTheme returns false, no state change |
| E9 | Double init() call | Returns existing state, no side effects |
| E10 | Negative/NaN XP | awardXP returns null, no state corruption |

---

## 5. Mobile Scenarios

| ID | Viewport | Test |
|----|----------|------|
| R1 | 320×568 (iPhone SE) | Cards stack, all readable, no horizontal scroll |
| R2 | 375×812 (iPhone X) | Cards fit, sidebar is bottom sheet |
| R3 | 768×1024 (iPad) | Cards wrap nicely, sidebar slides from left |
| R4 | 1440×900 (Laptop) | 3 cards side by side |

---

## 6. Accessibility Checks

| ID | Check | Criteria |
|----|-------|----------|
| A1 | Theme cards have role="button" + aria-label | Each card is keyboard-accessible |
| A2 | Agent items have role="button" + aria-label | Expandable via Enter/Space |
| A3 | Focus visible on all interactive elements | Outline or equivalent visible |
| A4 | Sidebar close button has aria-label | Screen reader announces "Close menu" |
| A5 | Menu button has aria-label | Announces "Open menu" |
| A6 | Loading overlay has text label | Screen readers can read loading state |
| A7 | No keyboard traps | Tab cycles naturally, Escape exits modals |
| A8 | Color contrast meets WCAG AA | Text readable against backgrounds |

---

## 7. Performance Criteria

| Metric | Target | Method |
|--------|--------|--------|
| Initial load (selector) | < 3s | performance.now() on DOMContentLoaded |
| Theme switch (click → office visible) | < 1s (excl. iframe) | Timestamp diff |
| Sidebar open/close animation | < 400ms | CSS transition duration |
| Card entrance animation | < 1s total | 3 cards × 150ms stagger |
| Memory after 100 agent create/delete | < 50MB heap | performance.memory (Chrome) |
| Zero console errors | 0 | window.onerror + console.error intercept |

---

## 8. Test Infrastructure

### Runner
- Vanilla JS, zero dependencies
- Runs via `<script src="test/scenario-tests.js"></script>`
- Also available as dedicated test page: `test/index.html`
- Console output with emoji indicators (✅ ❌ ⏭️)

### Test Structure
```js
scenario('Grandma Marie - First Visit', [
  test('M1: Selector visible on fresh load', async () => { ... }),
  test('M2: Welcome tooltip appears', async () => { ... }),
  ...
]);
```

### Assertions
- `assert(condition, message)` — basic truthiness
- `assertEqual(actual, expected, message)` — strict equality  
- `assertExists(selector, message)` — DOM element exists
- `assertVisible(element, message)` — element is visible
- `assertNotNull(value, message)` — value is not null/undefined

---

## 9. Test Execution Modes

1. **Console mode**: Include script in page, tests auto-run, results in console
2. **Visual mode**: Open `test/index.html`, see green/red results with counts
3. **Headless mode**: Can be driven by Playwright/Puppeteer for CI

---

## 10. Coverage Summary

| Category | Count |
|----------|-------|
| Persona journeys | 3 (28 steps) |
| Edge cases | 10 |
| Mobile scenarios | 4 |
| Accessibility checks | 8 |
| Performance criteria | 6 |
| **Total test scenarios** | **56+** |
