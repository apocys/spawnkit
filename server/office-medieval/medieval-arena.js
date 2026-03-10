/**
 * Medieval Arena — The Battle Colosseum
 * ══════════════════════════════════════
 * A physical arena in the medieval world where AI champions fight.
 * Procedural 3D colosseum with gates, portals, scoreboards, and effects.
 *
 * Depends on: medieval-scene.js (castleApp), THREE.js
 * @version 1.0.0
 */

/* global THREE */
// THREE is loaded globally via importmap/CDN in index.html — do not use ES module import

// ── Constants ────────────────────────────────────────────
const ARENA_POS = { x: 0, y: 0, z: -18 };        // Behind the village
const ARENA_RADIUS = 6;
const ARENA_WALL_HEIGHT = 3.5;
const ARENA_SEGMENTS = 32;
const GATE_WIDTH = 2.2;
const GATE_HEIGHT = 3;

// Colors
const STONE_COLOR = 0x6b6357;
const STONE_DARK = 0x4a4238;
const SAND_COLOR = 0xc9b896;
const GOLD_COLOR = 0xc9a959;
const PORTAL_BLUE = 0x4488ff;
const PORTAL_PURPLE = 0x8844ff;
const TORCH_ORANGE = 0xff6622;
const BANNER_APOMAC = 0x3366cc;
const BANNER_SYCOPA = 0x884400;

class MedievalArena {
    constructor(app) {
        this.app = app;
        this.scene = app.scene;
        this.group = new THREE.Group();
        this.group.position.set(ARENA_POS.x, ARENA_POS.y, ARENA_POS.z);
        this.scene.add(this.group);

        // State
        this.currentBattle = null;
        this.battleHistory = [];
        this.portalParticles = [];
        this.torchLights = [];
        this.championA = null;
        this.championB = null;

        // Build
        this._buildFloor();
        this._buildWalls();
        this._buildGates();
        this._buildPortals();
        this._buildTorches();
        this._buildScoreboard();
        this._buildBanners();
        this._buildPath();

        // UI overlay
        this._createUI();

        console.log('[Arena] ⚔️ Colosseum constructed');
    }

