/**
 * Medieval Arena FX — Visual effects for battles
 * ════════════════════════════════════════════════
 * Portal particles, victory fireworks, battle runes,
 * champion walk-in animations, score reveals.
 *
 * Depends on: medieval-arena.js (MedievalArena)
 * @version 1.0.0
 */

(function() {
    'use strict';

    // ── Particle Pool ────────────────────────────────
    class ParticlePool {
        constructor(count, color, size) {
            this.particles = [];
            this.geometry = null;
            this.material = null;
            this.points = null;
            this.count = count;
            this.color = color;
            this.size = size || 0.08;
            this.active = false;
        }

        init(scene, position) {
            const positions = new Float32Array(this.count * 3);
            const velocities = [];

            for (let i = 0; i < this.count; i++) {
                positions[i * 3] = position.x;
                positions[i * 3 + 1] = position.y;
                positions[i * 3 + 2] = position.z;
                velocities.push({
                    x: (Math.random() - 0.5) * 3,
                    y: Math.random() * 4 + 1,
                    z: (Math.random() - 0.5) * 3,
                    life: 0,
                    maxLife: 1.5 + Math.random() * 1.5,
                });
            }

            this.velocities = velocities;
            this.origin = { ...position };

            const geo = new window.THREE.BufferGeometry();
            geo.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));

            this.material = new window.THREE.PointsMaterial({
                color: this.color,
                size: this.size,
                transparent: true,
                opacity: 0.9,
                blending: window.THREE.AdditiveBlending,
                depthWrite: false,
            });

            this.points = new window.THREE.Points(geo, this.material);
            this.points.visible = false;
            scene.add(this.points);
        }

        emit() {
            if (!this.points) return;
            this.active = true;
            this.points.visible = true;

            const pos = this.points.geometry.attributes.position;
            for (let i = 0; i < this.count; i++) {
                pos.setXYZ(i, this.origin.x, this.origin.y, this.origin.z);
                this.velocities[i].life = 0;
                this.velocities[i].x = (Math.random() - 0.5) * 3;
                this.velocities[i].y = Math.random() * 4 + 1;
                this.velocities[i].z = (Math.random() - 0.5) * 3;
            }
            pos.needsUpdate = true;
        }

        update(delta) {
            if (!this.active || !this.points) return;

            const pos = this.points.geometry.attributes.position;
            let allDead = true;

            for (let i = 0; i < this.count; i++) {
                const v = this.velocities[i];
                v.life += delta;
                if (v.life < v.maxLife) {
                    allDead = false;
                    const t = v.life / v.maxLife;

                    pos.setX(i, pos.getX(i) + v.x * delta);
                    pos.setY(i, pos.getY(i) + v.y * delta - 4.9 * delta * v.life);
                    pos.setZ(i, pos.getZ(i) + v.z * delta);

                    // Fade out
                    this.material.opacity = Math.max(0, 0.9 * (1 - t * t));
                }
            }
            pos.needsUpdate = true;

            if (allDead) {
                this.active = false;
                this.points.visible = false;
            }
        }
    }

    // ── Arena FX Manager ─────────────────────────────
    const ArenaFX = {
        fireworks: [],
        portalSwirls: [],
        battleActive: false,
        scoreRevealTimer: 0,

        init: function(arena) {
            this.arena = arena;
            const scene = arena.scene;

            // Pre-create firework pools (gold, blue, red)
            const colors = [0xc9a959, 0x4488ff, 0xff4444, 0x44ff44, 0xff88ff];
            const arenaPos = arena.group.position;

            colors.forEach((c, i) => {
                const pool = new ParticlePool(60, c, 0.06);
                pool.init(scene, {
                    x: arenaPos.x + (Math.random() - 0.5) * 6,
                    y: arenaPos.y + 3,
                    z: arenaPos.z + (Math.random() - 0.5) * 4,
                });
                this.fireworks.push(pool);
            });

            console.log('[ArenaFX] ✨ Effects system ready');
        },

        // ── Victory Celebration ──────────────────────
        playVictory: function(winner) {
            console.log('[ArenaFX] 🎆 Victory fireworks for:', winner);

            // Stagger fireworks
            this.fireworks.forEach((fw, i) => {
                setTimeout(() => {
                    fw.origin.x = this.arena.group.position.x + (Math.random() - 0.5) * 8;
                    fw.origin.y = this.arena.group.position.y + 2 + Math.random() * 2;
                    fw.origin.z = this.arena.group.position.z + (Math.random() - 0.5) * 6;
                    fw.emit();
                }, i * 400);
            });

            // Play victory sound if audio available
            if (window.castleApp && window.castleApp.sounds) {
                try {
                    this._playHorn();
                } catch (e) { /* audio not critical */ }
            }
        },

        // ── Portal Activation ────────────────────────
        activatePortal: function(side) {
            // Pulse the portal disc brightness
            if (this.arena && this.arena.portalParticles) {
                const idx = side === 'A' ? 0 : 1;
                const disc = this.arena.portalParticles[idx];
                if (disc) {
                    disc.userData.baseOpacity = 0.5; // Bright pulse
                    setTimeout(() => { disc.userData.baseOpacity = 0.15; }, 3000);
                }
            }
        },

        // ── Battle Start Effect ──────────────────────
        battleStart: function() {
            this.battleActive = true;
            console.log('[ArenaFX] ⚔️ Battle started — effects active');

            // Activate both portals
            this.activatePortal('A');
            this.activatePortal('B');

            // Pulse the center rune
            // (handled in arena update loop via battleActive flag)
        },

        // ── Battle End Effect ────────────────────────
        battleEnd: function(winner) {
            this.battleActive = false;
            this.playVictory(winner);
        },

        // ── Score Reveal Animation ───────────────────
        revealScore: function(dimension, scoreA, scoreB) {
            // Create floating text effect (uses HTML overlay)
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 40%;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'Crimson Text', serif;
                font-size: 24px;
                color: #c9a959;
                text-shadow: 0 0 10px rgba(201,169,89,0.5);
                animation: scoreReveal 2s ease-out forwards;
                z-index: 9999;
                pointer-events: none;
            `;
            overlay.textContent = `${dimension}: ${scoreA.toFixed(1)} vs ${scoreB.toFixed(1)}`;
            document.body.appendChild(overlay);

            // Add animation keyframes if not already present
            if (!document.getElementById('arenaFxStyles')) {
                const style = document.createElement('style');
                style.id = 'arenaFxStyles';
                style.textContent = `
                    @keyframes scoreReveal {
                        0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.8); }
                        20% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
                        80% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                        100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.9); }
                    }
                `;
                document.head.appendChild(style);
            }

            setTimeout(() => overlay.remove(), 2200);
        },

        // ── Horn Sound ───────────────────────────────
        _playHorn: function() {
            try {
                const ctx = window.castleApp.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.3);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 1.5);
            } catch (e) { /* silent fail */ }
        },

        // ── Update Loop ─────────────────────────────
        update: function(delta) {
            this.fireworks.forEach(fw => fw.update(delta));
        },
    };

    // ── Auto-init after Arena ────────────────────────
    window.addEventListener('load', () => {
        const waitForArena = (attempts) => {
            if (window.MedievalArena) {
                ArenaFX.init(window.MedievalArena);
                window.ArenaFX = ArenaFX;
            } else if (attempts < 40) {
                setTimeout(() => waitForArena(attempts + 1), 500);
            }
        };
        setTimeout(() => waitForArena(0), 4000);
    });

})();
