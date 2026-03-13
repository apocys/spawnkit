/**
 * kpi-engine.js — Real Agent KPI Calculator
 * Maps OpenClaw session data to mood/energy metrics for medieval theme
 */
'use strict';

/**
 * Calculate agent KPIs from real OpenClaw session data
 * @param {Array} sessionData - Array of session objects from /api/oc/sessions
 * @returns {Object} - KPI data by agentId: { mood: 0-100, energy: 0-100, trust: 0-5, conscience: string }
 */
function calculateAgentKPIs(sessionData) {
  if (!Array.isArray(sessionData)) {
    return {};
  }

  const now = Date.now();
  const kpis = {};

  // Initialize core agents with default values
  const DEFAULT_AGENTS = ['sycopa', 'forge', 'atlas', 'hunter', 'echo', 'sentinel'];
  DEFAULT_AGENTS.forEach(agentId => {
    kpis[agentId] = {
      mood: 50,      // Neutral mood baseline
      energy: 30,    // Low energy when idle
      trust: 3,      // Moderate trust baseline  
      conscience: 'dutiful'
    };
  });

  // Process each session
  sessionData.forEach(session => {
    const agentId = mapSessionToAgent(session);
    if (!agentId) return;

    // Initialize agent if not exists
    if (!kpis[agentId]) {
      kpis[agentId] = {
        mood: 50,
        energy: 30,
        trust: 3,
        conscience: 'dutiful'
      };
    }

    // Calculate activity metrics
    const activityMetrics = calculateActivityMetrics(session, now);
    const errorMetrics = calculateErrorMetrics(session);
    const trustMetrics = calculateTrustMetrics(session, activityMetrics);
    
    // Apply KPI formulas
    kpis[agentId].mood = calculateMood(activityMetrics, errorMetrics);
    kpis[agentId].energy = calculateEnergy(activityMetrics, errorMetrics, now);
    kpis[agentId].trust = calculateTrust(trustMetrics, activityMetrics);
    kpis[agentId].conscience = calculateConscience(session, activityMetrics);
  });

  return kpis;
}

/**
 * Map session to agent ID based on label, key, or action type
 */
function mapSessionToAgent(session) {
  const label = (session.label || session.displayName || session.key || '').toLowerCase();
  const key = session.key || '';

  // Direct agent name matching
  const directMatch = ['sycopa', 'forge', 'atlas', 'hunter', 'echo', 'sentinel']
    .find(agent => label.includes(agent) || key.includes(agent));
  
  if (directMatch) return directMatch;

  // Main session maps to sycopa
  if (key === 'agent:main:main' || session.kind === 'main') {
    return 'sycopa';
  }

  // Action-based mapping for sub-agents
  const action = session.action || 'idle';
  switch (action) {
    case 'coding':
    case 'debugging':
      return 'forge';
    case 'reviewing':
    case 'researching':
      return 'atlas';
    case 'planning':
      return 'sycopa';
    case 'communicating':
      return 'echo';
    case 'guarding':
      return 'sentinel';
    case 'deploying':
      return 'hunter';
    default:
      // Assign to first available core agent for other sub-agents
      return 'atlas';
  }
}

/**
 * Calculate activity metrics from session data
 */
function calculateActivityMetrics(session, now) {
  const lastActive = session.lastActive || 0;
  const idleTime = now - lastActive; // milliseconds
  const totalTokens = session.totalTokens || 0;
  const isActive = session.status === 'active';
  
  // Activity level calculation
  let activityLevel = 'LOW';
  if (isActive && idleTime < 5 * 60 * 1000) { // Active within 5 minutes
    activityLevel = totalTokens > 1000 ? 'HIGH' : 'MEDIUM';
  } else if (idleTime < 30 * 60 * 1000) { // Active within 30 minutes
    activityLevel = 'MEDIUM';
  }

  return {
    activityLevel,
    idleMinutes: Math.floor(idleTime / (60 * 1000)),
    totalTokens,
    isActive,
    tokensPerHour: calculateTokensPerHour(session, now)
  };
}

/**
 * Calculate tokens per hour for activity intensity
 */
function calculateTokensPerHour(session, now) {
  const lastActive = session.lastActive || now;
  const hoursSinceActive = Math.max(1, (now - lastActive) / (60 * 60 * 1000));
  return Math.floor((session.totalTokens || 0) / hoursSinceActive);
}

/**
 * Calculate error metrics from session data
 */
