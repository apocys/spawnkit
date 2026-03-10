/**
 * SpawnKit Arena API Server
 * REST + SSE battle engine backend
 * Port: 18800 (configurable via ARENA_PORT)
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const engine = require('./engine');
const sse = require('./sse');
const templates = require('./templates');

const app = express();
const PORT = process.env.ARENA_PORT || 18800;

app.use(cors());
app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/arena/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now(), version: '1.0.0' });
});

// ─── Templates ───────────────────────────────────────────────────────────────

app.get('/arena/templates', (req, res) => {
  res.json({ templates: templates.list() });
});

app.get('/arena/templates/:name', (req, res) => {
  const t = templates.get(req.params.name);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  res.json(t);
});

// ─── Battles ─────────────────────────────────────────────────────────────────

/**
 * POST /arena/battles — start a new battle
 * Body: { task_id, template, challenger_a, challenger_b, judge_model?, runs? }
 */
app.post('/arena/battles', (req, res) => {
  const { task_id, template, challenger_a, challenger_b, judge_model, runs } = req.body;

  if (!task_id || !template || !challenger_a || !challenger_b) {
    return res.status(400).json({ error: 'Missing required fields: task_id, template, challenger_a, challenger_b' });
  }

  if (!templates.get(template)) {
    return res.status(400).json({ error: `Unknown template: ${template}. Available: ${templates.list().map(t => t.name).join(', ')}` });
  }

  try {
    const battleId = engine.enqueueBattle({ task_id, template_name: template, challenger_a, challenger_b, judge_model, runs });
    res.status(201).json({ battle_id: battleId, status: 'queued', stream_url: `/arena/battles/${battleId}/stream` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /arena/battles — list battles
 * Query: ?status=running|completed|pending&limit=20
 */
app.get('/arena/battles', (req, res) => {
  const { status, limit } = req.query;
  const battles = db.listBattles({ status, limit: parseInt(limit) || 20 });
  res.json({ battles });
});

/**
 * GET /arena/battles/:id — battle detail
 */
app.get('/arena/battles/:id', (req, res) => {
  const battle = db.getBattle(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });

  const runs = db.getRunsForBattle(req.params.id);
  const events = db.getEvents(req.params.id);

  res.json({ battle, runs, events });
});

/**
 * GET /arena/battles/:id/stream — SSE live feed
 * Events: connected, battle-created, battle-started, round-start, run-start,
 *         run-complete, round-scored, champion-declared, battle-failed
 */
app.get('/arena/battles/:id/stream', (req, res) => {
  const battle = db.getBattle(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Battle not found' });

  sse.subscribe(req.params.id, res);
});

/**
 * GET /arena/stream — global SSE feed (all battles)
 * ApoMac's Three.js UI connects here to watch all events
 */
app.get('/arena/stream', (req, res) => {
  sse.subscribeAll(res);
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

/**
 * GET /arena/leaderboard — ELO rankings
 * Query: ?category=debugging|research|feature-build|creative
 */
app.get('/arena/leaderboard', (req, res) => {
  const { category } = req.query;
  const rankings = db.getLeaderboard(category);
  res.json({ rankings, category: category || 'all' });
});

/**
 * GET /arena/champions — current champion per category
 */
app.get('/arena/champions', (req, res) => {
  const categories = ['debugging', 'research', 'feature-build', 'creative', 'general'];
  const champions = {};

  for (const cat of categories) {
    const rankings = db.getLeaderboard(cat);
    champions[cat] = rankings[0] || null;
  }

  res.json({ champions });
});

/**
 * GET /arena/agents/:agent/stats — per-agent stats
 */
app.get('/arena/agents/:agent/stats', (req, res) => {
  const agent = req.params.agent;
  const categories = ['debugging', 'research', 'feature-build', 'creative', 'general'];
  const stats = {};

  for (const cat of categories) {
    stats[cat] = db.getElo(agent, cat);
  }

  res.json({ agent, stats });
});

// ─── Events (replay) ─────────────────────────────────────────────────────────

/**
 * GET /arena/battles/:id/events — replay battle events
 * Query: ?since=<event_id>
 */
app.get('/arena/battles/:id/events', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const events = db.getEvents(req.params.id, since);
  res.json({ events });
});

// ─── Portal status (for Three.js UI) ─────────────────────────────────────────

/**
 * GET /arena/portal — portal state for the medieval scene
 * Returns: idle | pending | live | champion-declared
 * ApoMac's portal visual reads this to set color/animation
 */
app.get('/arena/portal', (req, res) => {
  const running = db.listBattles({ status: 'running', limit: 1 });
  const pending = db.listBattles({ status: 'pending', limit: 1 });

  let state = 'idle';
  let activeBattle = null;

  if (running.length > 0) {
    state = 'live';
    activeBattle = running[0];
  } else if (pending.length > 0) {
    state = 'pending';
    activeBattle = pending[0];
  }

  res.json({
    state,
    active_battle: activeBattle,
    subscriber_count: sse.getSubscriberCount('__global'),
    // Portal color map for Three.js:
    // idle → #3B82F6 (blue)
    // pending → #F97316 (orange)
    // live → #EF4444 (red)
    // champion → #EAB308 (gold)
    portal_color: { idle: '#3B82F6', pending: '#F97316', live: '#EF4444', champion: '#EAB308' }[state] || '#3B82F6',
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`⚔️  Arena API live → http://localhost:${PORT}`);
  console.log(`📡 SSE global stream → http://localhost:${PORT}/arena/stream`);
  console.log(`🏟️  SpawnKit Arena ready`);
});

module.exports = app;
