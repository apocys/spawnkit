/**
 * Battle Engine — orchestrates battle lifecycle
 * battle dispatch → task runner → judge → score ledger → ELO update → events
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const scoring = require('./scoring');
const { broadcast } = require('./sse');
const templates = require('./templates');

// In-memory queue of pending battles
const queue = [];
let processing = false;

/**
 * Enqueue a new battle
 */
function enqueueBattle({ task_id, template_name, challenger_a, challenger_b, judge_model = 'claude-opus', runs = 3 }) {
  const template = templates.get(template_name);
  if (!template) throw new Error(`Unknown template: ${template_name}`);

  const id = uuidv4();
  db.createBattle({
    id,
    task_id,
    template: template_name,
    challenger_a,
    challenger_b,
    judge_model,
    runs,
  });

  db.logEvent(id, 'battle-created', { challenger_a, challenger_b, template: template_name, runs });
  broadcast(id, 'battle-created', { challenger_a, challenger_b, template: template_name, runs });

  queue.push(id);
  processQueue();
  return id;
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  const battleId = queue.shift();
  try {
    await runBattle(battleId);
  } catch (err) {
    console.error(`Battle ${battleId} failed:`, err);
    db.updateBattleStatus(battleId, 'failed');
    broadcast(battleId, 'battle-failed', { error: err.message });
  }

  processing = false;
  if (queue.length > 0) processQueue();
}

async function runBattle(battleId) {
  const battle = db.getBattle(battleId);
  if (!battle) throw new Error(`Battle not found: ${battleId}`);

  const template = templates.get(battle.template);
  db.updateBattleStatus(battleId, 'running');
  broadcast(battleId, 'battle-started', {
    challenger_a: battle.challenger_a,
    challenger_b: battle.challenger_b,
    template: battle.template,
    runs: battle.runs,
  });

  // Run gauntlet: runs * 2 agents
  const resultsA = [];
  const resultsB = [];

  for (let run = 1; run <= battle.runs; run++) {
    broadcast(battleId, 'round-start', { run, of: battle.runs });

    // Run both agents in parallel for this round
    const [runA, runB] = await Promise.all([
      executeAgentRun(battleId, run, battle.challenger_a, template, battle.task_id),
      executeAgentRun(battleId, run, battle.challenger_b, template, battle.task_id),
    ]);

    // Judge both outputs
    const [scoreA, scoreB] = await Promise.all([
      judgeRun(runA, template, battle.task_id, battle.judge_model),
      judgeRun(runB, template, battle.task_id, battle.judge_model),
    ]);

    db.updateRun(runA.id, {
      score_correctness: scoreA.correctness,
      score_completeness: scoreA.completeness,
      score_efficiency: scoreA.efficiency,
      score_resilience: scoreA.resilience,
      score_total: scoring.computeScore(scoreA),
      judge_reasoning: scoreA.reasoning,
      status: 'scored',
      completed_at: Date.now(),
    });

    db.updateRun(runB.id, {
      score_correctness: scoreB.correctness,
      score_completeness: scoreB.completeness,
      score_efficiency: scoreB.efficiency,
      score_resilience: scoreB.resilience,
      score_total: scoring.computeScore(scoreB),
      judge_reasoning: scoreB.reasoning,
      status: 'scored',
      completed_at: Date.now(),
    });

    resultsA.push(scoring.computeScore(scoreA));
    resultsB.push(scoring.computeScore(scoreB));

    broadcast(battleId, 'round-scored', {
      run,
      agent_a: { agent: battle.challenger_a, score: scoring.computeScore(scoreA), ...scoreA },
      agent_b: { agent: battle.challenger_b, score: scoring.computeScore(scoreB), ...scoreB },
    });

    db.logEvent(battleId, 'round-scored', { run, scoreA: scoring.computeScore(scoreA), scoreB: scoring.computeScore(scoreB) });
  }

  // Compute gauntlet scores
  const gauntletA = scoring.computeGauntletScore(resultsA);
  const gauntletB = scoring.computeGauntletScore(resultsB);
  const winnerSide = scoring.determineWinner(gauntletA, gauntletB);
  const winner = winnerSide === 'a' ? battle.challenger_a : winnerSide === 'b' ? battle.challenger_b : null;

  db.updateBattleStatus(battleId, 'completed', winner);

  // Update ELO
  updateEloForBattle(battle, winnerSide, gauntletA, gauntletB);

  const finalEvent = {
    winner,
    gauntlet_a: gauntletA,
    gauntlet_b: gauntletB,
    challenger_a: battle.challenger_a,
    challenger_b: battle.challenger_b,
    is_draw: winnerSide === 'draw',
  };

  broadcast(battleId, 'champion-declared', finalEvent);
  db.logEvent(battleId, 'champion-declared', finalEvent);

  console.log(`Battle ${battleId} complete. Winner: ${winner || 'DRAW'} (${gauntletA.toFixed(1)} vs ${gauntletB.toFixed(1)})`);
  return finalEvent;
}

