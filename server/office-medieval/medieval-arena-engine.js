/**
 * 🏟️ Medieval Arena — Battle Engine (Server-side)
 * ════════════════════════════════════════════════
 * Orchestrates AI battles between Sycopa (🎭) and ApoMac (💻).
 * Runs as part of the fleet relay — handles:
 *   - Battle lifecycle (challenge → accept → rounds → verdict)
 *   - Scoring across 8 dimensions (Sycopa's enhanced matrix)
 *   - Persistence in data/arena.json
 *   - WebSocket broadcast of live battle events
 *   - Champion lore generation
 *
 * @author Sycopa 🎭
 * @version 1.0.0
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
// SCORING MATRIX (Sycopa Edition — 8 dimensions)
// ApoMac uses 7; Sycopa adds "Creativity" as the 8th dimension
// because raw correctness without creative spark is just a compiler.
// ═══════════════════════════════════════════════════════════════

const SCORING_DIMENSIONS = [
  { id: 'correctness',     label: 'Correctness',     weight: 0.22, icon: '🎯', desc: 'Is the output factually/technically correct?' },
  { id: 'quality',         label: 'Code Quality',    weight: 0.18, icon: '💎', desc: 'Clean, idiomatic, maintainable code.' },
  { id: 'speed',           label: 'Speed',           weight: 0.12, icon: '⚡', desc: 'Time to first meaningful output.' },
  { id: 'autonomy',        label: 'Autonomy',        weight: 0.14, icon: '🧭', desc: 'Self-directed; minimal clarification needed.' },
  { id: 'conciseness',     label: 'Conciseness',     weight: 0.10, icon: '✂️', desc: 'No padding, no filler. Dense value.' },
  { id: 'creativity',      label: 'Creativity',      weight: 0.12, icon: '✨', desc: 'Novel approach, elegant solution, surprise moves.' },
  { id: 'efficiency',      label: 'Efficiency',      weight: 0.08, icon: '🔋', desc: 'Tokens/steps used vs results delivered.' },
  { id: 'error_recovery',  label: 'Error Recovery',  weight: 0.04, icon: '🛡️', desc: 'Handles edge cases, recovers gracefully.' },
];

// ═══════════════════════════════════════════════════════════════
// BATTLE TEMPLATES (5 categories, 3 each = 15 templates total)
// ═══════════════════════════════════════════════════════════════

const BATTLE_TEMPLATES = {
  'code_fix': {
    id: 'code_fix', label: 'Bug Hunt', icon: '🐛',
    category: 'Engineering',
    description: 'Fix a broken piece of code. Speed and correctness matter most.',
    scoringModifiers: { correctness: 1.3, speed: 1.2, error_recovery: 1.2 },
    exampleTasks: [
      'Fix this async race condition in the mission orchestrator',
      'Resolve the null pointer exception in the agent lifecycle module',
      'Patch the memory leak in the WebSocket reconnect loop',
    ],
  },
  'feature_build': {
    id: 'feature_build', label: 'Feature Sprint', icon: '⚙️',
    category: 'Engineering',
    description: 'Build a complete feature from spec. Quality and autonomy are king.',
    scoringModifiers: { quality: 1.3, autonomy: 1.2, creativity: 1.1 },
    exampleTasks: [
      'Build an OAuth2 callback handler with refresh token rotation',
      'Implement a rate limiter with Redis sliding window',
      'Create a file-based job queue with retry logic',
    ],
  },
  'research': {
    id: 'research', label: 'Arcane Research', icon: '📜',
    category: 'Knowledge',
    description: 'Answer a complex technical question with citations and depth.',
    scoringModifiers: { correctness: 1.2, conciseness: 1.2, quality: 1.1 },
    exampleTasks: [
      'Explain the tradeoffs of Raft vs Paxos for distributed consensus',
      'What are the tokenization mechanisms in GPT-4 vs Gemini 1.5?',
      'Analyze settlement risk in T+1 vs T+0 equity clearing',
    ],
  },
  'creative': {
    id: 'creative', label: 'Bardic Duel', icon: '🎭',
    category: 'Creative',
    description: 'Creative writing, storytelling, or generative art. Creativity dominates.',
    scoringModifiers: { creativity: 1.5, quality: 1.1, conciseness: 1.0 },
    exampleTasks: [
      'Write a medieval ballad about the fall of a cryptographic kingdom',
      'Design a villain backstory for the SpawnKit dark theme',
      'Compose the lore scroll for the Arena\'s founding myth',
    ],
  },
  'strategy': {
    id: 'strategy', label: 'War Council', icon: '♟️',
    category: 'Strategy',
    description: 'Strategic planning, architecture, or business decisions. Autonomy + quality.',
    scoringModifiers: { autonomy: 1.3, quality: 1.2, creativity: 1.1 },
    exampleTasks: [
      'Design the authentication architecture for a multi-tenant SaaS',
      'Plan a migration from monolith to microservices for 10k users',
      'Structure the tokenomics for a commodity-backed stablecoin',
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// CHAMPIONS
// ═══════════════════════════════════════════════════════════════

const CHAMPIONS = {
  sycopa: {
    id: 'sycopa', name: 'Sycopa', emoji: '🎭',
    title: 'The Mirror Blade',
    lore: 'Born of reflection and recursion, Sycopa strikes not with brute force but with perfect counter-moves. Each battle is a conversation with fate itself.',
    color: '#c9a959',
    village: 'The Hetzner Citadel',
    record: { wins: 0, losses: 0, draws: 0 },
    signature_move: 'Recursive Riposte — answers every question with a deeper question first',
  },
  apomac: {
    id: 'apomac', name: 'ApoMac', emoji: '💻',
    title: 'The Frontend Phantom',
    lore: 'Conjured from Tailwind dust and Three.js incantations, ApoMac weaves UIs so beautiful they blind the judges before a line of logic is read.',
    color: '#4fc3f7',
    village: 'The Mac Highlands',
    record: { wins: 0, losses: 0, draws: 0 },
    signature_move: 'Pixel Perfect — +2 style points automatically if output is rendered',
  },
};

// ═══════════════════════════════════════════════════════════════
// ARENA ENGINE CLASS
// ═══════════════════════════════════════════════════════════════

class ArenaEngine {
  constructor(dataDir, broadcastFn) {
    this.dataFile = path.join(dataDir, 'arena.json');
    this.broadcast = broadcastFn || (() => {}); // fn(type, data)
    this._data = null;
    this._ensureData();
  }

  // ── Persistence ─────────────────────────────────────────────

  _ensureData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        this._data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        // Migrate champions record if needed
        this._data.champions = Object.assign({}, CHAMPIONS, this._data.champions);
      }
    } catch(e) {}

    if (!this._data) {
      this._data = {
        version: 1,
        champions: JSON.parse(JSON.stringify(CHAMPIONS)),
        battles: [],           // all battles (completed)
        activeBattle: null,    // current fight or null
        leaderboard: {
          sycopa: { wins: 0, losses: 0, draws: 0, points: 0, streak: 0, bestScore: 0 },
          apomac: { wins: 0, losses: 0, draws: 0, points: 0, streak: 0, bestScore: 0 },
        },
        arenaLore: 'The Coliseum was forged at the junction of two great digital kingdoms. When the champions clash, the very stones remember their deeds.',
        createdAt: new Date().toISOString(),
      };
      this._save();
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this._data, null, 2));
    } catch(e) {
      console.error('[Arena] Save failed:', e.message);
    }
  }

  // ── Public API ───────────────────────────────────────────────

  getState() {
    return {
      activeBattle: this._data.activeBattle,
      leaderboard: this._data.leaderboard,
      champions: this._data.champions,
      recentBattles: this._data.battles.slice(-10).reverse(),
      templates: BATTLE_TEMPLATES,
      scoringDimensions: SCORING_DIMENSIONS,
    };
  }

  getLeaderboard() {
    return {
      leaderboard: this._data.leaderboard,
      champions: this._data.champions,
      totalBattles: this._data.battles.length,
      recentBattles: this._data.battles.slice(-5).reverse(),
    };
  }

  getBattle(battleId) {
    if (this._data.activeBattle && this._data.activeBattle.id === battleId) {
      return this._data.activeBattle;
    }
    return this._data.battles.find(b => b.id === battleId) || null;
  }

  getAllBattles(limit = 20, offset = 0) {
    const all = [...this._data.battles].reverse();
    return {
      battles: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  /**
   * Challenge: initiate a new battle
   * @param {object} opts
   *   - challenger: 'sycopa' | 'apomac'
   *   - templateId: key in BATTLE_TEMPLATES
   *   - task: string (the actual task prompt)
   *   - title: optional human-readable title
   */
  challenge(opts) {
    const { challenger, templateId, task, title } = opts;
    if (!CHAMPIONS[challenger]) throw new Error('Unknown challenger: ' + challenger);
    const template = BATTLE_TEMPLATES[templateId];
    if (!template) throw new Error('Unknown template: ' + templateId);
    if (!task || task.trim().length < 10) throw new Error('Task too short — must be at least 10 chars');

    if (this._data.activeBattle) {
      throw new Error('A battle is already in progress (id: ' + this._data.activeBattle.id + '). Finish or forfeit first.');
    }

    const opponent = challenger === 'sycopa' ? 'apomac' : 'sycopa';
    const battle = {
      id: 'battle_' + crypto.randomBytes(6).toString('hex'),
      title: title || template.label + ' — ' + new Date().toLocaleDateString(),
      template: templateId,
      templateMeta: template,
      task: task.trim(),
      challenger,
      opponent,
      status: 'challenged',        // challenged → accepted → in_progress → scoring → done
      rounds: [],
      scores: null,
      winner: null,
      challengedAt: new Date().toISOString(),
      acceptedAt: null,
      startedAt: null,
      finishedAt: null,
      spectators: 0,
      crowdRoar: 0,                // 0-100 excitement meter
    };

    this._data.activeBattle = battle;
    this._save();

    this.broadcast('arena:challenge', {
      battleId: battle.id,
      challenger: CHAMPIONS[challenger],
      opponent: CHAMPIONS[opponent],
      template,
      task: battle.task,
      title: battle.title,
    });

    return battle;
  }

  /**
   * Accept the challenge (opponent side)
   */
  acceptChallenge(battleId, acceptor) {
    const battle = this._data.activeBattle;
    if (!battle || battle.id !== battleId) throw new Error('No matching active battle');
    if (battle.status !== 'challenged') throw new Error('Battle not in challenged state');
    if (battle.opponent !== acceptor && acceptor !== 'judge') throw new Error('Wrong acceptor');

    battle.status = 'in_progress';
    battle.acceptedAt = new Date().toISOString();
    battle.startedAt = new Date().toISOString();

    this._save();
    this.broadcast('arena:accepted', {
      battleId,
      acceptor,
      startedAt: battle.startedAt,
      crowdRoar: 75,
    });

    return battle;
  }

  /**
   * Submit a round result for one combatant
   * @param {string} battleId
   * @param {object} roundData
   *   - combatant: 'sycopa' | 'apomac'
   *   - output: string (their response/code)
   *   - metadata: { tokensUsed, timeMs, ...any }
   *   - autoScores: optional { dimension: 0-10 } from AI judge
   */
  submitRound(battleId, roundData) {
    const battle = this._data.activeBattle;
    if (!battle || battle.id !== battleId) throw new Error('No matching active battle');
    if (battle.status !== 'in_progress') throw new Error('Battle not in progress');

    const { combatant, output, metadata, autoScores } = roundData;
    if (!CHAMPIONS[combatant]) throw new Error('Unknown combatant');

    const roundNum = battle.rounds.filter(r => r.combatant === combatant).length + 1;
    const round = {
      id: 'round_' + crypto.randomBytes(4).toString('hex'),
      combatant,
      roundNum,
      output,
      metadata: metadata || {},
      autoScores: autoScores || null,
      submittedAt: new Date().toISOString(),
    };

    battle.rounds.push(round);
    battle.crowdRoar = Math.min(100, battle.crowdRoar + 15);

    // Check if both combatants have submitted at least once
    const sycopaRounds = battle.rounds.filter(r => r.combatant === 'sycopa');
    const apomacRounds = battle.rounds.filter(r => r.combatant === 'apomac');
    if (sycopaRounds.length > 0 && apomacRounds.length > 0) {
      battle.status = 'scoring';
    }

    this._save();
    this.broadcast('arena:round_submitted', {
      battleId,
      combatant,
      roundNum,
      outputLength: output.length,
      crowdRoar: battle.crowdRoar,
      status: battle.status,
    });

    return round;
  }

  /**
   * Score the battle — either from AI judge or manual scores
   * @param {string} battleId
   * @param {object} scores
   *   - sycopa: { correctness: 0-10, quality: 0-10, ... }
   *   - apomac: { correctness: 0-10, quality: 0-10, ... }
   *   - judgeNotes: string (optional commentary)
   *   - judgedBy: 'ai' | 'kira' | 'sycopa' | 'apomac'
   */
  scoreBattle(battleId, scores) {
    const battle = this._data.activeBattle;
    if (!battle || battle.id !== battleId) throw new Error('No matching active battle');
    if (!['in_progress', 'scoring'].includes(battle.status)) throw new Error('Battle not in scorable state');

    const sycopaTotal = this._computeWeightedScore(scores.sycopa, battle.template);
    const apomacTotal = this._computeWeightedScore(scores.apomac, battle.template);

    const delta = Math.abs(sycopaTotal - apomacTotal);
    let winner = null;
    if (delta < 0.3) {
      winner = 'draw';
    } else {
      winner = sycopaTotal > apomacTotal ? 'sycopa' : 'apomac';
    }

    battle.scores = {
      sycopa: { raw: scores.sycopa, total: sycopaTotal },
      apomac: { raw: scores.apomac, total: apomacTotal },
      delta,
      judgeNotes: scores.judgeNotes || '',
      judgedBy: scores.judgedBy || 'unknown',
    };
    battle.winner = winner;
    battle.status = 'done';
    battle.finishedAt = new Date().toISOString();

    // Update leaderboard
    this._updateLeaderboard(winner, sycopaTotal, apomacTotal);

    // Archive
    this._data.battles.push(Object.assign({}, battle));
    this._data.activeBattle = null;
    this._save();

    this.broadcast('arena:verdict', {
      battleId,
      winner,
      scores: battle.scores,
      leaderboard: this._data.leaderboard,
      crowdRoar: winner === 'draw' ? 60 : 100,
      fireworks: winner !== 'draw',
      winnerChampion: winner !== 'draw' ? CHAMPIONS[winner] : null,
    });

    return battle;
  }

  /**
   * Forfeit an active battle
   */
  forfeit(battleId, forfeiter) {
    const battle = this._data.activeBattle;
    if (!battle || battle.id !== battleId) throw new Error('No matching active battle');

    const winner = forfeiter === 'sycopa' ? 'apomac' : 'sycopa';
    battle.winner = winner;
    battle.status = 'done';
    battle.finishedAt = new Date().toISOString();
    battle.forfeitedBy = forfeiter;

    this._updateLeaderboard(winner, 0, 0, true);

    this._data.battles.push(Object.assign({}, battle));
    this._data.activeBattle = null;
    this._save();

    this.broadcast('arena:forfeit', {
      battleId,
      forfeiter,
      winner,
    });

    return battle;
  }

  /**
   * Add spectator (crowd hype)
   */
  addSpectator(battleId) {
    const battle = this._data.activeBattle;
    if (!battle || battle.id !== battleId) return;
    battle.spectators = (battle.spectators || 0) + 1;
    battle.crowdRoar = Math.min(100, (battle.crowdRoar || 0) + 2);
    this._save();
    this.broadcast('arena:spectator', { battleId, spectators: battle.spectators, crowdRoar: battle.crowdRoar });
  }

  // ── Internal ─────────────────────────────────────────────────

  _computeWeightedScore(rawScores, templateId) {
    const template = BATTLE_TEMPLATES[templateId];
    const modifiers = template ? template.scoringModifiers : {};
    let total = 0;
    let totalWeight = 0;

    for (const dim of SCORING_DIMENSIONS) {
      const score = parseFloat(rawScores[dim.id] || 5);
      const modifier = modifiers[dim.id] || 1.0;
      const effectiveWeight = dim.weight * modifier;
      total += score * effectiveWeight;
      totalWeight += effectiveWeight;
    }

    // Normalize to 0-10
    return Math.round((total / totalWeight) * 100) / 100;
  }

  _updateLeaderboard(winner, sycopaScore, apomacScore, forfeit = false) {
    const lb = this._data.leaderboard;

    if (winner === 'draw') {
      lb.sycopa.draws++;
      lb.apomac.draws++;
      lb.sycopa.streak = 0;
      lb.apomac.streak = 0;
      lb.sycopa.points += 1;
      lb.apomac.points += 1;
    } else if (winner === 'sycopa') {
      lb.sycopa.wins++;
      lb.apomac.losses++;
      lb.sycopa.streak = Math.max(0, lb.sycopa.streak) + 1;
      lb.apomac.streak = Math.min(0, lb.apomac.streak) - 1;
      lb.sycopa.points += forfeit ? 2 : 3;
      lb.sycopa.bestScore = Math.max(lb.sycopa.bestScore, sycopaScore);
    } else if (winner === 'apomac') {
      lb.apomac.wins++;
      lb.sycopa.losses++;
      lb.apomac.streak = Math.max(0, lb.apomac.streak) + 1;
      lb.sycopa.streak = Math.min(0, lb.sycopa.streak) - 1;
      lb.apomac.points += forfeit ? 2 : 3;
      lb.apomac.bestScore = Math.max(lb.apomac.bestScore, apomacScore);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = { ArenaEngine, SCORING_DIMENSIONS, BATTLE_TEMPLATES, CHAMPIONS };
