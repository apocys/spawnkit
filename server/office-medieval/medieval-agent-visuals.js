/* medieval-agent-visuals.js — Agent personality reflected in 3D visuals */
(function() {
  'use strict';

  var agentPersonalities = {};
  var particleSystems = {};

  function init() {
    if (!window.castleApp || !window.THREE) {
      setTimeout(init, 1000);
      return;
    }

    setupPersonalities();
    enhanceExistingAgents();
    
    // Listen for agent updates to refresh visuals
    if (window.castleApp.gameEngine) {
      var originalUpdateAgents = window.castleApp.gameEngine.updateAgents;
      if (originalUpdateAgents) {
        window.castleApp.gameEngine.updateAgents = function(data) {
          originalUpdateAgents.call(this, data);
          updateAgentVisuals(data);
        };
      }
    }
  }

  function setupPersonalities() {
    agentPersonalities = {
      sycopa: {
        type: 'commander',
        color: 0x3366cc,
        geometry: 'crown',
        particles: 'command',
        scale: 1.2,
        glow: true
      },
      forge: {
        type: 'builder',
        color: 0xff6622,
        geometry: 'hammer',
        particles: 'sparks',
        scale: 1.1,
        accessories: ['anvil']
      },
      atlas: {
        type: 'explorer',
        color: 0x22cc66,
        geometry: 'compass',
        particles: 'wind',
        scale: 1.0,
        accessories: ['map']
      },
      hunter: {
        type: 'tracker',
        color: 0x996633,
        geometry: 'bow',
        particles: 'tracking',
        scale: 1.0,
        accessories: ['quiver']
      },
      echo: {
        type: 'communicator',
        color: 0xcc66cc,
        geometry: 'crystal',
        particles: 'resonance',
        scale: 0.9,
        accessories: ['antenna']
      },
      sentinel: {
        type: 'guardian',
        color: 0x6666cc,
        geometry: 'shield',
        particles: 'protection',
        scale: 1.1,
        accessories: ['sword']
      }
    };
  }

  function enhanceExistingAgents() {
    if (!window.castleApp.gameEngine || !window.castleApp.gameEngine.agents) return;

    Object.values(window.castleApp.gameEngine.agents).forEach(function(agent) {
      if (agent.mesh && agent.id) {
        enhanceAgentVisual(agent);
      }
    });
  }

  function updateAgentVisuals(sessionData) {
    if (!sessionData || !Array.isArray(sessionData)) return;

    sessionData.forEach(function(session) {
      var agentId = mapSessionToAgent(session);
      if (agentId && window.castleApp.gameEngine.agents[agentId]) {
        var agent = window.castleApp.gameEngine.agents[agentId];
        updateAgentMood(agent, session);
        updateAgentParticles(agent, session);
      }
    });
  }

  function mapSessionToAgent(session) {
    if (session.label && session.label.includes('main')) return 'sycopa';
    if (session.action === 'coding') return 'forge';
    if (session.action === 'communicating') return 'echo';
    if (session.action === 'reviewing') return 'sentinel';
    if (session.action === 'planning') return 'atlas';
    // Default mapping logic...
    return Object.keys(agentPersonalities)[0]; // fallback
  }

  function enhanceAgentVisual(agent) {
    var personality = agentPersonalities[agent.id];
    if (!personality) return;

    // Enhance base geometry
    enhanceAgentGeometry(agent, personality);
    
    // Add accessories
    if (personality.accessories) {
      personality.accessories.forEach(function(accessory) {
        addAgentAccessory(agent, accessory, personality);
      });
    }

    // Add particle system
    addAgentParticles(agent, personality);

    // Add glow effect if specified
    if (personality.glow) {
      addAgentGlow(agent, personality);
    }

    // Scale adjustment
    if (personality.scale !== 1.0) {
      agent.mesh.scale.setScalar(personality.scale);
    }
  }

  function enhanceAgentGeometry(agent, personality) {
    if (!agent.mesh || !agent.mesh.children) return;

    // Find the main body mesh
    var bodyMesh = agent.mesh.children.find(function(child) {
      return child.geometry && child.material;
    });

    if (!bodyMesh) return;

    // Modify material to reflect personality
    var material = bodyMesh.material.clone();
    material.color.setHex(personality.color);
    
    // Add some variation based on personality type
    switch (personality.type) {
      case 'commander':
        material.metalness = 0.8;
        material.roughness = 0.2;
        break;
      case 'builder':
        material.metalness = 0.6;
        material.roughness = 0.7;
        break;
      case 'explorer':
        material.metalness = 0.3;
        material.roughness = 0.5;
        break;
      case 'tracker':
        material.metalness = 0.4;
        material.roughness = 0.8;
        break;
      case 'communicator':
        material.metalness = 0.2;
        material.roughness = 0.3;
        material.emissive.setHex(personality.color);
        material.emissiveIntensity = 0.1;
        break;
      case 'guardian':
        material.metalness = 0.9;
        material.roughness = 0.1;
        break;
    }

    bodyMesh.material = material;

    // Add personality-specific geometry modifications
    addPersonalityGeometry(agent, personality);
  }

  function addPersonalityGeometry(agent, personality) {
    var geometryMesh;

    switch (personality.geometry) {
      case 'crown':
        geometryMesh = createCrown();
        break;
      case 'hammer':
        geometryMesh = createHammer();
        break;
      case 'compass':
        geometryMesh = createCompass();
        break;
      case 'bow':
        geometryMesh = createBow();
        break;
      case 'crystal':
        geometryMesh = createCrystal();
        break;
      case 'shield':
        geometryMesh = createShield();
        break;
    }

    if (geometryMesh) {
      geometryMesh.position.y = 2; // Above the agent
      geometryMesh.userData.type = 'personality';
      agent.mesh.add(geometryMesh);
    }
  }

  function createCrown() {
    var group = new window.THREE.Group();
    
    // Base ring
    var ringGeometry = new window.THREE.TorusGeometry(0.4, 0.05, 8, 16);
    var ringMaterial = new window.THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 });
    var ring = new window.THREE.Mesh(ringGeometry, ringMaterial);
    group.add(ring);

    // Crown points
    for (var i = 0; i < 5; i++) {
      var angle = (i / 5) * Math.PI * 2;
      var pointGeometry = new window.THREE.ConeGeometry(0.05, 0.3, 4);
      var point = new window.THREE.Mesh(pointGeometry, ringMaterial);
      point.position.x = Math.cos(angle) * 0.4;
      point.position.z = Math.sin(angle) * 0.4;
      point.position.y = 0.15;
      group.add(point);
    }

    return group;
  }

  function createHammer() {
    var group = new window.THREE.Group();
    
    // Handle
    var handleGeometry = new window.THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
    var handleMaterial = new window.THREE.MeshStandardMaterial({ color: 0x8B4513 });
    var handle = new window.THREE.Mesh(handleGeometry, handleMaterial);
    group.add(handle);

    // Head
    var headGeometry = new window.THREE.BoxGeometry(0.15, 0.08, 0.3);
    var headMaterial = new window.THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9 });
    var head = new window.THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.25;
    group.add(head);

    group.rotation.z = Math.PI / 4;
    return group;
  }

  function createCompass() {
    var group = new window.THREE.Group();
    
    // Base
    var baseGeometry = new window.THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
    var baseMaterial = new window.THREE.MeshStandardMaterial({ color: 0xCD7F32, metalness: 0.7 });
    var base = new window.THREE.Mesh(baseGeometry, baseMaterial);
    group.add(base);

    // Needle
    var needleGeometry = new window.THREE.ConeGeometry(0.02, 0.12, 4);
    var needleMaterial = new window.THREE.MeshStandardMaterial({ color: 0xff0000 });
    var needle = new window.THREE.Mesh(needleGeometry, needleMaterial);
    needle.position.y = 0.08;
    needle.rotation.z = Math.PI;
    group.add(needle);

    return group;
  }

  function createBow() {
    var group = new window.THREE.Group();
    
    // Bow curve
    var curve = new window.THREE.QuadraticBezierCurve3(
      new window.THREE.Vector3(-0.05, -0.2, 0),
      new window.THREE.Vector3(0, 0, 0),
      new window.THREE.Vector3(-0.05, 0.2, 0)
    );
    
    var tubeGeometry = new window.THREE.TubeGeometry(curve, 20, 0.02, 8, false);
    var bowMaterial = new window.THREE.MeshStandardMaterial({ color: 0x8B4513 });
    var bow = new window.THREE.Mesh(tubeGeometry, bowMaterial);
    group.add(bow);

    // String
    var stringGeometry = new window.THREE.BufferGeometry().setFromPoints([
      new window.THREE.Vector3(-0.05, -0.2, 0),
      new window.THREE.Vector3(-0.05, 0.2, 0)
    ]);
    var stringMaterial = new window.THREE.LineBasicMaterial({ color: 0xffffff });
    var string = new window.THREE.Line(stringGeometry, stringMaterial);
    group.add(string);

    return group;
  }

  function createCrystal() {
    var crystalGeometry = new window.THREE.OctahedronGeometry(0.1, 0);
    var crystalMaterial = new window.THREE.MeshStandardMaterial({ 
      color: 0xcc66cc, 
      transparent: true, 
      opacity: 0.8,
      emissive: 0xcc66cc,
      emissiveIntensity: 0.2
    });
    return new window.THREE.Mesh(crystalGeometry, crystalMaterial);
  }

  function createShield() {
    var group = new window.THREE.Group();
    
    // Shield body
    var shieldGeometry = new window.THREE.CylinderGeometry(0.15, 0.12, 0.03, 8);
    var shieldMaterial = new window.THREE.MeshStandardMaterial({ color: 0x4169E1, metalness: 0.8 });
    var shield = new window.THREE.Mesh(shieldGeometry, shieldMaterial);
    group.add(shield);

    // Cross emblem
    var crossGeometry = new window.THREE.BoxGeometry(0.1, 0.03, 0.04);
    var crossMaterial = new window.THREE.MeshStandardMaterial({ color: 0xffd700 });
    
    var cross1 = new window.THREE.Mesh(crossGeometry, crossMaterial);
    var cross2 = new window.THREE.Mesh(crossGeometry, crossMaterial);
    cross2.rotation.z = Math.PI / 2;
    
    group.add(cross1);
    group.add(cross2);

    return group;
  }

  function addAgentAccessory(agent, accessoryType, personality) {
    var accessory;

    switch (accessoryType) {
      case 'anvil':
        accessory = createAnvil();
        break;
      case 'map':
        accessory = createMap();
        break;
      case 'quiver':
        accessory = createQuiver();
        break;
      case 'antenna':
        accessory = createAntenna();
        break;
      case 'sword':
        accessory = createSword();
        break;
    }

    if (accessory) {
      accessory.position.set(0.5, 0, 0.5); // Offset from agent
      accessory.userData.type = 'accessory';
      agent.mesh.add(accessory);
    }
  }

  function createAnvil() {
    var group = new window.THREE.Group();
    var anvilGeometry = new window.THREE.BoxGeometry(0.2, 0.1, 0.15);
    var anvilMaterial = new window.THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });
    var anvil = new window.THREE.Mesh(anvilGeometry, anvilMaterial);
    group.add(anvil);
    return group;
  }

  function createMap() {
    var mapGeometry = new window.THREE.PlaneGeometry(0.15, 0.1);
    var mapMaterial = new window.THREE.MeshStandardMaterial({ color: 0xFFF8DC });
    return new window.THREE.Mesh(mapGeometry, mapMaterial);
  }

  function createQuiver() {
    var quiverGeometry = new window.THREE.CylinderGeometry(0.03, 0.04, 0.2, 8);
    var quiverMaterial = new window.THREE.MeshStandardMaterial({ color: 0x8B4513 });
    return new window.THREE.Mesh(quiverGeometry, quiverMaterial);
  }

  function createAntenna() {
    var group = new window.THREE.Group();
    var antennaGeometry = new window.THREE.CylinderGeometry(0.01, 0.01, 0.3, 6);
    var antennaMaterial = new window.THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.9 });
    var antenna = new window.THREE.Mesh(antennaGeometry, antennaMaterial);
    
    // Add glowing tip
    var tipGeometry = new window.THREE.SphereGeometry(0.02, 8, 8);
    var tipMaterial = new window.THREE.MeshStandardMaterial({ 
      color: 0xcc66cc, 
      emissive: 0xcc66cc, 
      emissiveIntensity: 0.5 
    });
    var tip = new window.THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.y = 0.15;
    
    group.add(antenna);
    group.add(tip);
    return group;
  }

  function createSword() {
    var group = new window.THREE.Group();
    
    // Blade
    var bladeGeometry = new window.THREE.BoxGeometry(0.02, 0.25, 0.003);
    var bladeMaterial = new window.THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.9 });
    var blade = new window.THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.y = 0.1;
    
    // Hilt
    var hiltGeometry = new window.THREE.BoxGeometry(0.08, 0.02, 0.02);
    var hiltMaterial = new window.THREE.MeshStandardMaterial({ color: 0xCD7F32 });
    var hilt = new window.THREE.Mesh(hiltGeometry, hiltMaterial);
    hilt.position.y = -0.03;
    
    group.add(blade);
    group.add(hilt);
    return group;
  }

  function addAgentParticles(agent, personality) {
    var particleSystem = createParticleSystem(personality.particles, personality.color);
    if (particleSystem) {
      agent.mesh.add(particleSystem);
      particleSystems[agent.id] = particleSystem;
    }
  }

  function createParticleSystem(type, color) {
    var particleCount = 50;
    var particles = new window.THREE.BufferGeometry();
    var positions = new Float32Array(particleCount * 3);
    var velocities = new Float32Array(particleCount * 3);

    for (var i = 0; i < particleCount; i++) {
      var i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2;
      positions[i3 + 1] = Math.random() * 2;
      positions[i3 + 2] = (Math.random() - 0.5) * 2;
      
      velocities[i3] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 1] = Math.random() * 0.01;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    particles.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));
    particles.setAttribute('velocity', new window.THREE.BufferAttribute(velocities, 3));

    var particleMaterial = new window.THREE.PointsMaterial({
      color: color,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: window.THREE.AdditiveBlending
    });

    var particleSystem = new window.THREE.Points(particles, particleMaterial);
    particleSystem.userData.type = 'particles';
    particleSystem.userData.particleType = type;

    return particleSystem;
  }

  function updateAgentMood(agent, sessionData) {
    if (!agent.mesh || !sessionData.mood) return;

    // Find personality objects
    var personalityObjects = agent.mesh.children.filter(function(child) {
      return child.userData.type === 'personality';
    });

    personalityObjects.forEach(function(obj) {
      // Adjust color based on mood
      var moodIntensity = sessionData.mood / 100;
      if (obj.material) {
        obj.material.emissiveIntensity = moodIntensity * 0.3;
      }
    });
  }

  function updateAgentParticles(agent, sessionData) {
    var particleSystem = particleSystems[agent.id];
    if (!particleSystem) return;

    // Animate particles based on agent activity
    var activity = sessionData.energy || 50;
    var activityMultiplier = activity / 100;

    var positions = particleSystem.geometry.attributes.position.array;
    var velocities = particleSystem.geometry.attributes.velocity.array;

    for (var i = 0; i < positions.length; i += 3) {
      // Update positions
      positions[i] += velocities[i] * activityMultiplier;
      positions[i + 1] += velocities[i + 1] * activityMultiplier;
      positions[i + 2] += velocities[i + 2] * activityMultiplier;

      // Reset particles that go too far
      if (Math.abs(positions[i]) > 2 || Math.abs(positions[i + 2]) > 2 || positions[i + 1] > 3) {
        positions[i] = (Math.random() - 0.5) * 0.5;
        positions[i + 1] = 0;
        positions[i + 2] = (Math.random() - 0.5) * 0.5;
      }
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  function addAgentGlow(agent, personality) {
    // Add subtle glow effect for special agents
    if (!agent.mesh) return;

    var glowMaterial = new window.THREE.MeshBasicMaterial({
      color: personality.color,
      transparent: true,
      opacity: 0.1,
      side: window.THREE.BackSide
    });

    // Clone the main geometry and scale it up slightly
    var mainMesh = agent.mesh.children.find(function(child) {
      return child.geometry && child.material && !child.userData.type;
    });

    if (mainMesh && mainMesh.geometry) {
      var glowGeometry = mainMesh.geometry.clone();
      var glowMesh = new window.THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.scale.setScalar(1.1);
      glowMesh.userData.type = 'glow';
      agent.mesh.add(glowMesh);
    }
  }

  // Animation loop for particles
  function animateParticles() {
    Object.values(particleSystems).forEach(function(system) {
      if (system.rotation) {
        system.rotation.y += 0.01;
      }
    });
    
    requestAnimationFrame(animateParticles);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 2000);
  }

  // Start animation loop
  animateParticles();

  // Export for debugging
  window.AgentVisuals = {
    enhanceAgent: enhanceAgentVisual,
    updateMood: updateAgentMood,
    personalities: agentPersonalities
  };
})();