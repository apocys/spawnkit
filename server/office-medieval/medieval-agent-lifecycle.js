import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// Medieval Agent Lifecycle — Spawn/Decommission Animations +
// Personality System (moods, routines, conscience, emoji)
// ═══════════════════════════════════════════════════════════════

// ── Personality Definitions ──────────────────────────────────

const PERSONALITIES = {
    Sycopa: {
        title: 'Royal Commander',
        temperament: 'stoic',
        moodBase: 0.75,
        energyDecay: 0.0003,
        preferredZones: ['castle', 'mission', 'tavern'],
        avoidZones: ['graveyard'],
        routines: {
            dawn:    { zone: 'castle',  emoji: '☀️', thought: 'Another day to command...' },
            morning: { zone: 'mission', emoji: '⚔️', thought: 'The realm needs orders.' },
            midday:  { zone: 'tavern',  emoji: '🍺', thought: 'A brief respite, then back to war.' },
            afternoon: { zone: 'castle', emoji: '📜', thought: 'Reviewing the scrolls...' },
            dusk:    { zone: 'castle',  emoji: '🌅', thought: 'The sun sets on another victory.' },
            night:   { zone: 'castle',  emoji: '👑', thought: 'The crown weighs heavy tonight.' },
        },
        moodEmojis: {
            happy:    ['😊', '👑', '⚔️', '💪'],
            neutral:  ['🤔', '📜', '👁️', '⚖️'],
            stressed: ['😤', '🗡️', '💢', '🏰'],
            tired:    ['😴', '💤', '🌙', '🛏️'],
        },
        walkSpeedMod: { day: 1.0, night: 0.6 },
    },

    Forge: {
        title: 'Master Smith',
        temperament: 'intense',
        moodBase: 0.65,
        energyDecay: 0.0005,
        preferredZones: ['forge', 'market'],
        avoidZones: ['chapel', 'library'],
        routines: {
            dawn:    { zone: 'forge',  emoji: '🔨', thought: 'The furnace awakens!' },
            morning: { zone: 'forge',  emoji: '🔥', thought: 'STEEL. FIRE. BUILD.' },
            midday:  { zone: 'market', emoji: '💰', thought: 'Checking supplies...' },
            afternoon: { zone: 'forge', emoji: '⚒️', thought: 'The blade takes shape!' },
            dusk:    { zone: 'tavern', emoji: '🍖', thought: 'Earned my supper today.' },
            night:   { zone: 'forge',  emoji: '🌙', thought: 'One more piece... just one more.' },
        },
        moodEmojis: {
            happy:    ['🔥', '⚒️', '💪', '🎯'],
            neutral:  ['🔨', '🔧', '⚙️', '🤔'],
            stressed: ['💢', '😡', '🔥', '💥'],
            tired:    ['😩', '💤', '🛠️', '😮‍💨'],
        },
        walkSpeedMod: { day: 1.3, night: 0.8 },
    },

    Atlas: {
        title: 'Royal Scribe',
        temperament: 'methodical',
        moodBase: 0.70,
        energyDecay: 0.0002,
        preferredZones: ['library', 'castle', 'chapel'],
        avoidZones: ['forge'],
        routines: {
            dawn:    { zone: 'chapel',  emoji: '🙏', thought: 'Morning prayers for clarity.' },
            morning: { zone: 'library', emoji: '📖', thought: 'The records must be perfect.' },
            midday:  { zone: 'castle',  emoji: '📜', thought: 'Reporting to the Commander.' },
            afternoon: { zone: 'library', emoji: '🪶', thought: 'Cross-referencing the archives...' },
            dusk:    { zone: 'library', emoji: '📚', thought: 'One more chapter...' },
            night:   { zone: 'chapel',  emoji: '🕯️', thought: 'By candlelight, the truth reveals.' },
        },
        moodEmojis: {
            happy:    ['📚', '✨', '📖', '🎯'],
            neutral:  ['📜', '🪶', '🔍', '📋'],
            stressed: ['😰', '📊', '⚠️', '🗂️'],
            tired:    ['😴', '💤', '📖', '🕯️'],
        },
        walkSpeedMod: { day: 0.9, night: 0.7 },
    },

    Hunter: {
        title: 'Royal Huntsman',
        temperament: 'restless',
        moodBase: 0.60,
        energyDecay: 0.0006,
        preferredZones: ['farm', 'river', 'market'],
        avoidZones: ['library', 'chapel'],
        routines: {
            dawn:    { zone: 'farm',   emoji: '🏹', thought: 'The hunt begins at dawn!' },
            morning: { zone: 'river',  emoji: '🎣', thought: 'Fish are biting today.' },
            midday:  { zone: 'market', emoji: '💰', thought: "What's the bounty worth?" },
            afternoon: { zone: 'farm', emoji: '🌾', thought: 'Tracking through the fields...' },
            dusk:    { zone: 'tavern', emoji: '🍺', thought: 'Tales of the hunt!' },
            night:   { zone: 'river',  emoji: '🌙', thought: 'Night fishing... peaceful.' },
        },
        moodEmojis: {
            happy:    ['🏹', '🎯', '🦌', '💰'],
            neutral:  ['🔍', '👁️', '🗡️', '🤔'],
            stressed: ['😤', '💢', '🏃', '⚡'],
            tired:    ['😩', '💤', '🏕️', '🌙'],
        },
        walkSpeedMod: { day: 1.5, night: 1.0 },
    },

    Echo: {
        title: 'Court Bard',
        temperament: 'whimsical',
        moodBase: 0.80,
        energyDecay: 0.0004,
        preferredZones: ['tavern', 'chapel', 'market'],
        avoidZones: ['graveyard'],
        routines: {
            dawn:    { zone: 'chapel',  emoji: '🎵', thought: 'A morning melody...' },
            morning: { zone: 'market',  emoji: '🎭', thought: 'Stories to gather!' },
            midday:  { zone: 'tavern',  emoji: '🎶', thought: 'SING! Let the hall ring!' },
            afternoon: { zone: 'market', emoji: '📢', thought: 'Spreading the word...' },
            dusk:    { zone: 'tavern',  emoji: '🎵', thought: 'The evening ballad begins.' },
            night:   { zone: 'chapel',  emoji: '🌟', thought: 'Under the stars, inspiration.' },
        },
        moodEmojis: {
            happy:    ['🎵', '🎶', '✨', '🎭'],
            neutral:  ['🎼', '🤔', '📝', '🎪'],
            stressed: ['😢', '🎻', '💔', '😞'],
            tired:    ['😴', '💤', '🎵', '🌙'],
        },
        walkSpeedMod: { day: 1.0, night: 0.5 },
    },

    Sentinel: {
        title: 'Castle Guard',
        temperament: 'vigilant',
        moodBase: 0.55,
        energyDecay: 0.0002,
        preferredZones: ['castle', 'graveyard', 'mission'],
        avoidZones: ['tavern'],
        routines: {
            dawn:    { zone: 'castle',    emoji: '🛡️', thought: 'The watch begins anew.' },
            morning: { zone: 'graveyard', emoji: '💀', thought: 'Checking the perimeter.' },
            midday:  { zone: 'castle',    emoji: '🔍', thought: 'Inspecting the walls.' },
            afternoon: { zone: 'mission', emoji: '⚠️', thought: 'Reviewing threats.' },
            dusk:    { zone: 'castle',    emoji: '🛡️', thought: 'Double the watch at dusk.' },
            night:   { zone: 'graveyard', emoji: '👁️', thought: 'Nothing escapes my gaze.' },
        },
        moodEmojis: {
            happy:    ['🛡️', '✅', '💪', '🏰'],
            neutral:  ['👁️', '🔍', '⚠️', '🤨'],
            stressed: ['🚨', '❌', '💢', '⚔️'],
            tired:    ['😐', '🌙', '👁️', '🛡️'],
        },
        walkSpeedMod: { day: 1.0, night: 1.2 },
    },
};

