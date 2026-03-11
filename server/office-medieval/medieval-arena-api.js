/**
 * 🏟️ Medieval Arena — REST API Routes
 * ════════════════════════════════════
 * Drop-in route handler for the fleet relay or SpawnKit server.
 * Mount by calling: ArenaAPI.handleRequest(req, res, body)
 *
 * Routes:
 *   GET  /api/arena/state              — full arena state
 *   GET  /api/arena/leaderboard        — leaderboard + champions
 *   GET  /api/arena/battles            — paginated battle history
 *   GET  /api/arena/battle/:id         — single battle
 *   GET  /api/arena/templates          — available battle templates
 *   GET  /api/arena/scoring            — scoring matrix
 *   POST /api/arena/challenge          — start a battle
 *   POST /api/arena/accept             — accept challenge
 *   POST /api/arena/round              — submit a round
 *   POST /api/arena/score              — judge & finalize
 *   POST /api/arena/forfeit            — forfeit
 *   POST /api/arena/spectate           — add spectator event
 *
 * @author Sycopa 🎭
 * @version 1.0.0
 */

'use strict';

const { ArenaEngine, BATTLE_TEMPLATES, SCORING_DIMENSIONS } = require('./medieval-arena-engine');

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function err(res, status, msg) {
  json(res, status, { ok: false, error: msg });
}

class ArenaAPI {
  /**
   * @param {object} opts
   *   - dataDir: string — where to persist arena.json
   *   - broadcastFn: function(type, data) — broadcast to WS clients
   */
  constructor(opts) {
    this.engine = new ArenaEngine(opts.dataDir, opts.broadcastFn);
  }

  /**
   * Handle incoming HTTP request.
   * Returns true if the route matched, false otherwise.
   */
  handleRequest(req, res, body) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS' && pathname.startsWith('/api/arena')) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      });
      res.end();
      return true;
    }

    // ── GET routes ──────────────────────────────────────────────

    if (pathname === '/api/arena/state' && method === 'GET') {
      try {
        json(res, 200, { ok: true, data: this.engine.getState() });
      } catch(e) { err(res, 500, e.message); }
      return true;
    }

    if (pathname === '/api/arena/leaderboard' && method === 'GET') {
      try {
        json(res, 200, { ok: true, data: this.engine.getLeaderboard() });
      } catch(e) { err(res, 500, e.message); }
      return true;
    }

    if (pathname === '/api/arena/battles' && method === 'GET') {
      try {
        const limit  = parseInt(url.searchParams.get('limit') || '20', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);
        json(res, 200, { ok: true, data: this.engine.getAllBattles(limit, offset) });
      } catch(e) { err(res, 500, e.message); }
      return true;
    }

    const battleMatch = pathname.match(/^\/api\/arena\/battle\/([a-zA-Z0-9_-]+)$/);
    if (battleMatch && method === 'GET') {
      try {
        const b = this.engine.getBattle(battleMatch[1]);
        if (!b) return (err(res, 404, 'Battle not found'), true);
        json(res, 200, { ok: true, data: b });
      } catch(e) { err(res, 500, e.message); }
      return true;
    }

    if (pathname === '/api/arena/templates' && method === 'GET') {
      json(res, 200, { ok: true, data: BATTLE_TEMPLATES });
      return true;
    }

    if (pathname === '/api/arena/scoring' && method === 'GET') {
      json(res, 200, { ok: true, data: SCORING_DIMENSIONS });
      return true;
    }

    // ── POST routes ─────────────────────────────────────────────

    if (pathname === '/api/arena/challenge' && method === 'POST') {
      try {
        const battle = this.engine.challenge(body);
        json(res, 201, { ok: true, data: battle });
      } catch(e) { err(res, 400, e.message); }
      return true;
    }

    if (pathname === '/api/arena/accept' && method === 'POST') {
      try {
        const { battleId, acceptor } = body;
        const battle = this.engine.acceptChallenge(battleId, acceptor);
        json(res, 200, { ok: true, data: battle });
      } catch(e) { err(res, 400, e.message); }
      return true;
    }

    if (pathname === '/api/arena/round' && method === 'POST') {
      try {
        const { battleId, ...roundData } = body;
        const round = this.engine.submitRound(battleId, roundData);
        json(res, 200, { ok: true, data: round });
      } catch(e) { err(res, 400, e.message); }
      return true;
    }

    if (pathname === '/api/arena/score' && method === 'POST') {
      try {
        const { battleId, ...scores } = body;
        const battle = this.engine.scoreBattle(battleId, scores);
        json(res, 200, { ok: true, data: battle });
      } catch(e) { err(res, 400, e.message); }
      return true;
    }

    if (pathname === '/api/arena/forfeit' && method === 'POST') {
      try {
        const { battleId, forfeiter } = body;
        const battle = this.engine.forfeit(battleId, forfeiter);
        json(res, 200, { ok: true, data: battle });
      } catch(e) { err(res, 400, e.message); }
      return true;
    }

    if (pathname === '/api/arena/spectate' && method === 'POST') {
      try {
        const { battleId } = body;
        this.engine.addSpectator(battleId);
        json(res, 200, { ok: true });
      } catch(e) { err(res, 400, e.message); }
      return true;
    }

    if (pathname === '/api/arena/auto-judge' && method === 'POST') {
      if (typeof this.engine.autoJudgeBattle !== 'function') {
        err(res, 501, 'Auto-judge not available on this engine version');
        return true;
      }
      const { battleId } = body;
      if (!battleId) { err(res, 400, 'Missing battleId'); return true; }
      this.engine.autoJudgeBattle(battleId)
        .then(battle => json(res, 200, { ok: true, data: battle }))
        .catch(e => err(res, 400, e.message));
      return true;
    }

    return false; // route not matched
  }
}

module.exports = { ArenaAPI };