    // ── Floor ────────────────────────────────────────
    _buildFloor() {
        // Sand circle floor
        const floorGeo = new THREE.CircleGeometry(ARENA_RADIUS - 0.3, ARENA_SEGMENTS);
        const floorMat = new THREE.MeshStandardMaterial({
            color: SAND_COLOR,
            roughness: 0.9,
            metalness: 0.0,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.02;
        floor.receiveShadow = true;
        this.group.add(floor);

        // Battle circle etched in the sand
        const ringGeo = new THREE.RingGeometry(ARENA_RADIUS * 0.55, ARENA_RADIUS * 0.58, 64);
        const ringMat = new THREE.MeshStandardMaterial({
            color: GOLD_COLOR,
            roughness: 0.6,
            metalness: 0.3,
            transparent: true,
            opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        this.group.add(ring);

        // Center rune circle
        const runeGeo = new THREE.RingGeometry(0.8, 1.0, 6);
        const runeMat = new THREE.MeshStandardMaterial({
            color: GOLD_COLOR,
            emissive: GOLD_COLOR,
            emissiveIntensity: 0.2,
            roughness: 0.5,
            metalness: 0.4,
            transparent: true,
            opacity: 0.5,
        });
        const rune = new THREE.Mesh(runeGeo, runeMat);
        rune.rotation.x = -Math.PI / 2;
        rune.position.y = 0.035;
        this.group.add(rune);
    }

    // ── Walls (Colosseum) ────────────────────────────
    _buildWalls() {
        // Create a cylindrical wall with gaps for gates
        const wallMat = new THREE.MeshStandardMaterial({
            color: STONE_COLOR,
            roughness: 0.85,
            metalness: 0.1,
        });

        const pillarCount = 16;
        const gateAngles = [0, Math.PI]; // North and South gates

        for (let i = 0; i < pillarCount; i++) {
            const angle = (i / pillarCount) * Math.PI * 2;

            // Skip pillars near gates
            const nearGate = gateAngles.some(ga => {
                const diff = Math.abs(angle - ga);
                return diff < 0.35 || diff > Math.PI * 2 - 0.35;
            });
            if (nearGate) continue;

            // Main pillar
            const pillarGeo = new THREE.BoxGeometry(0.5, ARENA_WALL_HEIGHT, 0.5);
            const pillar = new THREE.Mesh(pillarGeo, wallMat);
            pillar.position.set(
                Math.sin(angle) * ARENA_RADIUS,
                ARENA_WALL_HEIGHT / 2,
                Math.cos(angle) * ARENA_RADIUS
            );
            pillar.rotation.y = -angle;
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.group.add(pillar);

            // Top cap
            const capGeo = new THREE.BoxGeometry(0.7, 0.2, 0.7);
            const capMat = new THREE.MeshStandardMaterial({ color: STONE_DARK, roughness: 0.9 });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.set(
                Math.sin(angle) * ARENA_RADIUS,
                ARENA_WALL_HEIGHT + 0.1,
                Math.cos(angle) * ARENA_RADIUS
            );
            this.group.add(cap);

            // Wall segments between pillars (lower wall)
            const nextAngle = ((i + 1) / pillarCount) * Math.PI * 2;
            const nearNextGate = gateAngles.some(ga => {
                const diff = Math.abs(nextAngle - ga);
                return diff < 0.35 || diff > Math.PI * 2 - 0.35;
            });
            if (!nearNextGate) {
                const midAngle = (angle + nextAngle) / 2;
                const segLen = 2 * ARENA_RADIUS * Math.sin(Math.PI / pillarCount);
                const wallGeo = new THREE.BoxGeometry(segLen * 0.85, ARENA_WALL_HEIGHT * 0.6, 0.25);
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(
                    Math.sin(midAngle) * (ARENA_RADIUS - 0.1),
                    ARENA_WALL_HEIGHT * 0.3,
                    Math.cos(midAngle) * (ARENA_RADIUS - 0.1)
                );
                wall.rotation.y = -midAngle;
                wall.castShadow = true;
                wall.receiveShadow = true;
                this.group.add(wall);
            }
        }
    }

    // ── Gates ────────────────────────────────────────
    _buildGates() {
        const gateMat = new THREE.MeshStandardMaterial({
            color: STONE_DARK,
            roughness: 0.8,
            metalness: 0.15,
        });

        [
            { angle: 0, name: 'north', color: BANNER_APOMAC, label: '🍎 ApoMac' },
            { angle: Math.PI, name: 'south', color: BANNER_SYCOPA, label: '🎭 Sycopa' },
        ].forEach(gate => {
            const x = Math.sin(gate.angle) * ARENA_RADIUS;
            const z = Math.cos(gate.angle) * ARENA_RADIUS;

            // Left pillar
            const lPillar = new THREE.Mesh(
                new THREE.BoxGeometry(0.6, GATE_HEIGHT + 0.5, 0.6),
                gateMat
            );
            lPillar.position.set(
                x - Math.cos(gate.angle) * GATE_WIDTH / 2,
                (GATE_HEIGHT + 0.5) / 2,
                z + Math.sin(gate.angle) * GATE_WIDTH / 2
            );
            lPillar.castShadow = true;
            this.group.add(lPillar);

            // Right pillar
            const rPillar = new THREE.Mesh(
                new THREE.BoxGeometry(0.6, GATE_HEIGHT + 0.5, 0.6),
                gateMat
            );
            rPillar.position.set(
                x + Math.cos(gate.angle) * GATE_WIDTH / 2,
                (GATE_HEIGHT + 0.5) / 2,
                z - Math.sin(gate.angle) * GATE_WIDTH / 2
            );
            rPillar.castShadow = true;
            this.group.add(rPillar);

            // Arch (top beam)
            const archGeo = new THREE.BoxGeometry(GATE_WIDTH + 0.6, 0.5, 0.6);
            const arch = new THREE.Mesh(archGeo, gateMat);
            arch.position.set(x, GATE_HEIGHT + 0.25, z);
            arch.rotation.y = gate.angle + Math.PI / 2;
            this.group.add(arch);

            // Gate kingdom banner color strip
            const stripGeo = new THREE.PlaneGeometry(0.3, GATE_HEIGHT * 0.7);
            const stripMat = new THREE.MeshStandardMaterial({
                color: gate.color,
                emissive: gate.color,
                emissiveIntensity: 0.15,
                side: THREE.DoubleSide,
            });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.set(
                x - Math.sin(gate.angle) * 0.35,
                GATE_HEIGHT * 0.5,
                z - Math.cos(gate.angle) * 0.35
            );
            strip.rotation.y = gate.angle;
            this.group.add(strip);
        });
    }

    // ── Portals ──────────────────────────────────────
    _buildPortals() {
        // Magical portal rings at each gate
        [
            { angle: 0, color: PORTAL_BLUE },
            { angle: Math.PI, color: PORTAL_PURPLE },
        ].forEach(portal => {
            const x = Math.sin(portal.angle) * (ARENA_RADIUS + 1.5);
            const z = Math.cos(portal.angle) * (ARENA_RADIUS + 1.5);

            // Portal ring
            const ringGeo = new THREE.TorusGeometry(1.2, 0.08, 8, 32);
            const ringMat = new THREE.MeshStandardMaterial({
                color: portal.color,
                emissive: portal.color,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.7,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(x, 1.8, z);
            ring.rotation.y = portal.angle;
            this.group.add(ring);

            // Portal glow (point light)
            const light = new THREE.PointLight(portal.color, 0.6, 8);
            light.position.set(x, 1.8, z);
            this.group.add(light);

            // Portal particle disc (swirling effect — animated in update)
            const discGeo = new THREE.CircleGeometry(1.0, 32);
            const discMat = new THREE.MeshBasicMaterial({
                color: portal.color,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide,
            });
            const disc = new THREE.Mesh(discGeo, discMat);
            disc.position.set(x, 1.8, z);
            disc.rotation.y = portal.angle;
            disc.userData.portalDisc = true;
            disc.userData.baseOpacity = 0.15;
            this.group.add(disc);
            this.portalParticles.push(disc);
        });
    }

    // ── Torches ──────────────────────────────────────
    _buildTorches() {
        const torchAngles = [
            Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.75,
            Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75,
        ];

        torchAngles.forEach(angle => {
            const x = Math.sin(angle) * (ARENA_RADIUS + 0.3);
            const z = Math.cos(angle) * (ARENA_RADIUS + 0.3);

            // Torch pole
            const poleGeo = new THREE.CylinderGeometry(0.04, 0.06, 2.2, 6);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(x, 1.1, z);
            this.group.add(pole);

            // Torch fire (point light)
            const torchLight = new THREE.PointLight(TORCH_ORANGE, 0.4, 5, 2);
            torchLight.position.set(x, 2.3, z);
            this.group.add(torchLight);
            this.torchLights.push(torchLight);

            // Flame sprite
            const flameGeo = new THREE.SphereGeometry(0.1, 8, 6);
            const flameMat = new THREE.MeshBasicMaterial({
                color: TORCH_ORANGE,
                transparent: true,
                opacity: 0.8,
            });
            const flame = new THREE.Mesh(flameGeo, flameMat);
            flame.position.set(x, 2.25, z);
            flame.userData.flame = true;
            this.group.add(flame);
        });
    }

    // ── Scoreboard ───────────────────────────────────
    _buildScoreboard() {
        // Large stone tablet in the center-back of arena
        const tabletGeo = new THREE.BoxGeometry(3, 2.5, 0.3);
        const tabletMat = new THREE.MeshStandardMaterial({
            color: STONE_DARK,
            roughness: 0.85,
            metalness: 0.05,
        });
        const tablet = new THREE.Mesh(tabletGeo, tabletMat);
        tablet.position.set(0, 1.8, -ARENA_RADIUS + 0.5);
        tablet.castShadow = true;
        this.group.add(tablet);

        // Gold frame
        const frameGeo = new THREE.BoxGeometry(3.2, 2.7, 0.05);
        const frameMat = new THREE.MeshStandardMaterial({
            color: GOLD_COLOR,
            roughness: 0.4,
            metalness: 0.6,
            transparent: true,
            opacity: 0.5,
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(0, 1.8, -ARENA_RADIUS + 0.35);
        this.group.add(frame);

        // Scoreboard title glow
        const titleLight = new THREE.PointLight(GOLD_COLOR, 0.3, 4);
        titleLight.position.set(0, 3.2, -ARENA_RADIUS + 0.5);
        this.group.add(titleLight);
    }

    // ── Banners ──────────────────────────────────────
    _buildBanners() {
        const bannerData = [
            { x: -3, color: BANNER_APOMAC, emoji: '🍎' },
            { x: 3, color: BANNER_SYCOPA, emoji: '🎭' },
        ];

        bannerData.forEach(b => {
            // Banner pole
            const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 4, 6);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(b.x, 2, -ARENA_RADIUS + 0.3);
            this.group.add(pole);

            // Banner cloth
            const clothGeo = new THREE.PlaneGeometry(1.2, 1.8);
            const clothMat = new THREE.MeshStandardMaterial({
                color: b.color,
                side: THREE.DoubleSide,
                roughness: 0.8,
            });
            const cloth = new THREE.Mesh(clothGeo, clothMat);
            cloth.position.set(b.x + 0.65, 3, -ARENA_RADIUS + 0.3);
            this.group.add(cloth);
        });
    }

    // ── Path to village ──────────────────────────────
    _buildPath() {
        // Dirt path connecting arena to the village
        const pathMat = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            roughness: 0.95,
            metalness: 0,
        });

        const pathGeo = new THREE.PlaneGeometry(1.5, 12, 1, 8);
        // Add some irregularity
        const pos = pathGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const edge = Math.abs(pos.getX(i)) / 0.75;
            if (edge > 0.5) {
                pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.15);
            }
        }
        pathGeo.computeVertexNormals();

        const path = new THREE.Mesh(pathGeo, pathMat);
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.015, -ARENA_RADIUS - 6);
        path.receiveShadow = true;
        this.group.add(path);
    }

    // ── HTML UI Overlay ──────────────────────────────
    _createUI() {
        // Inject arena UI styles + panel
        const style = document.createElement('style');
        style.textContent = `
            .arena-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 520px;
                max-height: 80vh;
                background: linear-gradient(145deg, rgba(15, 12, 8, 0.95), rgba(30, 24, 16, 0.92));
                border: 2px solid rgba(201, 169, 89, 0.4);
                border-radius: 12px;
                padding: 24px;
                display: none;
                z-index: 10000;
                overflow-y: auto;
                font-family: 'Crimson Text', serif;
                color: #f4e4bc;
                box-shadow: 0 0 40px rgba(201, 169, 89, 0.15), inset 0 0 60px rgba(0,0,0,0.3);
            }
            .arena-panel.visible { display: block; animation: arenaFadeIn 0.4s ease-out; }
            @keyframes arenaFadeIn { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }

            .arena-title {
                text-align: center;
                font-size: 22px;
                color: #c9a959;
                margin-bottom: 16px;
                text-shadow: 0 0 10px rgba(201, 169, 89, 0.3);
                letter-spacing: 2px;
            }

            .arena-scoreboard {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 8px;
                align-items: center;
                margin-bottom: 20px;
                padding: 16px;
                background: rgba(22, 33, 62, 0.4);
                border-radius: 8px;
                border: 1px solid rgba(201, 169, 89, 0.2);
            }

            .arena-champion {
                text-align: center;
                padding: 12px;
            }
            .arena-champion-name {
                font-size: 16px;
                color: #c9a959;
                margin-bottom: 4px;
            }
            .arena-champion-emoji { font-size: 32px; }
            .arena-champion-score {
                font-size: 28px;
                font-weight: bold;
                margin-top: 8px;
            }
            .arena-champion.winner .arena-champion-score { color: #4caf50; text-shadow: 0 0 8px rgba(76, 175, 80, 0.4); }
            .arena-champion.loser .arena-champion-score { color: #ff6b6b; }

            .arena-vs {
                font-size: 20px;
                color: rgba(201, 169, 89, 0.6);
                font-style: italic;
            }

            .arena-dimension-row {
                display: grid;
                grid-template-columns: 1fr 2fr 1fr;
                gap: 8px;
                padding: 6px 8px;
                border-bottom: 1px solid rgba(201, 169, 89, 0.1);
                font-size: 13px;
                align-items: center;
            }
            .arena-dimension-row:hover { background: rgba(201, 169, 89, 0.05); }
            .arena-dim-name { color: rgba(244, 228, 188, 0.7); }
            .arena-dim-bar {
                height: 6px;
                border-radius: 3px;
                background: rgba(255,255,255,0.1);
                position: relative;
                overflow: hidden;
            }
            .arena-dim-fill {
                height: 100%;
                border-radius: 3px;
                transition: width 0.8s ease-out;
            }
            .arena-dim-fill.a { background: linear-gradient(90deg, #3366cc, #5588ee); }
            .arena-dim-fill.b { background: linear-gradient(90deg, #884400, #bb6622); }
            .arena-dim-winner { text-align: right; font-size: 12px; }

            .arena-history {
                margin-top: 16px;
                max-height: 200px;
                overflow-y: auto;
            }
            .arena-history-entry {
                display: flex;
                justify-content: space-between;
                padding: 6px 8px;
                border-bottom: 1px solid rgba(201, 169, 89, 0.08);
                font-size: 12px;
                color: rgba(244, 228, 188, 0.6);
            }
            .arena-history-entry:hover { color: #f4e4bc; }

            .arena-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 10px 20px;
                border-radius: 6px;
                border: 1px solid rgba(201, 169, 89, 0.4);
                background: rgba(201, 169, 89, 0.1);
                color: #c9a959;
                cursor: pointer;
                font-family: 'Crimson Text', serif;
                font-size: 14px;
                transition: all 0.2s;
            }
            .arena-btn:hover { background: rgba(201, 169, 89, 0.2); transform: translateY(-1px); }
            .arena-btn.fight { border-color: rgba(255, 69, 58, 0.4); color: #ff6b6b; background: rgba(255, 69, 58, 0.1); }
            .arena-btn.fight:hover { background: rgba(255, 69, 58, 0.2); }

            .arena-close {
                position: absolute;
                top: 12px;
                right: 16px;
                cursor: pointer;
                font-size: 18px;
                color: rgba(244, 228, 188, 0.4);
                transition: color 0.2s;
            }
            .arena-close:hover { color: #f4e4bc; }
        `;
        document.head.appendChild(style);

        // Panel HTML
        const panel = document.createElement('div');
        panel.className = 'arena-panel';
        panel.id = 'arenaPanel';
        panel.innerHTML = `
            <span class="arena-close" onclick="window.MedievalArena.togglePanel()">✕</span>
            <div class="arena-title">⚔️ THE ARENA ⚔️</div>

            <div class="arena-scoreboard" id="arenaScoreboard">
                <div class="arena-champion" id="arenaChampionA">
                    <div class="arena-champion-emoji">🍎</div>
                    <div class="arena-champion-name">ApoMac</div>
                    <div class="arena-champion-score" id="arenaScoreA">—</div>
                </div>
                <div class="arena-vs">VS</div>
                <div class="arena-champion" id="arenaChampionB">
                    <div class="arena-champion-emoji">🎭</div>
                    <div class="arena-champion-name">Sycopa</div>
                    <div class="arena-champion-score" id="arenaScoreB">—</div>
                </div>
            </div>

            <div id="arenaDimensions"></div>

            <div style="text-align:center; margin-top:16px;">
                <button class="arena-btn fight" onclick="window.MedievalArena.startBattle()">
                    ⚔️ Challenge to Battle
                </button>
            </div>

            <div class="arena-history" id="arenaHistory">
                <div style="text-align:center; color:rgba(244,228,188,0.4); font-style:italic; padding:20px;">
                    No battles fought yet. The arena awaits its first champions.
                </div>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // ── Public API ───────────────────────────────────

    /**
     * render(container) — called by medieval-panels.js BUILDING_PANELS map
     * Renders live arena state into the building panel DOM container.
     */
    render(container) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#c9a959;font-family:serif;">⚔️ Loading Arena…</div>';

        const token = 'sk-fleet-2ad53564b03d9facbe3389bb5c461179ffc73af12e50ae00';
        fetch('http://localhost:18790/api/arena/leaderboard', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(r => r.json())
        .then(res => {
            if (!res.ok) throw new Error(res.error || 'API error');
            const { leaderboard, champions, recentBattles, totalBattles } = res.data;
            const sy = leaderboard.sycopa || {};
            const ap = leaderboard.apomac || {};
            const chSy = champions.sycopa || {};
            const chAp = champions.apomac || {};

            const battleRows = (recentBattles || []).slice(0, 5).map(b => {
                const winner = b.winner || (b.forfeitedBy ? (b.forfeitedBy === 'sycopa' ? 'apomac' : 'sycopa') : '—');
                const scoreStr = b.scores
                    ? `🎭 ${b.scores.sycopa?.total?.toFixed(1) ?? '—'} · 💻 ${b.scores.apomac?.total?.toFixed(1) ?? '—'}`
                    : (b.forfeitedBy ? `🏳️ ${b.forfeitedBy} forfeited` : '—');
                const date = new Date(b.challengedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const winEmoji = winner === 'sycopa' ? '🎭' : winner === 'apomac' ? '💻' : '🤝';
                return `<div class="ar-row">
                    <span class="ar-task" title="${b.task || ''}">${b.templateMeta?.icon || '⚔️'} ${(b.task || 'Battle').substring(0,38)}${(b.task||'').length > 38 ? '…' : ''}</span>
                    <span class="ar-score">${scoreStr}</span>
                    <span class="ar-win">${winEmoji} ${winner}</span>
                    <span class="ar-time">${date}</span>
                </div>`;
            }).join('') || '<div class="ar-empty">No battles yet — The arena awaits its first champions.</div>';

            container.innerHTML = `
            <style>
                .ar-wrap { font-family: 'Crimson Text', 'EB Garamond', Georgia, serif; color: #e8d5a3; padding: 4px 0; }
                .ar-champions { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; margin-bottom: 16px; }
                .ar-champ { background: rgba(20,14,6,0.8); border-radius: 8px; padding: 12px; text-align: center; }
                .ar-champ.sy { border: 1px solid rgba(201,169,89,0.4); }
                .ar-champ.ap { border: 1px solid rgba(79,195,247,0.3); }
                .ar-emoji { font-size: 28px; display: block; margin-bottom: 4px; }
                .ar-name { font-size: 14px; font-weight: 700; }
                .ar-name.sy { color: #c9a959; }
                .ar-name.ap { color: #4fc3f7; }
                .ar-title-text { font-size: 10px; color: #6b5a30; font-style: italic; margin-bottom: 8px; }
                .ar-stats { display: flex; justify-content: space-around; font-size: 11px; }
                .ar-stat-val { font-size: 17px; font-weight: 700; display: block; }
                .sy .ar-stat-val { color: #c9a959; }
                .ap .ar-stat-val { color: #4fc3f7; }
                .ar-stat-lbl { color: #5a4a25; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
                .ar-vs { text-align: center; color: #8a7040; }
                .ar-vs-text { font-size: 20px; font-weight: 900; color: #c9a959; display: block; }
                .ar-section { font-size: 10px; letter-spacing: 3px; color: #6b5a30; text-transform: uppercase; text-align: center; margin: 12px 0 8px; }
                .ar-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; align-items: center; padding: 6px 8px; border-bottom: 1px solid rgba(201,169,89,0.08); font-size: 11px; }
                .ar-row:hover { background: rgba(201,169,89,0.04); }
                .ar-task { color: #a08050; overflow: hidden; white-space: nowrap; }
                .ar-score { color: #8a7040; white-space: nowrap; }
                .ar-win { color: #c9a959; white-space: nowrap; }
                .ar-time { color: #4a3a1a; white-space: nowrap; }
                .ar-empty { text-align: center; padding: 16px; color: #4a3a1a; font-style: italic; }
                .ar-challenge-btn { display: block; width: 100%; margin-top: 14px; padding: 9px; background: rgba(201,169,89,0.1); border: 1px solid rgba(201,169,89,0.3); border-radius: 6px; color: #c9a959; font-family: inherit; font-size: 13px; cursor: pointer; transition: background 0.2s; }
                .ar-challenge-btn:hover { background: rgba(201,169,89,0.2); }
            </style>
            <div class="ar-wrap">
                <div class="ar-champions">
                    <div class="ar-champ sy">
                        <span class="ar-emoji">${chSy.emoji || '🎭'}</span>
                        <div class="ar-name sy">${chSy.name || 'Sycopa'}</div>
                        <div class="ar-title-text">${chSy.title || ''}</div>
                        <div class="ar-stats">
                            <div><span class="ar-stat-val">${sy.wins ?? 0}</span><span class="ar-stat-lbl">W</span></div>
                            <div><span class="ar-stat-val">${sy.losses ?? 0}</span><span class="ar-stat-lbl">L</span></div>
                            <div><span class="ar-stat-val">${sy.points ?? 0}</span><span class="ar-stat-lbl">Pts</span></div>
                        </div>
                    </div>
                    <div class="ar-vs">
                        <span class="ar-vs-text">VS</span>
                        <span style="font-size:10px;color:#4a3a1a;">${totalBattles || 0} battles</span>
                    </div>
                    <div class="ar-champ ap">
                        <span class="ar-emoji">${chAp.emoji || '💻'}</span>
                        <div class="ar-name ap">${chAp.name || 'ApoMac'}</div>
                        <div class="ar-title-text">${chAp.title || ''}</div>
                        <div class="ar-stats">
                            <div><span class="ar-stat-val">${ap.wins ?? 0}</span><span class="ar-stat-lbl">W</span></div>
                            <div><span class="ar-stat-val">${ap.losses ?? 0}</span><span class="ar-stat-lbl">L</span></div>
                            <div><span class="ar-stat-val">${ap.points ?? 0}</span><span class="ar-stat-lbl">Pts</span></div>
                        </div>
                    </div>
                </div>

                <div class="ar-section">⚔ Recent Battles</div>
                ${battleRows}

                <button class="ar-challenge-btn" onclick="window.MedievalArena && window.MedievalArena.startBattle()">
                    ⚔️ Issue a Challenge
                </button>
            </div>`;
        })
        .catch(err => {
            container.innerHTML = `<div style="padding:16px;color:#ef4444;font-style:italic;text-align:center;">⚠️ Arena unreachable: ${err.message}</div>`;
        });
    }

    togglePanel() {
        const panel = document.getElementById('arenaPanel');
        if (panel) panel.classList.toggle('visible');
    }

    showBattleResult(result) {
        // result: { taskName, agentA: { name, emoji, score, dimensions }, agentB: { ... }, winner }
        const scoreA = document.getElementById('arenaScoreA');
        const scoreB = document.getElementById('arenaScoreB');
        const champA = document.getElementById('arenaChampionA');
        const champB = document.getElementById('arenaChampionB');
        const dims = document.getElementById('arenaDimensions');

        if (scoreA) scoreA.textContent = result.agentA.score.toFixed(1);
        if (scoreB) scoreB.textContent = result.agentB.score.toFixed(1);

        if (champA) champA.className = 'arena-champion ' + (result.winner === 'A' ? 'winner' : 'loser');
        if (champB) champB.className = 'arena-champion ' + (result.winner === 'B' ? 'winner' : 'loser');

        // Render dimensions
        if (dims) {
            const dimensionNames = ['Speed', 'Correctness', 'Quality', 'Autonomy', 'Efficiency', 'Conciseness', 'Recovery'];
            dims.innerHTML = result.agentA.dimensions.map((scoreA, i) => {
                const sB = result.agentB.dimensions[i];
                const winner = scoreA > sB ? '🍎' : sB > scoreA ? '🎭' : '—';
                const maxScore = Math.max(scoreA, sB, 1);
                return `
                    <div class="arena-dimension-row">
                        <span class="arena-dim-name">${dimensionNames[i]}</span>
                        <div class="arena-dim-bar">
                            <div class="arena-dim-fill a" style="width:${(scoreA / 10) * 100}%; position:absolute; top:0;"></div>
                            <div class="arena-dim-fill b" style="width:${(sB / 10) * 100}%; position:absolute; bottom:0;"></div>
                        </div>
                        <span class="arena-dim-winner">${winner}</span>
                    </div>
                `;
            }).join('');
        }

        this.togglePanel();
    }

    async startBattle() {
        // Placeholder — will integrate with sessions_spawn
        console.log('[Arena] ⚔️ Battle requested...');
        // TODO: POST /api/arena/battle
    }

    // ── Animation Loop ───────────────────────────────
    update(delta) {
        const time = this.app.clock?.getElapsedTime() || 0;

        // Animate portal discs (swirl)
        this.portalParticles.forEach((disc, i) => {
            disc.rotation.z = time * (i === 0 ? 1.5 : -1.5);
            disc.material.opacity = disc.userData.baseOpacity + Math.sin(time * 2 + i) * 0.05;
        });

        // Flicker torches
        this.torchLights.forEach((light, i) => {
            light.intensity = 0.35 + Math.sin(time * 8 + i * 1.3) * 0.08 + Math.random() * 0.03;
        });

        // Pulse center rune
        this.group.children.forEach(child => {
            if (child.geometry?.type === 'RingGeometry' && child.material?.emissive) {
                child.material.emissiveIntensity = 0.15 + Math.sin(time * 1.5) * 0.1;
            }
        });
    }
}

// ── Auto-init ────────────────────────────────────────
window.addEventListener('load', () => {
    const waitForApp = (attempts = 0) => {
        const app = window.castleApp;
        if (app && app.scene && app.clock) {
            const arena = new MedievalArena(app);
            window.MedievalArena = arena;

            // Hook into render loop
            const origAnimate = app.animate?.bind(app);
            if (origAnimate) {
                app.animate = function() {
                    origAnimate();
                    arena.update(app.clock.getDelta());
                };
            }

            console.log('[Arena] ⚔️ Ready for battle');
        } else if (attempts < 30) {
            setTimeout(() => waitForApp(attempts + 1), 300);
        }
    };
    setTimeout(() => waitForApp(), 2500);
});

// Expose globally (non-module script — consistent with all other medieval modules)
window.MedievalArenaClass = MedievalArena;