// ── Knight Templar Personality Generator (for sub-agents) ──

const KNIGHT_NAMES = [
    'Galahad', 'Percival', 'Gawain', 'Lancelot', 'Tristan', 'Roland',
    'Baudouin', 'Godfrey', 'Tancred', 'Sigurd', 'Alaric', 'Cedric',
];
const KNIGHT_TEMPERAMENTS = ['brave', 'cautious', 'eager', 'stoic', 'fierce'];

function generateKnightPersonality(label) {
    const name = label || KNIGHT_NAMES[Math.floor(Math.random() * KNIGHT_NAMES.length)];
    const temp = KNIGHT_TEMPERAMENTS[Math.floor(Math.random() * KNIGHT_TEMPERAMENTS.length)];
    return {
        title: 'Knight Templar',
        temperament: temp,
        moodBase: 0.5 + Math.random() * 0.3,
        energyDecay: 0.0004 + Math.random() * 0.0004,
        preferredZones: ['mission', 'forge', 'castle'],
        avoidZones: ['library'],
        routines: {
            dawn:    { zone: 'castle',  emoji: '⚔️', thought: 'Ready for duty.' },
            morning: { zone: 'mission', emoji: '🗡️', thought: 'Awaiting orders.' },
            midday:  { zone: 'tavern',  emoji: '🍖', thought: 'A knight must eat.' },
            afternoon: { zone: 'mission', emoji: '⚔️', thought: 'Back to the quest.' },
            dusk:    { zone: 'tavern',  emoji: '🍺', thought: "The day's work is done." },
            night:   { zone: 'castle',  emoji: '🛡️', thought: 'Standing guard.' },
        },
        moodEmojis: {
            happy:    ['⚔️', '💪', '🏆', '✨'],
            neutral:  ['🗡️', '🛡️', '⚙️', '🤔'],
            stressed: ['😤', '💢', '🔥', '⚡'],
            tired:    ['😴', '💤', '🌙', '😮‍💨'],
        },
        walkSpeedMod: { day: 1.2, night: 0.8 },
    };
}

