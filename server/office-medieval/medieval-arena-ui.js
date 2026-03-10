/**
 * Medieval Arena UI — Battle Control & History Panel
 * ═══════════════════════════════════════════════════
 * Manages battle lifecycle: template selection, live progress,
 * scoring display, and historical leaderboard.
 *
 * Integrates with: medieval-arena.js, medieval-arena-fx.js
 * @version 1.0.0
 */

(function() {
    'use strict';

    // ── Battle Templates ─────────────────────────────
    const TEMPLATES = [
        { id: 'config-fix',    name: 'Config Fix',     tier: 1, icon: '🔧', desc: 'Diagnose & fix infrastructure failure' },
        { id: 'research',      name: 'Research',       tier: 1, icon: '📚', desc: 'Compare solutions, recommend best option' },
        { id: 'bug-fix',       name: 'Bug Fix',        tier: 2, icon: '🐛', desc: 'Find root cause & fix code bug' },
        { id: 'feature-build', name: 'Feature Build',  tier: 2, icon: '🏗️', desc: 'Build a complete feature from spec' },
        { id: 'creative',      name: 'Creative Build', tier: 3, icon: '🎨', desc: 'Design & build polished visual output' },
    ];

    // ── Score Dimensions ─────────────────────────────
    // Dimensions ordered to match fleet relay arena engine output (8 dimensions)
    const DIMENSIONS = [
        { key: 'correctness',    name: 'Correctness',    weight: 22, icon: '🎯' },
        { key: 'quality',        name: 'Quality',        weight: 18, icon: '💎' },
        { key: 'speed',          name: 'Speed',          weight: 12, icon: '⚡' },
        { key: 'autonomy',       name: 'Autonomy',       weight: 14, icon: '🧭' },
        { key: 'conciseness',    name: 'Conciseness',    weight: 10, icon: '✂️' },
        { key: 'creativity',     name: 'Creativity',     weight: 12, icon: '✨' },
        { key: 'efficiency',     name: 'Efficiency',     weight: 8,  icon: '🔋' },
        { key: 'error_recovery', name: 'Recovery',       weight: 4,  icon: '🛡️' },
    ];

    // ── State ────────────────────────────────────────
    let currentBattle = null;
    let battleHistory = [];
    let leaderboard = { apomac: { wins: 0, losses: 0, draws: 0, totalScore: 0 }, sycopa: { wins: 0, losses: 0, draws: 0, totalScore: 0 } };

    // ── CSS Injection ────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .arena-templates {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 16px 0;
        }
        .arena-template-card {
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(201,169,89,0.2);
            background: rgba(22,33,62,0.3);
            cursor: pointer;
            transition: all 0.2s;
        }
        .arena-template-card:hover {
            border-color: rgba(201,169,89,0.5);
            background: rgba(22,33,62,0.5);
            transform: translateY(-2px);
        }
        .arena-template-card.selected {
            border-color: rgba(255,69,58,0.6);
            background: rgba(255,69,58,0.1);
        }
        .arena-template-icon { font-size: 20px; }
        .arena-template-name { font-size: 14px; color: #c9a959; margin: 4px 0 2px; }
        .arena-template-desc { font-size: 11px; color: rgba(244,228,188,0.5); }
        .arena-template-tier {
            display: inline-block;
            font-size: 9px;
            padding: 2px 6px;
            border-radius: 3px;
            margin-top: 4px;
        }
        .arena-template-tier.t1 { background: rgba(76,175,80,0.2); color: #4caf50; }
        .arena-template-tier.t2 { background: rgba(255,152,0,0.2); color: #ff9800; }
        .arena-template-tier.t3 { background: rgba(244,67,54,0.2); color: #f44336; }

        .arena-progress {
            margin: 16px 0;
            padding: 16px;
            border-radius: 8px;
            background: rgba(22,33,62,0.4);
            border: 1px solid rgba(201,169,89,0.2);
        }
        .arena-progress-title {
            font-size: 14px;
            color: #c9a959;
            margin-bottom: 12px;
            text-align: center;
        }
        .arena-progress-agents {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        .arena-agent-progress {
            text-align: center;
            padding: 8px;
        }
        .arena-agent-status {
            font-size: 12px;
            margin-top: 4px;
        }
        .arena-agent-status.working { color: #ff9800; }
        .arena-agent-status.done { color: #4caf50; }
        .arena-agent-status.failed { color: #f44336; }

        .arena-timer {
            text-align: center;
            font-size: 32px;
            font-family: monospace;
            color: #c9a959;
            margin: 12px 0;
            text-shadow: 0 0 8px rgba(201,169,89,0.3);
        }
        .arena-timer.warning { color: #ff9800; }
        .arena-timer.danger { color: #f44336; animation: timerPulse 0.5s infinite; }
        @keyframes timerPulse { 50% { opacity: 0.5; } }

        .arena-leaderboard {
            margin-top: 20px;
        }
        .arena-lb-row {
            display: grid;
            grid-template-columns: 40px 1fr 50px 50px 50px 60px;
            gap: 8px;
            padding: 8px;
            font-size: 12px;
            border-bottom: 1px solid rgba(201,169,89,0.1);
            align-items: center;
        }
        .arena-lb-row.header {
            color: rgba(244,228,188,0.5);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .arena-lb-rank { text-align: center; font-size: 16px; }
        .arena-lb-name { color: #c9a959; }
        .arena-lb-stat { text-align: center; }
        .arena-lb-score { text-align: center; font-weight: bold; color: #c9a959; }

        .arena-tab-bar {
            display: flex;
            gap: 0;
            margin-bottom: 16px;
            border-bottom: 1px solid rgba(201,169,89,0.2);
        }
        .arena-tab {
            padding: 8px 16px;
            font-size: 13px;
            color: rgba(244,228,188,0.5);
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
            font-family: 'Crimson Text', serif;
        }
        .arena-tab:hover { color: #f4e4bc; }
        .arena-tab.active { color: #c9a959; border-bottom-color: #c9a959; }
        .arena-tab-content { display: none; }
        .arena-tab-content.active { display: block; }
    `;
    document.head.appendChild(style);

    // ── UI Builder ───────────────────────────────────
    const ArenaUI = {
        currentTab: 'fight',
        selectedTemplate: null,

        init: function() {
            // Hijack the arena panel content
            const panel = document.getElementById('arenaPanel');
            if (!panel) return;

            panel.innerHTML = `
                <span class="arena-close" onclick="window.MedievalArena.togglePanel()">✕</span>
                <div class="arena-title">⚔️ THE ARENA ⚔️</div>

                <div class="arena-tab-bar">
                    <div class="arena-tab active" data-tab="fight" onclick="ArenaUI.switchTab('fight')">⚔️ Fight</div>
                    <div class="arena-tab" data-tab="scores" onclick="ArenaUI.switchTab('scores')">📊 Scores</div>
                    <div class="arena-tab" data-tab="history" onclick="ArenaUI.switchTab('history')">📜 History</div>
                    <div class="arena-tab" data-tab="leaderboard" onclick="ArenaUI.switchTab('leaderboard')">🏆 Leaderboard</div>
                </div>

                <div class="arena-tab-content active" id="arenaTabFight"></div>
                <div class="arena-tab-content" id="arenaTabScores"></div>
                <div class="arena-tab-content" id="arenaTabHistory"></div>
                <div class="arena-tab-content" id="arenaTabLeaderboard"></div>
            `;

            this.renderFightTab();
            this.renderLeaderboardTab();
            this.renderHistoryTab();

            console.log('[ArenaUI] 🎮 UI initialized');
        },

        switchTab: function(tab) {
            this.currentTab = tab;
            document.querySelectorAll('.arena-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
            document.querySelectorAll('.arena-tab-content').forEach(c => c.classList.remove('active'));
            var el = document.getElementById('arenaTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
            if (el) el.classList.add('active');
        },

        renderFightTab: function() {
            const container = document.getElementById('arenaTabFight');
            if (!container) return;

            if (currentBattle) {
                this._renderBattleProgress(container);
                return;
            }

            container.innerHTML = `
                <div style="margin-bottom:12px; font-size:13px; color:rgba(244,228,188,0.6); text-align:center;">
                    Choose a battle template and send your champions to fight.
                </div>
                <div class="arena-templates" id="arenaTemplates"></div>
                <div style="text-align:center; margin-top:16px;">
                    <button class="arena-btn fight" id="arenaStartBtn" onclick="ArenaUI.startBattle()" disabled>
                        ⚔️ Send Champions to Battle
                    </button>
                </div>
            `;

            const grid = document.getElementById('arenaTemplates');
            TEMPLATES.forEach(t => {
                const card = document.createElement('div');
                card.className = 'arena-template-card';
                card.dataset.id = t.id;
                card.onclick = () => this.selectTemplate(t.id);
                card.innerHTML = `
                    <div class="arena-template-icon">${t.icon}</div>
                    <div class="arena-template-name">${t.name}</div>
                    <div class="arena-template-desc">${t.desc}</div>
                    <span class="arena-template-tier t${t.tier}">Tier ${t.tier}</span>
                `;
                grid.appendChild(card);
            });
        },

        selectTemplate: function(id) {
            this.selectedTemplate = id;
            document.querySelectorAll('.arena-template-card').forEach(c => {
                c.classList.toggle('selected', c.dataset.id === id);
            });
            const btn = document.getElementById('arenaStartBtn');
            if (btn) btn.disabled = false;
        },

        startBattle: function() {
            if (!this.selectedTemplate) return;

            const template = TEMPLATES.find(t => t.id === this.selectedTemplate);
            currentBattle = {
                template: template,
                startTime: Date.now(),
                timeLimit: template.tier === 1 ? 300 : template.tier === 2 ? 600 : 1200,
                agentA: { name: 'ApoMac', emoji: '🍎', status: 'working', progress: '' },
                agentB: { name: 'Sycopa', emoji: '🎭', status: 'working', progress: '' },
            };

            // Trigger FX
            if (window.ArenaFX) window.ArenaFX.battleStart();

            this.renderFightTab();
            this._startTimer();

            console.log('[ArenaUI] ⚔️ Battle started:', template.name);
        },

        _renderBattleProgress: function(container) {
            const b = currentBattle;
            container.innerHTML = `
                <div class="arena-progress">
                    <div class="arena-progress-title">
                        ${b.template.icon} ${b.template.name} — Battle in Progress
                    </div>
                    <div class="arena-timer" id="arenaTimer">--:--</div>
                    <div class="arena-progress-agents">
                        <div class="arena-agent-progress">
                            <div style="font-size:28px">${b.agentA.emoji}</div>
                            <div style="font-size:14px; color:#c9a959">${b.agentA.name}</div>
                            <div class="arena-agent-status ${b.agentA.status}" id="arenaStatusA">
                                ${this._statusText(b.agentA.status)}
                            </div>
                        </div>
                        <div class="arena-agent-progress">
                            <div style="font-size:28px">${b.agentB.emoji}</div>
                            <div style="font-size:14px; color:#c9a959">${b.agentB.name}</div>
                            <div class="arena-agent-status ${b.agentB.status}" id="arenaStatusB">
                                ${this._statusText(b.agentB.status)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        _statusText: function(status) {
            switch(status) {
                case 'working': return '⏳ Working...';
                case 'done': return '✅ Complete';
                case 'failed': return '❌ Failed';
                case 'timeout': return '⏱️ Time exceeded';
                default: return '—';
            }
        },

        _startTimer: function() {
            const timerEl = document.getElementById('arenaTimer');
            if (!timerEl || !currentBattle) return;

            const tick = () => {
                if (!currentBattle) return;
                const elapsed = Math.floor((Date.now() - currentBattle.startTime) / 1000);
                const remaining = Math.max(0, currentBattle.timeLimit - elapsed);
                const min = Math.floor(remaining / 60);
                const sec = remaining % 60;
                timerEl.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;

                if (remaining < 30) timerEl.className = 'arena-timer danger';
                else if (remaining < 60) timerEl.className = 'arena-timer warning';
                else timerEl.className = 'arena-timer';

                if (remaining > 0) requestAnimationFrame(tick);
            };
            tick();
            setInterval(tick, 1000);
        },

        showResults: function(result) {
            // result: { agentA: { score, dimensions[] }, agentB: { score, dimensions[] }, winner }
            currentBattle = null;
            battleHistory.unshift(result);

            // Update leaderboard
            const winner = result.winner;
            if (winner === 'A') {
                leaderboard.apomac.wins++;
                leaderboard.sycopa.losses++;
            } else if (winner === 'B') {
                leaderboard.sycopa.wins++;
                leaderboard.apomac.losses++;
            } else {
                leaderboard.apomac.draws++;
                leaderboard.sycopa.draws++;
            }
            leaderboard.apomac.totalScore += result.agentA.score;
            leaderboard.sycopa.totalScore += result.agentB.score;

            // Show scores tab
            this.renderScoresTab(result);
            this.switchTab('scores');
            this.renderLeaderboardTab();
            this.renderHistoryTab();

            // Trigger FX
            if (window.ArenaFX) window.ArenaFX.battleEnd(winner);
        },

        renderScoresTab: function(result) {
            const container = document.getElementById('arenaTabScores');
            if (!container || !result) return;

            container.innerHTML = `
                <div class="arena-scoreboard">
                    <div class="arena-champion ${result.winner === 'A' ? 'winner' : 'loser'}">
                        <div class="arena-champion-emoji">${result.agentA.emoji || '🍎'}</div>
                        <div class="arena-champion-name">${result.agentA.name || 'ApoMac'}</div>
                        <div class="arena-champion-score">${result.agentA.score.toFixed(1)}</div>
                    </div>
                    <div class="arena-vs">VS</div>
                    <div class="arena-champion ${result.winner === 'B' ? 'winner' : 'loser'}">
                        <div class="arena-champion-emoji">${result.agentB.emoji || '🎭'}</div>
                        <div class="arena-champion-name">${result.agentB.name || 'Sycopa'}</div>
                        <div class="arena-champion-score">${result.agentB.score.toFixed(1)}</div>
                    </div>
                </div>
                ${DIMENSIONS.map((d, i) => {
                    const sA = result.agentA.dimensions[i] || 0;
                    const sB = result.agentB.dimensions[i] || 0;
                    const winner = sA > sB ? '🍎' : sB > sA ? '🎭' : '🤝';
                    return `
                        <div class="arena-dimension-row">
                            <span class="arena-dim-name">${d.icon} ${d.name} (${d.weight}%)</span>
                            <div class="arena-dim-bar" style="position:relative;height:12px;">
                                <div class="arena-dim-fill a" style="width:${sA*10}%;position:absolute;top:0;height:5px;"></div>
                                <div class="arena-dim-fill b" style="width:${sB*10}%;position:absolute;bottom:0;height:5px;"></div>
                            </div>
                            <span class="arena-dim-winner">${winner}</span>
                        </div>
                    `;
                }).join('')}
            `;
        },

        renderLeaderboardTab: function() {
            const container = document.getElementById('arenaTabLeaderboard');
            if (!container) return;

            const agents = Object.entries(leaderboard)
                .map(([id, s]) => ({ id, ...s, total: s.wins + s.losses + s.draws }))
                .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore);

            container.innerHTML = `
                <div class="arena-leaderboard">
                    <div class="arena-lb-row header">
                        <span></span><span>Champion</span><span>W</span><span>L</span><span>D</span><span>Avg</span>
                    </div>
                    ${agents.map((a, i) => `
                        <div class="arena-lb-row">
                            <span class="arena-lb-rank">${i === 0 ? '👑' : '⚔️'}</span>
                            <span class="arena-lb-name">${a.id === 'apomac' ? '🍎 ApoMac' : '🎭 Sycopa'}</span>
                            <span class="arena-lb-stat" style="color:#4caf50">${a.wins}</span>
                            <span class="arena-lb-stat" style="color:#f44336">${a.losses}</span>
                            <span class="arena-lb-stat">${a.draws}</span>
                            <span class="arena-lb-score">${a.total > 0 ? (a.totalScore / a.total).toFixed(1) : '—'}</span>
                        </div>
                    `).join('')}
                </div>
                ${agents[0].total === 0 ? '<div style="text-align:center;margin-top:24px;color:rgba(244,228,188,0.4);font-style:italic;">The leaderboard awaits its first battle...</div>' : ''}
            `;
        },

        renderHistoryTab: function() {
            const container = document.getElementById('arenaTabHistory');
            if (!container) return;

            if (battleHistory.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(244,228,188,0.4);font-style:italic;">No battles fought yet. The arena awaits its first champions.</div>';
                return;
            }

            container.innerHTML = battleHistory.map(b => `
                <div class="arena-history-entry">
                    <span>${b.template?.icon || '⚔️'} ${b.template?.name || 'Battle'}</span>
                    <span>${b.agentA?.emoji || '🍎'} ${b.agentA?.score?.toFixed(1) || '?'} vs ${b.agentB?.score?.toFixed(1) || '?'} ${b.agentB?.emoji || '🎭'}</span>
                    <span>${b.winner === 'A' ? '🍎 wins' : b.winner === 'B' ? '🎭 wins' : '🤝 draw'}</span>
                </div>
            `).join('');
        },
    };

    // ── Auto-init ────────────────────────────────────
    window.addEventListener('load', () => {
        const wait = (n) => {
            if (document.getElementById('arenaPanel')) {
                ArenaUI.init();
                window.ArenaUI = ArenaUI;
            } else if (n < 40) {
                setTimeout(() => wait(n + 1), 500);
            }
        };
        setTimeout(() => wait(0), 5000);
    });

})();
