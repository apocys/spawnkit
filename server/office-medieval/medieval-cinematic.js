/**
 * medieval-cinematic.js — Cinematic camera tour after onboarding
 * Flies through castle buildings with RPG narration captions
 */
(function() {
  'use strict';

  // Only run after onboarding just completed (flag set by onboarding.js)
  // We listen for the overlay removal, then start the tour
  var TOUR_KEY = 'spawnkit-tour-done';
  if (localStorage.getItem(TOUR_KEY) === 'true') return;

  var WAYPOINTS = [
    { x: 0, y: 25, z: 35, lookX: 0, lookY: 2, lookZ: 0, caption: '🏰 Welcome to your castle', sub: 'Your AI agents live and work here', duration: 3000 },
    { x: -5, y: 15, z: 28, lookX: -5, lookY: 2, lookZ: 24, caption: '⚔️ The Mission Hall', sub: 'Click to assign quests to your knights', duration: 3000 },
    { x: 12, y: 12, z: 24, lookX: 12, lookY: 2, lookZ: 20, caption: '🔨 The Forge Workshop', sub: 'Where code is forged into tools', duration: 2500 },
    { x: 5, y: 12, z: 26, lookX: 5, lookY: 2, lookZ: 22, caption: '📚 The Library', sub: 'Knowledge and documentation live here', duration: 2500 },
    { x: 7, y: 12, z: 31, lookX: 7, lookY: 2, lookZ: 27, caption: '🏪 The Market', sub: 'Browse and install new skills', duration: 2500 },
    { x: 0, y: 20, z: 10, lookX: 0, lookY: 2, lookZ: 0, caption: '🏰 Your realm awaits', sub: 'Click any building or agent to begin', duration: 3000 },
  ];

  var overlay = null;
  var captionEl = null;
  var subEl = null;
  var progressBar = null;
  var isActive = false;
  var skipBtn = null;

  function createUI() {
    overlay = document.createElement('div');
    overlay.id = 'cinematic-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;pointer-events:none;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:120px;';

    // Letterbox bars for cinematic feel
    var topBar = document.createElement('div');
    topBar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:60px;background:linear-gradient(180deg,rgba(0,0,0,0.7),transparent);z-index:501;transition:height 0.5s ease;';
    topBar.id = 'cinematic-top-bar';
    overlay.appendChild(topBar);

    var bottomBar = document.createElement('div');
    bottomBar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:100px;background:linear-gradient(0deg,rgba(0,0,0,0.7),transparent);z-index:501;transition:height 0.5s ease;';
    bottomBar.id = 'cinematic-bottom-bar';
    overlay.appendChild(bottomBar);

    // Caption area
    var captionWrap = document.createElement('div');
    captionWrap.style.cssText = 'position:relative;z-index:502;text-align:center;pointer-events:all;';

    captionEl = document.createElement('div');
    captionEl.style.cssText = 'font-family:"Cinzel","Crimson Text",serif;font-size:clamp(20px,3vw,28px);font-weight:600;color:#F5E6D0;text-shadow:0 2px 12px rgba(0,0,0,0.6);opacity:0;transform:translateY(10px);transition:all 0.6s ease;letter-spacing:0.5px;';
    captionWrap.appendChild(captionEl);

    subEl = document.createElement('div');
    subEl.style.cssText = 'font-family:"Crimson Text",serif;font-size:14px;color:rgba(245,230,208,0.6);margin-top:6px;opacity:0;transform:translateY(10px);transition:all 0.6s ease 0.2s;';
    captionWrap.appendChild(subEl);

    overlay.appendChild(captionWrap);

    // Progress bar
    progressBar = document.createElement('div');
    progressBar.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:502;display:flex;gap:6px;';
    for (var i = 0; i < WAYPOINTS.length; i++) {
      var dot = document.createElement('div');
      dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:rgba(245,230,208,0.2);transition:background 0.3s ease;';
      progressBar.appendChild(dot);
    }
    overlay.appendChild(progressBar);

    // Skip button
    skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip Tour →';
    skipBtn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:503;pointer-events:all;padding:8px 16px;border-radius:6px;border:1px solid rgba(245,230,208,0.2);background:rgba(0,0,0,0.4);color:rgba(245,230,208,0.7);font-family:"Crimson Text",serif;font-size:13px;cursor:pointer;transition:all 0.2s;backdrop-filter:blur(4px);';
    skipBtn.addEventListener('mouseenter', function() { skipBtn.style.borderColor = 'rgba(245,230,208,0.5)'; skipBtn.style.color = '#F5E6D0'; });
    skipBtn.addEventListener('mouseleave', function() { skipBtn.style.borderColor = 'rgba(245,230,208,0.2)'; skipBtn.style.color = 'rgba(245,230,208,0.7)'; });
    skipBtn.addEventListener('click', function() { endTour(); });
    overlay.appendChild(skipBtn);

    document.body.appendChild(overlay);
  }

  function showCaption(text, sub, idx) {
    captionEl.style.opacity = '0';
    captionEl.style.transform = 'translateY(10px)';
    subEl.style.opacity = '0';
    subEl.style.transform = 'translateY(10px)';

    setTimeout(function() {
      captionEl.textContent = text;
      subEl.textContent = sub;
      captionEl.style.opacity = '1';
      captionEl.style.transform = 'translateY(0)';
      subEl.style.opacity = '1';
      subEl.style.transform = 'translateY(0)';
    }, 200);

    // Update progress dots
    var dots = progressBar.children;
    for (var i = 0; i < dots.length; i++) {
      dots[i].style.background = i <= idx ? 'rgba(245,230,208,0.8)' : 'rgba(245,230,208,0.2)';
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animateCamera(app, from, to, duration, onComplete) {
    var startTime = performance.now();
    var startPos = { x: from.x, y: from.y, z: from.z };
    var startLook = { x: from.lookX, y: from.lookY, z: from.lookZ };
    var endPos = { x: to.x, y: to.y, z: to.z };
    var endLook = { x: to.lookX, y: to.lookY, z: to.lookZ };

    function tick() {
      if (!isActive) return;
      var elapsed = performance.now() - startTime;
      var t = Math.min(elapsed / duration, 1);
      var e = easeInOutCubic(t);

      app.camera.position.set(
        startPos.x + (endPos.x - startPos.x) * e,
        startPos.y + (endPos.y - startPos.y) * e,
        startPos.z + (endPos.z - startPos.z) * e
      );

      var lx = startLook.x + (endLook.x - startLook.x) * e;
      var ly = startLook.y + (endLook.y - startLook.y) * e;
      var lz = startLook.z + (endLook.z - startLook.z) * e;
      app.camera.lookAt(lx, ly, lz);
      app.camera.updateProjectionMatrix();

      if (t < 1) {
        requestAnimationFrame(tick);
      } else if (onComplete) {
        onComplete();
      }
    }
    requestAnimationFrame(tick);
  }

  function startTour() {
    var app = window.castleApp;
    if (!app || !app.camera) {
      // Castle not loaded yet, wait
      setTimeout(startTour, 500);
      return;
    }

    isActive = true;
    createUI();

    // Disable orbit controls during tour
    if (app.controls) app.controls.enabled = false;

    // Save original camera position
    var origPos = app.camera.position.clone();

    // Start from current position
    var currentWP = {
      x: app.camera.position.x, y: app.camera.position.y, z: app.camera.position.z,
      lookX: 0, lookY: 2, lookZ: 0
    };

    var waypointIdx = 0;

    function nextWaypoint() {
      if (!isActive || waypointIdx >= WAYPOINTS.length) {
        endTour();
        return;
      }

      var wp = WAYPOINTS[waypointIdx];
      showCaption(wp.caption, wp.sub, waypointIdx);

      var from = waypointIdx === 0 ? currentWP : WAYPOINTS[waypointIdx - 1];
      animateCamera(app, from, wp, 1500, function() {
        // Hold at waypoint
        setTimeout(function() {
          waypointIdx++;
          // Fade out caption before moving
          captionEl.style.opacity = '0';
          subEl.style.opacity = '0';
          setTimeout(function() { nextWaypoint(); }, 400);
        }, wp.duration);
      });
    }

    nextWaypoint();
  }

  function endTour() {
    isActive = false;
    localStorage.setItem(TOUR_KEY, 'true');

    var app = window.castleApp;
    if (app && app.controls) app.controls.enabled = true;

    // Restore camera to default overview
    if (app && app.camera) {
      app.camera.position.set(0, 35, 45);
      app.camera.lookAt(0, 2, 0);
      app.camera.updateProjectionMatrix();
    }

    // Fade out overlay
    if (overlay) {
      overlay.style.transition = 'opacity 0.8s ease';
      overlay.style.opacity = '0';
      setTimeout(function() { overlay.remove(); }, 800);
    }

    // Show toast welcoming the user
    if (window.showToast) window.showToast('Welcome to your castle! Click any building to explore.', 'success');
  }

  // ── Listen for onboarding completion ──────────────────────
  // The onboarding.js sets localStorage and removes its overlay
  // We poll briefly to detect when it's done
  function waitForOnboarding() {
    if (localStorage.getItem('spawnkit-onboarded-medieval') !== 'true') {
      setTimeout(waitForOnboarding, 500);
      return;
    }
    // Small delay after overlay removal for castle to be visible
    setTimeout(startTour, 1500);
  }

  // Only start waiting if we haven't done the tour yet
  if (localStorage.getItem(TOUR_KEY) !== 'true') {
    waitForOnboarding();
  }
})();