// ── Time of Day Helper ───────────────────────────────────────

function getTimeOfDay(app) {
    const state = app._dayNightState;
    if (!state) return 'morning';
    const sunH = state.sunHeight;
    if (sunH > 0.7) return 'midday';
    if (sunH > 0.3) return state.mappedCycle < 0.25 ? 'morning' : 'afternoon';
    if (sunH > -0.1) return state.mappedCycle < 0.5 ? 'dawn' : 'dusk';
    return 'night';
}

// ── Agent State Store ────────────────────────────────────────

const agentStates = new Map();

function getAgentState(agentId) {
    if (!agentStates.has(agentId)) {
        const personality = PERSONALITIES[agentId] || generateKnightPersonality(agentId);
        agentStates.set(agentId, {
            personality,
            mood: personality.moodBase,
            energy: 1.0,
            moodLabel: 'neutral',
            currentEmoji: '',
            lastEmojiChange: 0,
            lastThought: '',
            isDecommissioning: false,
            isSpawning: false,
            spawnProgress: 0,
        });
    }
    return agentStates.get(agentId);
}

// ── Mood Calculation ─────────────────────────────────────────

function updateMood(agentId, app) {
    const state = getAgentState(agentId);
    const p = state.personality;
    const tod = getTimeOfDay(app);

    state.energy = Math.max(0, state.energy - p.energyDecay);

    let moodDelta = 0;

    const charData = app.characterModels?.get(agentId);
    if (charData?.group) {
        const pos = charData.group.position;
        const ZONES_MAP = {
            tavern: { x: -5, z: 24, r: 4 }, library: { x: 5, z: 22, r: 4 },
            forge: { x: 12, z: 20, r: 4 }, market: { x: 7, z: 27, r: 4 },
            chapel: { x: -9, z: 27, r: 4 }, castle: { x: 0, z: 0, r: 8 },
            mission: { x: -12, z: 20, r: 4 }, graveyard: { x: -15, z: -10, r: 5 },
            farm: { x: -16, z: 10, r: 5 }, river: { x: 0, z: 14, r: 3 },
        };

        for (const [name, zone] of Object.entries(ZONES_MAP)) {
            const dx = pos.x - zone.x, dz = pos.z - zone.z;
            if (Math.sqrt(dx * dx + dz * dz) <= zone.r) {
                if (p.preferredZones.includes(name)) moodDelta += 0.002;
                if (p.avoidZones.includes(name)) moodDelta -= 0.003;
                const routine = p.routines[tod];
                if (routine && routine.zone === name) moodDelta += 0.004;
                break;
            }
        }
    }

    const agentData = app.agents?.get(agentId);
    const hasSessions = agentData?.sessions?.length > 0 || agentData?.status === 'active';
    if (hasSessions) {
        moodDelta += 0.001;
        state.energy = Math.min(1, state.energy + 0.0001);
    } else {
        moodDelta -= 0.0005;
    }

    if (state.energy < 0.3) moodDelta -= 0.002;
    if (state.energy < 0.1) moodDelta -= 0.005;

    if (tod === 'night') state.energy = Math.min(1, state.energy + 0.001);
    if (tod === 'dawn' && state.energy < 0.5) state.energy = Math.min(1, state.energy + 0.003);

    state.mood = Math.max(0, Math.min(1, state.mood + moodDelta));

    if (state.energy < 0.2) state.moodLabel = 'tired';
    else if (state.mood > 0.7) state.moodLabel = 'happy';
    else if (state.mood < 0.35) state.moodLabel = 'stressed';
    else state.moodLabel = 'neutral';

    // Update KPIs from real session data
    if (agentData) {
        // Trust tier: based on session count and success rate
        var sessions = agentData.sessions || [];
        var totalSessions = sessions.length + (agentData.totalSessions || 0);
        state.trustTier = totalSessions >= 50 ? 5 : totalSessions >= 20 ? 4 : totalSessions >= 10 ? 3 : totalSessions >= 3 ? 2 : totalSessions >= 1 ? 1 : 0;

        // Conscience: based on activity level
        state.conscience = hasSessions ? 'dutiful' : (state.energy > 0.5 ? 'independent' : 'idle');

        // Last quest from active session
        if (sessions.length > 0) {
            var latest = sessions[sessions.length - 1];
            state.lastQuestName = latest.task || latest.label || agentData.action || null;
            state.lastQuestTime = latest.startedAt || Date.now();
        }
    }
}

