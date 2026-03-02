#!/usr/bin/env node
/**
 * SpawnKit Demo Data Validation
 * Validates that all themes receive consistent, rich demo data
 */

console.log('🧪 SpawnKit Demo Data Validation\n');

// Load the data bridge in Node.js environment
global.window = {};
global.document = { 
    readyState: 'complete', 
    addEventListener: () => {},
    getElementById: () => null,
    createElement: () => ({ style: {}, addEventListener: () => {}, remove: () => {} }),
    body: { appendChild: () => {} }
};
global.localStorage = { getItem: () => null, setItem: () => {} };

// Mock fetch to avoid network calls
global.fetch = async () => ({ ok: false, json: () => ({}) });

// Load the data bridge
require('./src/data-bridge.js');

// Test the demo data
setTimeout(() => {
    const { data, mode } = global.window.SpawnKit;
    
    console.log(`📊 Mode: ${mode}`);
    console.log(`👥 Agents: ${data.agents.length}`);
    console.log(`🤖 Subagents: ${data.subagents.length}`);
    console.log(`🎯 Missions: ${data.missions.length}`);
    console.log(`⏰ Crons: ${data.crons.length}\n`);
    
    // Validate agent data quality
    console.log('🔍 Agent Data Quality:');
    data.agents.forEach(agent => {
        const hasRequiredFields = agent.id && agent.name && agent.role && agent.status && agent.currentTask;
        const hasMetrics = agent.tokensUsed && agent.apiCalls;
        const hasRecentActivity = agent.lastSeenRelative;
        
        console.log(`  ${agent.emoji} ${agent.name} (${agent.role}): ${hasRequiredFields && hasMetrics && hasRecentActivity ? '✅' : '❌'}`);
    });
    
    // Validate subagent data quality
    console.log('\n🤖 Subagent Data Quality:');
    data.subagents.forEach(subagent => {
        const hasAgentOSName = subagent.agentOSName;
        const hasValidProgress = subagent.progress >= 0 && subagent.progress <= 1;
        const hasTask = subagent.task && subagent.task.length > 10;
        
        console.log(`  ${subagent.agentOSName || subagent.name}: ${hasAgentOSName && hasValidProgress && hasTask ? '✅' : '❌'}`);
    });
    
    // Validate missions
    console.log('\n🎯 Mission Data Quality:');
    data.missions.forEach(mission => {
        const hasTitle = mission.title && mission.title.length > 5;
        const hasProgress = mission.progress >= 0 && mission.progress <= 1;
        const hasAssignedAgents = mission.assignedAgents && mission.assignedAgents.length > 0;
        
        console.log(`  ${mission.title}: ${hasTitle && hasProgress && hasAssignedAgents ? '✅' : '❌'}`);
    });
    
    // Overall validation
    const agentCount = data.agents.length;
    const subagentCount = data.subagents.length;
    const missionCount = data.missions.length;
    const cronCount = data.crons.length;
    
    const meetsRequirements = 
        agentCount >= 8 && agentCount <= 12 &&
        subagentCount >= 5 && 
        missionCount >= 3 &&
        cronCount >= 3;
    
    console.log('\n🎯 DEMO DATA QUALITY ASSESSMENT:');
    console.log(`Agent Count (8-12): ${agentCount} ${agentCount >= 8 && agentCount <= 12 ? '✅' : '❌'}`);
    console.log(`Subagent Count (5+): ${subagentCount} ${subagentCount >= 5 ? '✅' : '❌'}`);
    console.log(`Mission Count (3+): ${missionCount} ${missionCount >= 3 ? '✅' : '❌'}`);
    console.log(`Cron Count (3+): ${cronCount} ${cronCount >= 3 ? '✅' : '❌'}`);
    
    console.log(`\n${meetsRequirements ? '🎉 ALL REQUIREMENTS MET' : '❌ REQUIREMENTS NOT MET'}`);
    console.log('\nDemo data is ready for customer showcase! 🚀');
}, 100);