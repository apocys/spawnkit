/**
 * medieval-lifecycle-patch.js — Extends agent state with conscience, trust, quest tracking
 * 
 * Adds to MedievalLifecycle agent state:
 * - conscience: 'dutiful' | 'independent' | 'chaotic'
 * - trustTier: 0-5 (earned per completed quest)
 * - questsCompleted: total count
 * - errorCount: total errors
 * - lastQuestName: most recent session label
 * - lastQuestTime: timestamp
 * 
 * Polls /api/oc/sessions every 30s to track agent work history.
 * Requires: medieval-agent-lifecycle.js loaded first (window.MedievalLifecycle)
 */
(function () {
    'use strict';

    var POLL_INTERVAL = 30000;
    var _knownSessions = new Set();
    var _agentStats = {};

    function getStats(agentId) {
        if (!_agentStats[agentId]) {
            _agentStats[agentId] = {
                questsCompleted: 0,
                errorCount: 0,
                lastQuestName: '',
                lastQuestTime: null,
                conscience: 'independent',
                trustTier: 0,
            };
        }
        return _agentStats[agentId];
    }

    function inferAgentFromLabel(label) {
        if (!label) return null;
        var lower = label.toLowerCase();
        var agents = ['sycopa', 'forge', 'atlas', 'hunter', 'echo', 'sentinel'];
        for (var i = 0; i < agents.length; i++) {
            if (lower.includes(agents[i])) return agents[i].charAt(0).toUpperCase() + agents[i].slice(1);
        }
        // Infer from task type
        if (lower.includes('code') || lower.includes('build') || lower.includes('fix')) return 'Forge';
        if (lower.includes('review') || lower.includes('doc') || lower.includes('plan')) return 'Atlas';
        if (lower.includes('test') || lower.includes('qa') || lower.includes('security')) return 'Sentinel';
        if (lower.includes('market') || lower.includes('revenue') || lower.includes('outreach')) return 'Hunter';
        if (lower.includes('design') || lower.includes('ux') || lower.includes('creative')) return 'Echo';
        return 'Sycopa';
    }

    function pollSessions() {
        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch)
            ? ThemeAuth.fetch.bind(ThemeAuth)
            : window.fetch.bind(window);

        fetcher('/api/oc/sessions').then(function (r) { return r.ok ? r.json() : []; }).then(function (data) {
            var sessions = Array.isArray(data) ? data : (data.sessions || []);

            sessions.forEach(function (s) {
                var key = s.key || s.id || '';
                if (_knownSessions.has(key)) return;

                var kind = (s.kind || '').toLowerCase();
                if (kind !== 'subagent' && kind !== 'spawn') return;

                var label = s.label || s.task || '';
                var status = (s.status || '').toLowerCase();
                var agentId = inferAgentFromLabel(label);
                if (!agentId) return;

                var stats = getStats(agentId);

                if (status === 'done' || status === 'completed' || status === 'ended') {
                    _knownSessions.add(key);
                    stats.questsCompleted++;
                    stats.lastQuestName = label;
                    stats.lastQuestTime = s.endedAt || s.updatedAt || new Date().toISOString();

                    // Check for error indicators
                    if (label.toLowerCase().includes('error') || label.toLowerCase().includes('fail') || label.toLowerCase().includes('crash')) {
                        stats.errorCount++;
                    }
                } else if (status === 'active' || status === 'running') {
                    stats.lastQuestName = label;
                    stats.lastQuestTime = s.startedAt || s.createdAt || new Date().toISOString();
                }

                // Recalculate derived fields
                stats.trustTier = Math.min(5, Math.floor(stats.questsCompleted / 3));

                if (stats.questsCompleted === 0) {
                    stats.conscience = 'independent';
                } else if (stats.errorCount / stats.questsCompleted > 0.3) {
                    stats.conscience = 'chaotic';
                } else if (stats.questsCompleted > 5) {
                    stats.conscience = 'dutiful';
                } else {
                    stats.conscience = 'independent';
                }
            });
        }).catch(function () { /* silent */ });
    }

    // Patch MedievalLifecycle to expose extended state
    function bootstrap() {
        if (!window.MedievalLifecycle) {
            setTimeout(bootstrap, 500);
            return;
        }

        var origGetState = window.MedievalLifecycle.getAgentState;

        window.MedievalLifecycle.getAgentState = function (agentId) {
            var base = origGetState(agentId);
            var stats = getStats(agentId);
            base.conscience = stats.conscience;
            base.trustTier = stats.trustTier;
            base.questsCompleted = stats.questsCompleted;
            base.errorCount = stats.errorCount;
            base.lastQuestName = stats.lastQuestName;
            base.lastQuestTime = stats.lastQuestTime;
            return base;
        };

        // Initial poll
        pollSessions();
        setInterval(pollSessions, POLL_INTERVAL);

        console.log('[LifecyclePatch] ✅ Extended agent state ready (conscience, trust, quest tracking)');
    }

    bootstrap();
})();