// ── Emoji Expression System ──────────────────────────────────

function updateEmoji(agentId, now) {
    const state = getAgentState(agentId);
    const p = state.personality;
    const interval = 8000 + Math.random() * 7000;
    if (now - state.lastEmojiChange < interval) return;
    state.lastEmojiChange = now;

    const pool = p.moodEmojis[state.moodLabel] || p.moodEmojis.neutral;
    state.currentEmoji = pool[Math.floor(Math.random() * pool.length)];
}

// ── Routine-Based Waypoint Override ──────────────────────────

const ZONE_CENTERS = {
    tavern: { x: -5, z: 24 }, library: { x: 5, z: 22 },
    forge: { x: 12, z: 20 }, market: { x: 7, z: 27 },
    chapel: { x: -9, z: 27 }, castle: { x: 0, z: 0 },
    mission: { x: -12, z: 20 }, graveyard: { x: -15, z: -10 },
    farm: { x: -16, z: 10 }, river: { x: 0, z: 14 },
};

let lastRoutineCheck = 0;

function applyRoutineWaypoints(app) {
    const now = performance.now();
    if (now - lastRoutineCheck < 30000) return;
    lastRoutineCheck = now;

    const tod = getTimeOfDay(app);

    app.characterModels.forEach((charData, agentId) => {
        const state = getAgentState(agentId);
        if (state.isDecommissioning || state.isSpawning) return;

        const routine = state.personality.routines[tod];
        if (!routine) return;

        const targetZone = ZONE_CENTERS[routine.zone];
        if (!targetZone) return;

        const jitter = () => (Math.random() - 0.5) * 3;
        charData.waypoints[0] = { x: targetZone.x + jitter(), z: targetZone.z + jitter() };

        state.lastThought = routine.thought;

        const dnState = app._dayNightState;
        const isNight = dnState?.isNight;
        const baseDef = PERSONALITIES[agentId];
        const baseSpeed = baseDef ? (baseDef.walkSpeedMod.day * 0.4) : 0.4;
        const speedMod = isNight ? state.personality.walkSpeedMod.night : state.personality.walkSpeedMod.day;
        charData.speed = baseSpeed * speedMod;
    });
}

