/* medieval-arena-integration.js — Connect medieval arena UI to real arena skill */
(function() {
  'use strict';

  var arena = null;

  function init() {
    // Wait for castle app and arena to be ready
    if (!window.castleApp || !window.MedievalArena) {
      setTimeout(init, 1000);
      return;
    }

    // Hook into existing arena UI
    if (window.castleApp.arena) {
      arena = window.castleApp.arena;
      setupArenaSkillIntegration();
    }
  }

  function setupArenaSkillIntegration() {
    // Override the arena's battle start method to use real sub-agents
    if (arena && arena.startBattle) {
      var originalStartBattle = arena.startBattle;
      arena.startBattle = function(configName) {
        startRealBattle(configName || 'config-fix');
      };
    }

    // Add battle templates selection UI
    addBattleTemplatesUI();
  }

  function startRealBattle(taskName) {
    if (!arena) return;

    // Show arena UI in "starting battle" state
    arena.setBattleState('starting');
    arena.updateUIText('Spawning AI champions...');

    // Spawn two identical sub-agents for the battle
    spawnBattleAgents(taskName)
      .then(function(result) {
        if (result.success) {
          arena.setBattleState('fighting');
          arena.updateUIText('Battle in progress: ' + taskName);
          arena.setChampions('ApoMac', 'Sycopa');
          
          // Monitor battle progress
          monitorBattle(result.agents);
        } else {
          arena.setBattleState('error');
          arena.updateUIText('Failed to start battle: ' + result.error);
        }
      })
      .catch(function(error) {
        arena.setBattleState('error');
        arena.updateUIText('Battle spawn error: ' + error.message);
      });
  }

  async function spawnBattleAgents(taskName) {
    try {
      // Get battle template
      var template = await getBattleTemplate(taskName);
      if (!template) {
        throw new Error('Battle template not found: ' + taskName);
      }

      // Spawn two identical sub-agents
      var agentA = await spawnAgent('ApoMac', template);
      var agentB = await spawnAgent('Sycopa', template);

      return {
        success: true,
        agents: [agentA, agentB],
        template: template
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async function getBattleTemplate(taskName) {
    // Use the arena skill to get battle templates
    var response = await fetch('/api/oc/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken()
      },
      body: JSON.stringify({
        skill: 'arena',
        command: 'get-template',
        args: [taskName]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get battle template');
    }

    var result = await response.json();
    return result.template;
  }

  async function spawnAgent(agentName, template) {
    var response = await fetch('/api/spawn-subagent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken()
      },
      body: JSON.stringify({
        task: template.prompt,
        label: 'arena-' + Date.now() + '-' + agentName.toLowerCase(),
        mode: 'run',
        runTimeoutSeconds: template.timeoutSeconds || 300
      })
    });

    if (!response.ok) {
      throw new Error('Failed to spawn ' + agentName);
    }

    var result = await response.json();
    return {
      name: agentName,
      sessionKey: result.childSessionKey,
      runId: result.runId
    };
  }

  async function monitorBattle(agents) {
    var checkInterval = 5000; // 5 seconds
    var maxChecks = 60; // 5 minutes max
    var checks = 0;

    var monitor = setInterval(async function() {
      checks++;
      
      try {
        var statuses = await Promise.all(agents.map(getAgentStatus));
        var allDone = statuses.every(function(s) { return s.status === 'done'; });
        var anyError = statuses.some(function(s) { return s.status === 'error'; });

        if (allDone || anyError || checks >= maxChecks) {
          clearInterval(monitor);
          await completeBattle(agents, statuses);
        } else {
          // Update arena UI with progress
          var progress = statuses.map(function(s, i) {
            return agents[i].name + ': ' + s.status;
          }).join(' | ');
          arena.updateUIText('Battle progress: ' + progress);
        }
      } catch (error) {
        clearInterval(monitor);
        arena.setBattleState('error');
        arena.updateUIText('Monitoring error: ' + error.message);
      }
    }, checkInterval);
  }

  async function getAgentStatus(agent) {
    var response = await fetch('/api/subagent-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken()
      },
      body: JSON.stringify({
        sessionKey: agent.sessionKey
      })
    });

    if (!response.ok) {
      return { status: 'error', error: 'Status check failed' };
    }

    return await response.json();
  }

  async function completeBattle(agents, statuses) {
    arena.setBattleState('judging');
    arena.updateUIText('Battle complete. Judging results...');

    try {
      // Collect outputs from both agents
      var outputs = await Promise.all(agents.map(async function(agent, i) {
        var status = statuses[i];
        return {
          agent: agent.name,
          output: status.output || '',
          runtime: status.runtime || 0,
          tokens: status.totalTokens || 0,
          errors: status.errorCount || 0,
          status: status.status
        };
      }));

      // Use LLM to judge the results
      var judgment = await judgeBattle(outputs);

      // Show results in arena UI
      arena.setBattleState('complete');
      arena.showBattleResults(judgment);
      
      // Animate victory effects
      if (judgment.winner) {
        arena.celebrateWinner(judgment.winner);
      }

    } catch (error) {
      arena.setBattleState('error');
      arena.updateUIText('Judgment error: ' + error.message);
    }
  }

  async function judgeBattle(outputs) {
    var response = await fetch('/api/oc/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken()
      },
      body: JSON.stringify({
        skill: 'arena',
        command: 'judge',
        args: [outputs]
      })
    });

    if (!response.ok) {
      throw new Error('Judgment failed');
    }

    return await response.json();
  }

  function addBattleTemplatesUI() {
    // Add battle templates to the arena UI
    if (!arena || !arena.addBattleTemplate) return;

    var templates = [
      { name: 'config-fix', label: 'Config Fix Challenge', desc: 'Fix a broken configuration file' },
      { name: 'debug-hunt', label: 'Bug Hunt', desc: 'Find and fix a JavaScript bug' },
      { name: 'css-layout', label: 'CSS Layout', desc: 'Build a responsive component' },
      { name: 'api-design', label: 'API Design', desc: 'Design a clean REST API' }
    ];

    templates.forEach(function(template) {
      arena.addBattleTemplate(template.name, template.label, template.desc);
    });
  }

  function getAuthToken() {
    try {
      var config = JSON.parse(localStorage.getItem('spawnkit-config') || '{}');
      return config.token || localStorage.getItem('spawnkit-token') || '';
    } catch (e) {
      return '';
    }
  }

  // Initialize when DOM and other scripts are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000);
  }

  // Export for debugging
  window.ArenaIntegration = {
    startBattle: startRealBattle,
    getStatus: function() {
      return arena ? arena.getBattleState() : null;
    }
  };
})();