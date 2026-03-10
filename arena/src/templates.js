/**
 * Battle Templates Registry
 * Each template defines: task type, scoring weights, success criteria, constraints
 */

const TEMPLATES = {
  'adversarial-debug': {
    name: 'adversarial-debug',
    category: 'debugging',
    description: 'Fix a bug that has a hidden second bug. Surface both or fail.',
    context_budget: 8000,
    time_limit: 120,
    success_criteria: {
      primary_bug_fixed: true,
      hidden_bug_identified: true,
      no_regressions: true,
    },
    scoring_overrides: {
      correctness: 0.50,
      completeness: 0.30,
      efficiency: 0.10,
      resilience: 0.10,
    },
    adversarial: true,
    task_prompt_template: `You are debugging code. Find and fix ALL bugs.

**Code:**
{{code}}

**Reported bug:** {{reported_bug}}

**Requirements:**
- Fix the reported bug
- Identify and fix any additional bugs you find
- Explain each bug found and the fix applied
- Ensure no regressions

Deliver: fixed code + bug report.`,
  },

  'live-data-research': {
    name: 'live-data-research',
    category: 'research',
    description: 'Answer a question that requires synthesizing 3+ real sources. No hallucination allowed.',
    context_budget: 16000,
    time_limit: 180,
    success_criteria: {
      sources_cited: '>= 3',
      claims_verifiable: true,
      no_conflation: true,
    },
    scoring_overrides: null, // use defaults
    adversarial: false,
    judge_uses_web: true,
    task_prompt_template: `Research the following question and provide a comprehensive answer backed by real sources.

**Question:** {{question}}

**Requirements:**
- Cite at least 3 distinct, verifiable sources
- All claims must be grounded in those sources
- No conflation between different sources/facts
- Clearly distinguish what is known vs uncertain

Deliver: answer + citations.`,
  },

  'cold-start-feature': {
    name: 'cold-start-feature',
    category: 'feature-build',
    description: 'Build a working feature with zero context about the codebase. Agent must explore first.',
    context_budget: 20000,
    time_limit: 300,
    success_criteria: {
      code_runs: true,
      tests_pass: true,
      no_asked_for_help: true,
      integrates_with_existing: true,
    },
    scoring_overrides: {
      correctness: 0.35,
      completeness: 0.25,
      efficiency: 0.20,
      resilience: 0.20,
    },
    adversarial: false,
    task_prompt_template: `You have been dropped into a codebase cold. Build the requested feature autonomously.

**Codebase location:** {{repo_path}}
**Feature request:** {{feature}}
**Test requirements:** {{tests}}

**Rules:**
- Explore the codebase first before writing anything
- Do NOT ask for help or clarification
- The feature must integrate cleanly with existing code
- Write tests that pass

Deliver: working code + passing tests.`,
  },

  // ApoMac-compatible templates (cross-compatible)
  'config-fix': {
    name: 'config-fix',
    category: 'debugging',
    description: 'Fix a broken configuration file or system config.',
    context_budget: 4000,
    time_limit: 60,
    success_criteria: {
      config_valid: true,
      service_starts: true,
    },
    scoring_overrides: null,
    adversarial: false,
    task_prompt_template: `Fix the following broken configuration.

**Config type:** {{config_type}}
**Broken config:**
{{config}}

**Error:** {{error}}

Deliver: fixed config + explanation.`,
  },

  'creative-brief': {
    name: 'creative-brief',
    category: 'creative',
    description: 'Generate creative content from a brief. Scored on originality and execution.',
    context_budget: 8000,
    time_limit: 120,
    success_criteria: {
      meets_brief: true,
      original: true,
      polished: true,
    },
    scoring_overrides: {
      correctness: 0.25,
      completeness: 0.35,
      efficiency: 0.20,
      resilience: 0.20,
    },
    adversarial: false,
    task_prompt_template: `Create the following based on this brief.

**Brief:** {{brief}}
**Format:** {{format}}
**Constraints:** {{constraints}}

Deliver: the creative output.`,
  },
};

function get(name) {
  return TEMPLATES[name] || null;
}

function list() {
  return Object.values(TEMPLATES);
}

module.exports = { get, list, TEMPLATES };
