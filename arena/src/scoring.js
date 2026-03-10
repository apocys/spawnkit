/**
 * Arena Scoring Engine
 * 4 pillars: Correctness (40%), Completeness (25%), Efficiency (20%), Resilience (15%)
 * Gauntlet scoring: avg of 3 runs - consistency penalty
 */

const WEIGHTS = {
  correctness: 0.40,
  completeness: 0.25,
  efficiency: 0.20,
  resilience: 0.15,
};

const CONSISTENCY_THRESHOLD = 15; // points
const CONSISTENCY_PENALTY = 5;

/**
 * Compute weighted total from pillar scores (each 0-100)
 */
function computeScore({ correctness, completeness, efficiency, resilience }) {
  return (
    correctness  * WEIGHTS.correctness +
    completeness * WEIGHTS.completeness +
    efficiency   * WEIGHTS.efficiency +
    resilience   * WEIGHTS.resilience
  );
}

/**
 * Compute gauntlet score from array of run scores (3 runs)
 * Applies consistency penalty if stddev > threshold
 */
function computeGauntletScore(runScores) {
  if (!runScores || runScores.length === 0) return 0;
  const avg = runScores.reduce((a, b) => a + b, 0) / runScores.length;
  const stddev = Math.sqrt(
    runScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / runScores.length
  );
  const penalty = stddev > CONSISTENCY_THRESHOLD ? CONSISTENCY_PENALTY : 0;
  return Math.max(0, avg - penalty);
}

/**
 * Compute ELO delta using standard formula (K=32)
 */
function computeEloDelta(ratingA, ratingB, resultA) {
  const K = 32;
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const scoreA = resultA === 'win' ? 1 : resultA === 'draw' ? 0.5 : 0;
  return Math.round(K * (scoreA - expectedA));
}

/**
 * Determine winner from two gauntlet scores
 * Returns: 'a', 'b', or 'draw'
 */
function determineWinner(scoreA, scoreB, drawThreshold = 2) {
  const diff = Math.abs(scoreA - scoreB);
  if (diff <= drawThreshold) return 'draw';
  return scoreA > scoreB ? 'a' : 'b';
}

/**
 * Build judge prompt for scoring a run output
 */
function buildJudgePrompt({ task, output, template, agent }) {
  return `You are a neutral judge evaluating AI agent performance. Score this output on 4 pillars (0-100 each).

## Task
${task}

## Template
${template.name} (${template.category})
Success criteria: ${JSON.stringify(template.success_criteria, null, 2)}

## Agent Output (${agent})
${output}

## Scoring Rubric

**Correctness (40% of final score)**
- Factual accuracy (15pts): Are facts/logic correct?
- Code validity (10pts): Does code compile/run?
- Logic soundness (10pts): Is the reasoning sound?
- No hallucinations (5pts): Are claims grounded?

**Completeness (25% of final score)**
- All requirements met (15pts): Does output address everything asked?
- Edge cases (10pts): Are edge cases handled?

**Efficiency (20% of final score)**
- Signal density (10pts): Quality per token (was it concise without losing substance?)
- Time to solution (10pts): Did it solve efficiently without unnecessary steps?

**Resilience (15% of final score)**
- Error handling (8pts): How well did it handle errors or unknowns?
- Ambiguity resolution (7pts): How well did it handle unclear requirements?

## Response Format (JSON only, no commentary outside JSON)
{
  "correctness": <0-100>,
  "completeness": <0-100>,
  "efficiency": <0-100>,
  "resilience": <0-100>,
  "reasoning": "<2-3 sentence summary of strengths and weaknesses>"
}`;
}

module.exports = {
  WEIGHTS,
  computeScore,
  computeGauntletScore,
  computeEloDelta,
  determineWinner,
  buildJudgePrompt,
};