/**
 * Execute a single agent run against the task
 * In production, this spawns a real subagent. For now, simulates with mock output.
 */
async function executeAgentRun(battleId, runNumber, agent, template, taskId) {
  const runId = uuidv4();
  db.createRun({ id: runId, battle_id: battleId, run_number: runNumber, agent });

  broadcast(battleId, 'run-start', { run: runNumber, agent, runId });

  const start = Date.now();

  // TODO: Replace with real subagent spawn via OpenClaw sessions_spawn
  // For now: mock execution (returns placeholder output for judge to score)
  const mockOutput = await simulateAgentRun(agent, template, taskId);

  const latency = Date.now() - start;
  db.updateRun(runId, {
    output: mockOutput.output,
    tokens_used: mockOutput.tokens,
    latency_ms: latency,
    error_count: mockOutput.errors,
    tool_calls: mockOutput.tool_calls,
    status: 'completed',
  });

  broadcast(battleId, 'run-complete', { run: runNumber, agent, runId, latency_ms: latency, tokens: mockOutput.tokens });

  return { id: runId, agent, output: mockOutput.output, template, task: taskId };
}

/**
 * Judge a completed run using neutral model
 * Returns score object { correctness, completeness, efficiency, resilience, reasoning }
 */
async function judgeRun(run, template, task, judgeModel) {
  // TODO: Connect to real judge model via CLIProxyAPI
  // For now: return simulated scores
  const base = 60 + Math.random() * 30;
  return {
    correctness:  Math.min(100, base + (Math.random() - 0.5) * 20),
    completeness: Math.min(100, base + (Math.random() - 0.5) * 20),
    efficiency:   Math.min(100, base + (Math.random() - 0.5) * 20),
    resilience:   Math.min(100, base + (Math.random() - 0.5) * 20),
    reasoning:    `Simulated judge evaluation for ${run.agent} run ${run.id.slice(0,8)}.`,
  };
}

function updateEloForBattle(battle, winnerSide, scoreA, scoreB) {
  const category = templates.get(battle.template)?.category || 'general';
  const eloA = db.getElo(battle.challenger_a, category);
  const eloB = db.getElo(battle.challenger_b, category);

  let resultA, resultB;
  if (winnerSide === 'draw') {
    resultA = resultB = 'draw';
  } else if (winnerSide === 'a') {
    resultA = 'win'; resultB = 'loss';
  } else {
    resultA = 'loss'; resultB = 'win';
  }

  const deltaA = scoring.computeEloDelta(eloA.rating, eloB.rating, resultA);
  db.updateElo(battle.challenger_a, category, eloA.rating + deltaA, resultA);
  db.updateElo(battle.challenger_b, category, eloB.rating - deltaA, resultB);
}

// ─── Mock simulation (replace with real subagent spawning) ──────────────────

async function simulateAgentRun(agent, template, taskId) {
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
  return {
    output: `[SIMULATED] ${agent} completed task "${taskId}" using template ${template.name}.`,
    tokens: Math.floor(2000 + Math.random() * 6000),
    errors: Math.floor(Math.random() * 2),
    tool_calls: Math.floor(Math.random() * 8),
  };
}

module.exports = { enqueueBattle, runBattle };