// ── Spawn Animation ──────────────────────────────────────────

const SPAWN_POINT = { x: 0, z: 13 };

function startSpawnAnimation(app, agentId) {
    const charData = app.characterModels.get(agentId);
    if (!charData) return;

    const state = getAgentState(agentId);
    state.isSpawning = true;
    state.spawnProgress = 0;

    charData.group.position.set(SPAWN_POINT.x, 0, SPAWN_POINT.z);

    charData.group.traverse(child => {
        if (child.isMesh && child.material) {
            // Replace with safe material to avoid GLTF clone/uniform crashes
            var col = child.material.color ? child.material.color.getHex() : 0xcccccc;
            child.material = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0 });
        }
    });

    // Particle ring
    const particleCount = 30;
    const particleGroup = new THREE.Group();
    const particleGeo = new THREE.SphereGeometry(0.05, 4, 4);

    for (let i = 0; i < particleCount; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xFFD700, transparent: true, opacity: 0.8 });
        const particle = new THREE.Mesh(particleGeo, mat);
        const angle = (i / particleCount) * Math.PI * 2;
        particle.position.set(Math.cos(angle) * 1.5, Math.random() * 0.5, Math.sin(angle) * 1.5);
        particle.userData = { angle, baseRadius: 1.5, speed: 2 + Math.random() * 3, riseSpeed: 0.5 + Math.random() * 1.5 };
        particleGroup.add(particle);
    }
    particleGroup.position.copy(charData.group.position);
    app.scene.add(particleGroup);

    // Summoning light
    const light = new THREE.PointLight(0xFFD700, 5, 8);
    light.position.copy(charData.group.position);
    light.position.y += 1;
    app.scene.add(light);

    // Herald bubble after 1.5s
    const labelEl = app.labelElements?.get(agentId);
    if (labelEl) {
        setTimeout(() => {
            const container = document.getElementById('labels-container') || document.body;
            const bubble = document.createElement('div');
            bubble.className = 'speech-bubble';
            bubble.textContent = '⚔️ A new knight arrives!';
            bubble.style.left = labelEl.style.left;
            bubble.style.top = (parseFloat(labelEl.style.top || 0) - 30) + 'px';
            container.appendChild(bubble);
            setTimeout(() => bubble.remove(), 3500);
        }, 1500);
    }

    if (app.addActivityLog) {
        app.addActivityLog('⚔️ ' + agentId + ' has been summoned to the castle!', agentId);
    }

    const startTime = performance.now();
    const duration = 2500;

    function animateSpawn() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        state.spawnProgress = t;

        charData.group.traverse(child => {
            if (child.isMesh && child.material) child.material.opacity = t;
        });

        particleGroup.children.forEach(p => {
            const pd = p.userData;
            const radius = pd.baseRadius * (1 - t * 0.8);
            const a = pd.angle + elapsed * 0.003 * pd.speed;
            p.position.x = Math.cos(a) * radius;
            p.position.z = Math.sin(a) * radius;
            p.position.y += pd.riseSpeed * 0.016;
            p.material.opacity = Math.max(0, 0.8 - t * 0.8);
        });

        light.intensity = 5 * (1 - t);

        if (t < 1) {
            requestAnimationFrame(animateSpawn);
        } else {
            app.scene.remove(particleGroup);
            particleGroup.children.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
            app.scene.remove(light);
            light.dispose();
            charData.group.traverse(child => {
                if (child.isMesh && child.material) { child.material.opacity = 1; child.material.transparent = false; }
            });
            state.isSpawning = false;
        }
    }
    requestAnimationFrame(animateSpawn);
}

