/* medieval-spatial-audio.js — 3D positional audio for the medieval castle */
(function() {
  'use strict';

  var audioListener = null;
  var ambientAudio = null;
  var soundSources = [];
  var isMuted = false;
  var masterVolume = 0.3;

  function init() {
    if (!window.castleApp || !window.THREE) {
      setTimeout(init, 1000);
      return;
    }

    setupAudioSystem();
    createAmbientSounds();
    createBuildingSounds();
    addAudioControls();
  }

  function setupAudioSystem() {
    // Create audio listener and attach to camera
    audioListener = new window.THREE.AudioListener();
    window.castleApp.camera.add(audioListener);

    // Create audio context if needed (user gesture required)
    if (!window.THREE.AudioContext) {
      window.THREE.AudioContext = window.AudioContext || window.webkitAudioContext;
    }

    // Defer audio context creation until user interaction
    document.addEventListener('click', function resumeAudio() {
      if (audioListener && audioListener.context && audioListener.context.state === 'suspended') {
        audioListener.context.resume();
      }
      document.removeEventListener('click', resumeAudio);
    }, { once: true });
  }

  function createAmbientSounds() {
    // Ambient medieval atmosphere
    var audioLoader = new window.THREE.AudioLoader();

    // Create ambient audio (wind, distant activity)
    ambientAudio = new window.THREE.Audio(audioListener);
    
    // Create a simple ambient soundscape with Web Audio API
    if (audioListener.context) {
      createProceduralAmbient();
    }
  }

  function createProceduralAmbient() {
    var context = audioListener.context;
    
    // Low-frequency wind sound
    var windOscillator = context.createOscillator();
    var windGain = context.createGain();
    var windFilter = context.createBiquadFilter();
    
    windOscillator.type = 'sawtooth';
    windOscillator.frequency.setValueAtTime(60, context.currentTime);
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(200, context.currentTime);
    windGain.gain.setValueAtTime(0.05, context.currentTime);
    
    windOscillator.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    
    windOscillator.start();
    
    // Add subtle frequency modulation for natural wind effect
    var lfo = context.createOscillator();
    var lfoGain = context.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.1, context.currentTime);
    lfoGain.gain.setValueAtTime(10, context.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(windOscillator.frequency);
    lfo.start();

    // Store references for cleanup
    soundSources.push({
      type: 'ambient',
      oscillator: windOscillator,
      gain: windGain,
      position: null
    });
  }

  function createBuildingSounds() {
    // Add positional audio to buildings
    var buildings = [
      { name: 'forge', position: { x: 12, y: 2, z: 20 }, sound: 'hammering' },
      { name: 'market', position: { x: 7, y: 2, z: 27 }, sound: 'crowd' },
      { name: 'library', position: { x: 5, y: 2, z: 22 }, sound: 'pages' },
      { name: 'tavern', position: { x: -8, y: 2, z: 25 }, sound: 'chatter' }
    ];

    buildings.forEach(function(building) {
      createBuildingSound(building);
    });
  }

  function createBuildingSound(building) {
    var context = audioListener.context;
    if (!context) return;

    var positionalAudio = new window.THREE.PositionalAudio(audioListener);
    
    // Create procedural sound based on building type
    var soundData = createProceduralSound(building.sound, context);
    if (!soundData) return;

    // Set up positional audio properties
    positionalAudio.setRefDistance(5);
    positionalAudio.setRolloffFactor(2);
    positionalAudio.setDistanceModel('exponential');
    positionalAudio.setVolume(0.4);

    // Create a dummy object to hold the audio at the building position
    var audioObject = new window.THREE.Object3D();
    audioObject.position.set(building.position.x, building.position.y, building.position.z);
    audioObject.add(positionalAudio);
    window.castleApp.scene.add(audioObject);

    soundSources.push({
      type: 'building',
      name: building.name,
      audio: positionalAudio,
      object: audioObject,
      position: building.position,
      soundData: soundData
    });
  }

  function createProceduralSound(soundType, context) {
    switch (soundType) {
      case 'hammering':
        return createHammeringSound(context);
      case 'crowd':
        return createCrowdSound(context);
      case 'pages':
        return createPagesSound(context);
      case 'chatter':
        return createChatterSound(context);
      default:
        return null;
    }
  }

  function createHammeringSound(context) {
    // Rhythmic metallic clanging
    var buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    // Generate hammer strikes every 0.8 seconds
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      var strike = Math.floor(time / 0.8);
      var strikeTime = time % 0.8;
      
      if (strikeTime < 0.05) {
        // Sharp metallic strike
        data[i] = (Math.random() - 0.5) * Math.exp(-strikeTime * 50) * 0.3;
      } else {
        data[i] = 0;
      }
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.2
    };
  }

  function createCrowdSound(context) {
    // Gentle crowd murmur
    var buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      
      // Multiple sine waves for crowd effect
      var crowd = 0;
      crowd += Math.sin(time * 2 * Math.PI * 120) * 0.1;
      crowd += Math.sin(time * 2 * Math.PI * 80) * 0.08;
      crowd += Math.sin(time * 2 * Math.PI * 200) * 0.05;
      
      // Add some noise
      crowd += (Math.random() - 0.5) * 0.02;
      
      // Low-pass filter effect
      data[i] = crowd * (0.5 + 0.5 * Math.sin(time * 0.5));
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.15
    };
  }

  function createPagesSound(context) {
    // Subtle page turning and quill scratching
    var buffer = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      var page = 0;
      
      // Occasional page turn (every 3-5 seconds)
      if (Math.sin(time * 0.2) > 0.9) {
        page = (Math.random() - 0.5) * Math.exp(-(time % 1) * 10) * 0.1;
      }
      
      // Subtle scratching
      page += (Math.random() - 0.5) * 0.005;
      
      data[i] = page;
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.08
    };
  }

  function createChatterSound(context) {
    // Tavern conversation
    var buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      var chatter = 0;
      
      // Multiple conversation frequencies
      chatter += Math.sin(time * 2 * Math.PI * 300) * 0.05 * Math.sin(time * 2);
      chatter += Math.sin(time * 2 * Math.PI * 150) * 0.04 * Math.sin(time * 1.5 + 1);
      chatter += Math.sin(time * 2 * Math.PI * 400) * 0.03 * Math.sin(time * 3 + 2);
      
      // Random noise for realistic effect
      chatter += (Math.random() - 0.5) * 0.02;
      
      data[i] = chatter;
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.12
    };
  }

  function addAudioControls() {
    // Add mute toggle button to UI
    var audioToggle = document.createElement('div');
    audioToggle.id = 'audio-toggle';
    audioToggle.style.cssText = `
      position: absolute;
      top: 10px;
      right: 16px;
      z-index: 10;
      background: rgba(20, 12, 5, 0.7);
      border: 1px solid var(--castle-gold);
      border-radius: 4px;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
      backdrop-filter: blur(4px);
    `;
    
    updateAudioToggle();
    
    audioToggle.addEventListener('click', toggleAudio);
    audioToggle.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1)';
    });
    audioToggle.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
    });

    // Add to castle sidebar instead of body
    var sidebar = document.querySelector('.castle-sidebar');
    if (sidebar) {
      sidebar.style.position = 'relative';
      sidebar.appendChild(audioToggle);
    } else {
      document.body.appendChild(audioToggle);
    }

    function updateAudioToggle() {
      audioToggle.textContent = isMuted ? '🔇' : '🔊';
      audioToggle.title = isMuted ? 'Unmute audio' : 'Mute audio';
    }

    function toggleAudio() {
      isMuted = !isMuted;
      setMasterVolume(isMuted ? 0 : masterVolume);
      updateAudioToggle();
      
      if (window.showToast) {
        window.showToast(isMuted ? 'Audio muted' : 'Audio enabled', 'info');
      }
    }
  }

  function setMasterVolume(volume) {
    if (audioListener && audioListener.context) {
      audioListener.setMasterVolume(volume);
    }

    // Update individual sound sources
    soundSources.forEach(function(source) {
      if (source.gain) {
        source.gain.gain.setValueAtTime(volume * (source.baseVolume || 0.3), 
                                       audioListener.context.currentTime);
      }
      if (source.audio) {
        source.audio.setVolume(volume * (source.soundData?.volume || 0.2));
      }
    });
  }

  function addAgentSounds(agentData) {
    // Add sounds when agents become active
    if (!agentData || !agentData.position) return;

    var agentSound = new window.THREE.PositionalAudio(audioListener);
    
    // Different sounds based on agent activity
    var soundType = 'thinking'; // default
    if (agentData.action === 'coding') soundType = 'typing';
    else if (agentData.action === 'communicating') soundType = 'talking';
    
    // Create appropriate sound
    var context = audioListener.context;
    var soundData = createAgentSound(soundType, context);
    
    if (soundData && agentData.object) {
      agentData.object.add(agentSound);
      
      soundSources.push({
        type: 'agent',
        agentId: agentData.id,
        audio: agentSound,
        soundData: soundData
      });
    }
  }

  function createAgentSound(soundType, context) {
    switch (soundType) {
      case 'typing':
        return createTypingSound(context);
      case 'talking':
        return createTalkingSound(context);
      case 'thinking':
        return createThinkingSound(context);
      default:
        return null;
    }
  }

  function createTypingSound(context) {
    // Rapid keyboard clicking
    var buffer = context.createBuffer(1, context.sampleRate * 1, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      var typing = 0;
      
      // Random key presses
      if (Math.random() < 0.08) {
        typing = (Math.random() - 0.5) * Math.exp(-((i % 1000) / 1000) * 20) * 0.1;
      }
      
      data[i] = typing;
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.1
    };
  }

  function createTalkingSound(context) {
    // Soft voice-like modulation
    var buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      var voice = Math.sin(time * 2 * Math.PI * 200) * 0.05 * Math.sin(time * 5);
      data[i] = voice;
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.08
    };
  }

  function createThinkingSound(context) {
    // Very subtle ambient hum
    var buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    var data = buffer.getChannelData(0);
    
    for (var i = 0; i < data.length; i++) {
      var time = i / context.sampleRate;
      var thinking = Math.sin(time * 2 * Math.PI * 100) * 0.02 * Math.sin(time * 0.5);
      data[i] = thinking;
    }

    return {
      buffer: buffer,
      loop: true,
      volume: 0.05
    };
  }

  // Cleanup function
  function cleanup() {
    soundSources.forEach(function(source) {
      if (source.oscillator) {
        try { source.oscillator.stop(); } catch(e) {}
      }
      if (source.audio) {
        source.audio.stop();
      }
    });
    soundSources = [];
  }

  // Handle page unload
  window.addEventListener('beforeunload', cleanup);

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 2000); // Wait for Three.js and castle to be ready
  }

  // Export for other modules
  window.SpatialAudio = {
    addAgentSounds: addAgentSounds,
    setMasterVolume: setMasterVolume,
    isMuted: function() { return isMuted; },
    toggleAudio: function() { toggleAudio(); }
  };
})();