(function () {
  'use strict';
  var ctx = null, started = false, masterGain = null;

  function isMuted() { var a = window.castleApp; return a && a.soundEnabled === false; }

  // Public API — called by hotbar mute toggle
  window.castleAudio = {
    isMuted: isMuted,
    setMuted: function(muted) {
      if (window.castleApp) window.castleApp.soundEnabled = !muted;
      if (masterGain && ctx) masterGain.gain.setTargetAtTime(muted ? 0 : 0.3, ctx.currentTime, 0.3);
    },
    toggle: function() { window.castleAudio.setMuted(!isMuted()); },
  };

  function sunAngle() {
    var a = window.castleApp;
    if (!a || !a.clock) return 0;
    return (a.clock.getElapsedTime() % 3600) / 3600 * Math.PI * 2 - Math.PI / 2;
  }
  function isNight() { return Math.sin(sunAngle()) < -0.1; }
  function dayVol() { return Math.max(0, Math.sin(sunAngle())); }

  function brownNoise(dest) {
    var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = buf.getChannelData(0), b = 0;
    for (var i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
    var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start();
  }

  function whiteNoise(dest) {
    var buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start();
  }

  function startBirds(master) {
    function chirp() {
      if (!isMuted()) {
        var vol = isNight() ? 0 : dayVol() * 0.18;
        if (vol > 0.01) {
          var pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1;
          var g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
          g.connect(pan); pan.connect(master);
          var o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(800, ctx.currentTime);
          o.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.1);
          o.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
          o.connect(g); o.start(); o.stop(ctx.currentTime + 0.22);
        }
      }
      setTimeout(chirp, 2000 + Math.random() * 4000);
    }
    chirp();
  }

  function startRiver(master) {
    var g = ctx.createGain(); g.gain.value = 0.04;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    brownNoise(lp); lp.connect(g); g.connect(master);
    setInterval(function () {
      if (!isMuted()) g.gain.setTargetAtTime(0.03 + Math.random() * 0.02, ctx.currentTime, 2);
    }, 3000);
  }

  function startFireCrackle(master) {
    function crackle() {
      if (!isMuted()) {
        var dur = 0.015 + Math.random() * 0.025;
        var g = ctx.createGain(); g.gain.setValueAtTime(0.005, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 2200 + Math.random() * 600; bp.Q.value = 1.5;
        // Extra low-pass to soften harshness
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
        whiteNoise(bp); bp.connect(lp); lp.connect(g); g.connect(master);
      }
      setTimeout(crackle, 200 + Math.random() * 800);
    }
    crackle();
  }

  function startWind(master) {
    var g = ctx.createGain(); g.gain.value = 0.02;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    whiteNoise(lp); lp.connect(g); g.connect(master);
    var phase = 0;
    setInterval(function () {
      phase += 0.1;
      if (!isMuted()) g.gain.setTargetAtTime(0.01 + 0.03 * (0.5 + 0.5 * Math.sin(phase)), ctx.currentTime, 1);
    }, 1000);
  }

  function startCrickets(master) {
    function chirp() {
      if (!isMuted() && isNight()) {
        var g = ctx.createGain(); g.gain.setValueAtTime(0.015, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05); g.connect(master);
        var o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = 4000 + Math.random() * 1000;
        o.connect(g); o.start(); o.stop(ctx.currentTime + 0.05);
      }
      setTimeout(chirp, 200 + Math.random() * 600);
    }
    chirp();
  }

  // ── Castle Ambiance — layered medieval soundscape ──────────
  function startCastleAmbiance(master) {
    // Reverb simulation via delay+feedback
    function makeReverb(wet) {
      var delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.25;
      var feedback = ctx.createGain(); feedback.gain.value = 0.35;
      var dryGain = ctx.createGain(); dryGain.gain.value = 1 - wet;
      var wetGain = ctx.createGain(); wetGain.gain.value = wet;
      delay.connect(feedback); feedback.connect(delay);
      delay.connect(wetGain);
      var merger = ctx.createGain();
      dryGain.connect(merger); wetGain.connect(merger);
      return { input: dryGain, delayInput: delay, output: merger };
    }

    // ── Layer 1: Deep drone (Phrygian E) ─────────────────────
    var droneGain = ctx.createGain(); droneGain.gain.value = 0.05;
    droneGain.connect(master);
    [41.20, 61.74, 82.41].forEach(function(freq, i) { // E1, B1, E2
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      // Slight detune for warmth
      o.detune.value = (i - 1) * 8;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120 + i * 40;
      var g = ctx.createGain(); g.gain.value = [1, 0.6, 0.4][i];
      o.connect(lp); lp.connect(g); g.connect(droneGain); o.start();
    });

    // ── Layer 2: Lute-like plucks (Mixolydian G) ─────────────
    var luteScaleDay   = [196.0, 220.0, 246.9, 261.6, 293.7, 329.6, 349.2, 392.0]; // G Mixolydian
    var luteScaleNight = [130.8, 146.8, 155.6, 174.6, 196.0, 207.7, 233.1, 261.6]; // C Aeolian low
    var rev = makeReverb(0.4); rev.output.connect(master);

    function pluckNote() {
      if (isMuted()) { setTimeout(pluckNote, 3000); return; }
      var scale = isNight() ? luteScaleNight : luteScaleDay;
      var freq = scale[Math.floor(Math.random() * scale.length)];
      var t = ctx.currentTime;
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      o.connect(g); g.connect(rev.input); o.start(t); o.stop(t + 1.85);
      // Harmonic overtone
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.05, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o2.connect(g2); g2.connect(rev.input); o2.start(t); o2.stop(t + 0.95);
      var nextMs = isNight() ? 6000 + Math.random() * 8000 : 2500 + Math.random() * 4000;
      setTimeout(pluckNote, nextMs);
    }
    setTimeout(pluckNote, 1500);

    // ── Layer 3: Tavern murmur (day only) ────────────────────
    function startTavernMurmur() {
      var murmurGain = ctx.createGain(); murmurGain.gain.value = 0;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.8;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      var buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      var d = buf.getChannelData(0), b = 0;
      for (var i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
      var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      s.connect(bp); bp.connect(lp); lp.connect(murmurGain); murmurGain.connect(master);
      s.start();
      // Swell in/out randomly (like crowd noise in background)
      function swellMurmur() {
        if (!isMuted()) {
          var vol = isNight() ? 0 : (0.015 + Math.random() * 0.02);
          murmurGain.gain.setTargetAtTime(vol, ctx.currentTime, 2);
        }
        setTimeout(swellMurmur, 3000 + Math.random() * 4000);
      }
      swellMurmur();
    }
    startTavernMurmur();

    // ── Layer 4: Distant horn calls ───────────────────────────
    function playHorn() {
      if (isMuted()) { setTimeout(playHorn, 20000 + Math.random() * 30000); return; }
      var t = ctx.currentTime;
      var hornFreqs = [196.0, 220.0, 164.8]; // G, A, E
      var freq = hornFreqs[Math.floor(Math.random() * hornFreqs.length)];
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.3);
      g.gain.setValueAtTime(0.07, t + 1.2);
      g.gain.linearRampToValueAtTime(0, t + 2.0);
      var pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 1.4;
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      o.connect(lp); lp.connect(g); g.connect(pan); pan.connect(master);
      o.start(t); o.stop(t + 2.1);
      // Echo
      setTimeout(function() {
        if (isMuted()) return;
        var g2 = ctx.createGain(); g2.gain.value = 0.03;
        var o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq;
        var lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 600;
        var pan2 = ctx.createStereoPanner(); pan2.pan.value = -pan.pan.value;
        o2.connect(lp2); lp2.connect(g2); g2.connect(pan2); pan2.connect(master);
        var t2 = ctx.currentTime;
        g2.gain.setValueAtTime(0, t2);
        g2.gain.linearRampToValueAtTime(0.03, t2 + 0.2);
        g2.gain.linearRampToValueAtTime(0, t2 + 1.2);
        o2.start(t2); o2.stop(t2 + 1.3);
      }, 600);
      setTimeout(playHorn, 20000 + Math.random() * 40000);
    }
    setTimeout(playHorn, 8000 + Math.random() * 12000);

    // ── Layer 5: Bell tolls (every ~3 min) ───────────────────
    function playBell() {
      if (!isMuted()) {
        var t = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach(function(freq, i) {
          var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0, t + i * 0.12);
          g.gain.linearRampToValueAtTime(0.06 - i * 0.015, t + i * 0.12 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 4);
          o.connect(g); g.connect(master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 4.1);
        });
      }
      setTimeout(playBell, 120000 + Math.random() * 60000);
    }
    setTimeout(playBell, 15000);

    // ── Master day/night volume swell ─────────────────────────
    setInterval(function() {
      if (!isMuted()) droneGain.gain.setTargetAtTime(isNight() ? 0.08 : 0.04, ctx.currentTime, 3);
    }, 5000);
  }

  function initAudio() {
    if (started) return; started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.3; masterGain.connect(ctx.destination);
    startBirds(masterGain); startRiver(masterGain); startFireCrackle(masterGain);
    startWind(masterGain); startCrickets(masterGain); startCastleAmbiance(masterGain);
    // Sync initial mute state
    if (isMuted()) masterGain.gain.value = 0;
  }

  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('keydown', initAudio, { once: true });
})();