function calculateErrorMetrics(session) {
  const action = session.action || 'idle';
  const label = (session.label || '').toLowerCase();
  
  // Detect error patterns
  const hasErrors = action === 'debugging' || 
    label.includes('error') || 
    label.includes('debug') || 
    label.includes('fix') ||
    label.includes('broken');

  // Simple error rate heuristic
  const errorRate = hasErrors ? 0.3 : 0.05; // 30% if debugging, 5% baseline
  
  return {
    hasErrors,
    errorRate,
    errorState: action === 'debugging'
  };
}

/**
 * Calculate trust metrics
 */
function calculateTrustMetrics(session, activityMetrics) {
  const completionHeuristic = activityMetrics.totalTokens > 500 ? 0.8 : 0.6;
  const consistencyScore = activityMetrics.isActive ? 1.0 : 0.7;
  
  return {
    completionHeuristic,
    consistencyScore,
    reliability: (completionHeuristic + consistencyScore) / 2
  };
}

/**
 * Calculate mood (0-100) based on activity and errors
 */
function calculateMood(activityMetrics, errorMetrics) {
  const { activityLevel } = activityMetrics;
  const { hasErrors, errorRate } = errorMetrics;

  let baseMood = 50;

  // Activity-based mood adjustment
  switch (activityLevel) {
    case 'HIGH':
      if (!hasErrors || errorRate < 0.1) {
        baseMood = 80 + Math.random() * 15; // High mood (80-95%)
      } else {
        baseMood = 30 + Math.random() * 20; // Stressed mood (30-50%)
      }
      break;
    case 'MEDIUM':
      baseMood = 60 + Math.random() * 20; // Focused mood (60-80%)
      break;
    case 'LOW':
      if (activityMetrics.idleMinutes > 30) {
        baseMood = 20 + Math.random() * 20; // Bored mood (20-40%)
      } else {
        baseMood = 40 + Math.random() * 20; // Slightly bored (40-60%)
      }
      break;
  }

  return Math.round(Math.max(0, Math.min(100, baseMood)));
}

/**
 * Calculate energy (0-100) based on recent activity and errors
 */
function calculateEnergy(activityMetrics, errorMetrics, now) {
  const { idleMinutes, isActive } = activityMetrics;
  const { errorState } = errorMetrics;

  let baseEnergy = 50;

  if (errorState) {
    // Error state = Depleted energy (5-20%)
    baseEnergy = 5 + Math.random() * 15;
  } else if (isActive && idleMinutes < 10) {
    // Recent activity = High energy (80-100%)
    baseEnergy = 80 + Math.random() * 20;
  } else if (idleMinutes >= 10 && idleMinutes <= 30) {
    // Idle 10-30min = Medium energy (40-70%)
    baseEnergy = 40 + Math.random() * 30;
  } else if (idleMinutes > 30) {
    // Idle >30min = Low energy (10-30%)
    baseEnergy = 10 + Math.random() * 20;
  }

  return Math.round(Math.max(0, Math.min(100, baseEnergy)));
}

/**
 * Calculate trust score (0-5) based on reliability metrics
 */
function calculateTrust(trustMetrics, activityMetrics) {
  const { reliability } = trustMetrics;
  const { totalTokens } = activityMetrics;

  // Base trust on reliability and output volume
  let trustScore = Math.floor(reliability * 5);
  
  // Bonus for high productivity
  if (totalTokens > 5000) {
    trustScore = Math.min(5, trustScore + 1);
  }

  // Minimum trust of 1 for active agents
  if (activityMetrics.isActive && trustScore < 1) {
    trustScore = 1;
  }

  return Math.max(0, Math.min(5, trustScore));
}

/**
 * Calculate conscience based on session patterns
 */
function calculateConscience(session, activityMetrics) {
  const action = session.action || 'idle';
  const label = (session.label || '').toLowerCase();
  const { activityLevel } = activityMetrics;

  // Conscience categories based on behavior patterns
  if (action === 'planning' || action === 'reviewing' || label.includes('systematic')) {
    return 'dutiful';
  }
  
  if (activityLevel === 'HIGH' && (action === 'coding' || action === 'researching')) {
    return 'independent';
  }
  
  if (action === 'debugging' || label.includes('emergency') || label.includes('hotfix')) {
    return 'chaotic';
  }

  // Default to dutiful for stable patterns
  return 'dutiful';
}

module.exports = {
  calculateAgentKPIs
};