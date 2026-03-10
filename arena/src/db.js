/**
 * Arena SQLite DB — schema + helpers
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'arena.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS battles (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      template TEXT NOT NULL,
      challenger_a TEXT NOT NULL,
      challenger_b TEXT NOT NULL,
      judge_model TEXT NOT NULL DEFAULT 'claude-opus',
      runs INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      winner TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS battle_runs (
      id TEXT PRIMARY KEY,
      battle_id TEXT NOT NULL,
      run_number INTEGER NOT NULL,
      agent TEXT NOT NULL,
      output TEXT,
      tokens_used INTEGER,
      latency_ms INTEGER,
      error_count INTEGER DEFAULT 0,
      tool_calls INTEGER DEFAULT 0,
      score_correctness REAL,
      score_completeness REAL,
      score_efficiency REAL,
      score_resilience REAL,
      score_total REAL,
      judge_reasoning TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY (battle_id) REFERENCES battles(id)
    );

    CREATE TABLE IF NOT EXISTS elo_ratings (
      agent TEXT NOT NULL,
      category TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 1200,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (agent, category)
    );

    CREATE TABLE IF NOT EXISTS arena_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      battle_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      ts INTEGER NOT NULL
    );
  `);
}

// ─── Battle CRUD ────────────────────────────────────────────────────────────

function createBattle({ id, task_id, template, challenger_a, challenger_b, judge_model = 'claude-opus', runs = 3 }) {
  const stmt = getDb().prepare(`
    INSERT INTO battles (id, task_id, template, challenger_a, challenger_b, judge_model, runs, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
  stmt.run(id, task_id, template, challenger_a, challenger_b, judge_model, runs, Date.now());
}

function getBattle(id) {
  return getDb().prepare('SELECT * FROM battles WHERE id = ?').get(id);
}

function listBattles({ limit = 20, status } = {}) {
  if (status) {
    return getDb().prepare('SELECT * FROM battles WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit);
  }
  return getDb().prepare('SELECT * FROM battles ORDER BY created_at DESC LIMIT ?').all(limit);
}

function updateBattleStatus(id, status, winner = null) {
  getDb().prepare(`
    UPDATE battles SET status = ?, winner = ?, completed_at = ? WHERE id = ?
  `).run(status, winner, status === 'completed' ? Date.now() : null, id);
}

// ─── Run CRUD ────────────────────────────────────────────────────────────────

function createRun({ id, battle_id, run_number, agent }) {
  getDb().prepare(`
    INSERT INTO battle_runs (id, battle_id, run_number, agent, status, started_at)
    VALUES (?, ?, ?, ?, 'running', ?)
  `).run(id, battle_id, run_number, agent, Date.now());
}

function updateRun(id, fields) {
  const keys = Object.keys(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  getDb().prepare(`UPDATE battle_runs SET ${setClause} WHERE id = ?`).run(...values, id);
}

function getRunsForBattle(battle_id) {
  return getDb().prepare('SELECT * FROM battle_runs WHERE battle_id = ? ORDER BY run_number, agent').all(battle_id);
}

// ─── ELO ────────────────────────────────────────────────────────────────────

function getElo(agent, category) {
  const row = getDb().prepare('SELECT * FROM elo_ratings WHERE agent = ? AND category = ?').get(agent, category);
  return row || { agent, category, rating: 1200, wins: 0, losses: 0, draws: 0 };
}

function updateElo(agent, category, newRating, result) {
  const winDelta = result === 'win' ? 1 : 0;
  const lossDelta = result === 'loss' ? 1 : 0;
  const drawDelta = result === 'draw' ? 1 : 0;
  getDb().prepare(`
    INSERT INTO elo_ratings (agent, category, rating, wins, losses, draws, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent, category) DO UPDATE SET
      rating = ?,
      wins = wins + ?,
      losses = losses + ?,
      draws = draws + ?,
      updated_at = ?
  `).run(agent, category, newRating, winDelta, lossDelta, drawDelta, Date.now(),
         newRating, winDelta, lossDelta, drawDelta, Date.now());
}

function getLeaderboard(category) {
  const q = category
    ? 'SELECT * FROM elo_ratings WHERE category = ? ORDER BY rating DESC'
    : 'SELECT agent, AVG(rating) as rating, SUM(wins) as wins, SUM(losses) as losses FROM elo_ratings GROUP BY agent ORDER BY rating DESC';
  return category ? getDb().prepare(q).all(category) : getDb().prepare(q).all();
}

// ─── Events ─────────────────────────────────────────────────────────────────

function logEvent(battle_id, event_type, payload) {
  getDb().prepare(`
    INSERT INTO arena_events (battle_id, event_type, payload, ts)
    VALUES (?, ?, ?, ?)
  `).run(battle_id, event_type, JSON.stringify(payload), Date.now());
}

function getEvents(battle_id, since = 0) {
  return getDb().prepare(`
    SELECT * FROM arena_events WHERE battle_id = ? AND id > ? ORDER BY id ASC
  `).all(battle_id, since);
}

module.exports = {
  getDb, createBattle, getBattle, listBattles, updateBattleStatus,
  createRun, updateRun, getRunsForBattle,
  getElo, updateElo, getLeaderboard,
  logEvent, getEvents,
};