// ── Decommission Animation (Walk to Graveyard + Flash) ──────

const GRAVEYARD = { x: -15, z: -10 };

function startDecommission(app, agentId) {
    const charData = app.characterModels.get(agentId);
    if (!charData) return;

    const state = getAgentState(agentId);
    if (state.isDecommissioning) return;
    state.isDecommissioning = true;

    const labelEl = app.labelElements?.get(agentId);
    if (labelEl) {
        const container = document.getElementById('labels-container') || document.body;
        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.textContent = '💀 My watch has ended...';
        bubble.style.left = labelEl.style.left;
        bubble.style.top = (parseFloat(labelEl.style.top || 0) - 30) + 'px';
        container.appendChild(bubble);
        setTimeout(() => bubble.remove(), 3500);
    }

    if (app.addActivityLog) {
        app.addActivityLog('💀 ' + agentId + ' walks into the eternal night...', agentId);
    }

    charData.waypoints = [
        { x: charData.group.position.x, z: charData.group.position.z },
        { x: GRAVEYARD.x, z: GRAVEYARD.z },
    ];
    charData.waypointIndex = 0;
    charData.nextWaypointIndex = 1;
    charData.speed = 0.2;

    function checkArrival() {
        const pos = charData.group.position;
        const dx = pos.x - GRAVEYARD.x, dz = pos.z - GRAVEYARD.z;
        if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
            playDespawnEffect(app, agentId);
        } else {
            requestAnimationFrame(checkArrival);
        }
    }
    requestAnimationFrame(checkArrival);
}

function playDespawnEffect(app, agentId) {
    const charData = app.characterModels.get(agentId);
    if (!charData) return;

    const pos = charData.group.position.clone();

    const flash = new THREE.PointLight(0xffffff, 8, 10);
    flash.position.copy(pos);
    flash.position.y += 1;
    app.scene.add(flash);

    const soulGroup = new THREE.Group();
    const soulGeo = new THREE.SphereGeometry(0.04, 4, 4);
    for (let i = 0; i < 20; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0xCCDDFF : 0xFFFFFF,
            transparent: true, opacity: 0.9,
        });
        const p = new THREE.Mesh(soulGeo, mat);
        p.position.set((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
        p.userData.riseSpeed = 1.5 + Math.random() * 2;
        p.userData.drift = (Math.random() - 0.5) * 0.5;
        soulGroup.add(p);
    }
    soulGroup.position.copy(pos);
    app.scene.add(soulGroup);

    const startTime = performance.now();
    const duration = 1200;

    function animateDespawn() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        charData.group.traverse(child => {
            if (child.isMesh && child.material) {
                if (!child.material._cloned) {
                    // Replace with safe material to avoid GLTF clone/uniform crashes
                    var col = child.material.color ? child.material.color.getHex() : 0xcccccc;
                    child.material = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 });
                    child.material._cloned = true;
                }
                child.material.opacity = 1 - t;
            }
        });

        flash.intensity = 8 * (1 - t);

        soulGroup.children.forEach(p => {
            p.position.y += p.userData.riseSpeed * 0.016;
            p.position.x += p.userData.drift * 0.016;
            p.material.opacity = Math.max(0, 0.9 - t);
        });

        if (t < 1) {
            requestAnimationFrame(animateDespawn);
        } else {
            app.scene.remove(charData.group);
            charData.group.traverse(child => {
                if (child.isMesh) { child.geometry?.dispose(); child.material?.dispose(); }
            });
            const label = app.labelElements.get(agentId);
            if (label) {
                if (label._emojiEl) label._emojiEl.remove();
                label.remove();
                app.labelElements.delete(agentId);
            }
            app.characterModels.delete(agentId);
            agentStates.delete(agentId);
            app.scene.remove(flash); flash.dispose();
            app.scene.remove(soulGroup);
            soulGroup.children.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
            console.log('[Lifecycle] 💀 ' + agentId + ' decommissioned');
        }
    }
    requestAnimationFrame(animateDespawn);
}

