# Ralph Loop — E2E Scenario Tests

> **Task:** Create comprehensive E2E scenario tests for SpawnKit dashboard  
> **Started:** 2026-02-20 00:39  
> **Status:** ✅ COMPLETE

---

## Iteration 1: Core Test Framework ✅
- [x] Test runner with pass/fail/skip
- [x] Scenario grouping via `scenario()` and `test()` functions
- [x] Assertion helpers: assert, assertEqual, assertExists, assertVisible, assertHidden, assertContains, assertGreaterThan, assertNotNull, assertNull, assertTrue, assertFalse
- [x] Console output with emoji (✅ ❌ ⏭️) and color formatting
- [x] Visual report for test/index.html
- [x] Auto-run detection (runs automatically when loaded in test runner)
- [x] DOM helpers: $(), $$(), click(), pressKey(), wait()
- [x] State helpers: clearState(), getDashboard(), reloadFrame()
- [x] Console error interceptor for zero-error testing

## Iteration 2: Persona Scenarios ✅
- [x] **Grandma Marie (11 tests: M1–M11)**
  - M1: Selector visible on fresh load
  - M2: Welcome tooltip for first visitor
  - M3: Dismiss tooltip sets visited flag
  - M4: Click card shows loading overlay
  - M5: Office iframe becomes visible
  - M6: Menu button visible after load
  - M7: Menu button opens sidebar
  - M8: 5 agents rendered
  - M9: Click agent expands detail
  - M10: Click second agent collapses first
  - M11: Close sidebar via × button
- [x] **Sarah Power User (10 tests: S1–S10)**
  - S1: Saved theme auto-loads
  - S2: Tab key toggles sidebar
  - S3: Create Agent feedback
  - S4: API addAgent
  - S5: API createMission + completeMission
  - S6: XP level calculation
  - S7: Level up event emission
  - S8: Switch theme returns to selector
  - S9: Agent data persists across switch
  - S10: State survives save/load cycle
- [x] **Marcus Stress (9 tests: X1–X9)**
  - X1: Rapid theme cycling
  - X2: Rapid sidebar toggle 10x
  - X3: ? opens help
  - X4: Escape closes help
  - X5: Number keys select themes
  - X6: Cards ≥48px touch targets
  - X7: Buttons ≥44px minimum
  - X8: Escape closes sidebar
  - X9: Backdrop click closes sidebar

## Iteration 3: Edge Case Tests ✅
- [x] E1: Corrupt localStorage (invalid JSON)
- [x] E2: Wrong type in localStorage
- [x] E3: Iframe load timeout mechanism
- [x] E4: XSS in agent name sanitized
- [x] E5: Agent limit (20 max)
- [x] E6: Invalid theme ID rejected
- [x] E7: Double init() safe
- [x] E8: Negative/NaN XP rejected
- [x] E9: Remove nonexistent agent
- [x] E10: Create/delete 50 agents stress test

## Iteration 4: Integration + Accessibility + Performance Tests ✅
- [x] **Integration (10 tests: I1–I10)**
  - I1: Iframe src matches theme path
  - I2: Sidebar state persists in localStorage
  - I3: Mission stats show correct agent count
  - I4: Agent level bars correct widths
  - I5: Exactly 3 theme cards
  - I6: Loading label theme-specific message
  - I7: Card entrance animation
  - I8: Event system works (on/off/emit)
  - I9: Full state snapshot structure
  - I10: switchTheme rejects same theme
- [x] **Accessibility (8 tests: A1–A8)**
  - A1: Cards have role=button + aria-label
  - A2: Agent items have role=button + aria-label
  - A3: Cards are keyboard focusable
  - A4: Menu button has aria-label
  - A5: Close button has aria-label
  - A6: Iframe has title attribute
  - A7: HTML lang attribute set
  - A8: Enter/Space activates card
- [x] **Performance (4 tests: P1–P4)**
  - P1: Cards animate within 1s
  - P2: Theme selection < 1s
  - P3: Agent rendering < 100ms
  - P4: Zero console errors

## Iteration 5: Self-Review & Gap-Fill ✅
- [x] G1: SPAWNKIT logo text
- [x] G2: Footer mentions SpawnKit
- [x] G3: Help overlay lists all shortcuts
- [x] G4: Card previews have themed backgrounds
- [x] G5: Mission stats render 3 stat cards
- [x] G6: Mission creation structure
- [x] G7: getAgent returns null for missing
- [x] G8: updateAgent partial patch
- [x] G9: toggleSidebar returns new state
- [x] G10: Name truncation at 64 chars
- [x] G11: Complete nonexistent mission
- [x] G12: destroy + re-init

---

## Summary

| Category | Tests |
|----------|-------|
| Grandma Marie (First Visit) | 11 |
| Sarah (Power User) | 10 |
| Marcus (Stress Testing) | 9 |
| Edge Cases | 10 |
| Integration | 10 |
| Accessibility | 8 |
| Performance | 4 |
| Gap-Fill & Regression | 12 |
| **TOTAL** | **74** |

## Files Created
- `docs/plans/test-scenarios-design.md` — Test design document
- `test/scenario-tests.js` — 74 scenario tests (47KB)
- `test/index.html` — Visual test runner with iframe preview
- `docs/ralph-loop-tests.md` — This progress tracker

## How to Run
1. **Visual runner:** Open `test/index.html` in browser → tests auto-run
2. **Manual re-run:** Click "▶ Run All Tests" button
3. **Console:** Open `dashboard.html`, include `<script src="test/scenario-tests.js"></script>`, then `SpawnKitTests.run()`
4. **Single test:** `SpawnKitTests.run('M1')`
5. **Single scenario:** `SpawnKitTests.runScenario(0)` (index-based)