// ── Main Update Loop ─────────────────────────────────────────

let lastMoodUpdate = 0;

function updateAgentLifecycle(app) {
    const now = performance.now();

    if (now - lastMoodUpdate > 2000) {
        lastMoodUpdate = now;
        app.characterModels.forEach((charData, agentId) => {
            const state = getAgentState(agentId);
            if (state.isDecommissioning) return;
            updateMood(agentId, app);
            updateEmoji(agentId, now);
        });
    }

    applyRoutineWaypoints(app);

    // Update emoji display every frame
    app.characterModels.forEach((charData, agentId) => {
        const state = getAgentState(agentId);
        const labelEl = app.labelElements?.get(agentId);
        if (!labelEl) return;

        const emojiEl = labelEl._emojiEl;
        if (emojiEl && state.currentEmoji) {
            emojiEl.textContent = state.currentEmoji;
            emojiEl.style.fontSize = '18px';
        }

        const moodIcon = state.moodLabel === 'happy' ? '😊'
            : state.moodLabel === 'stressed' ? '😤'
            : state.moodLabel === 'tired' ? '😴' : '';
        labelEl.innerHTML = agentId + ' ' + moodIcon;
    });
}

// ── Track Known Agents for Spawn Detection ───────────────────

const knownAgents = new Set();
let initialLoadDone = false;

function detectSpawnDespawn(app) {
    const currentIds = new Set(app.characterModels.keys());

    if (!initialLoadDone) {
        currentIds.forEach(id => knownAgents.add(id));
        if (knownAgents.size >= 6) initialLoadDone = true;
        return;
    }

    currentIds.forEach(id => {
        if (!knownAgents.has(id)) {
            knownAgents.add(id);
            startSpawnAnimation(app, id);
        }
    });
}

// ── Bootstrap ────────────────────────────────────────────────

function bootstrap() {
    const app = window.castleApp;
    if (!app || !app.scene || !app.characterModels) {
        setTimeout(bootstrap, 500);
        return;
    }

    console.log('[Lifecycle] ⚔️ Agent Lifecycle system initializing...');

    app.characterModels.forEach((charData, agentId) => {
        getAgentState(agentId);
        knownAgents.add(agentId);
    });

    function lifecycleLoop() {
        updateAgentLifecycle(app);
        detectSpawnDespawn(app);
        requestAnimationFrame(lifecycleLoop);
    }
    requestAnimationFrame(lifecycleLoop);

    window.MedievalLifecycle = {
        spawnAgent: (agentId) => startSpawnAnimation(app, agentId),
        decommissionAgent: (agentId) => startDecommission(app, agentId),
        getAgentState: (agentId) => getAgentState(agentId),
        getPersonality: (agentId) => PERSONALITIES[agentId] || null,
        getAllStates: () => Object.fromEntries(agentStates),
        getTimeOfDay: () => getTimeOfDay(app),
    };

    console.log('[Lifecycle] ✅ Agent Lifecycle system ready — personalities loaded for',
        Object.keys(PERSONALITIES).join(', '));
}

bootstrap();
