#!/usr/bin/env node
/**
 * SpawnKit Demo Data Structure Validation
 * Validates demo data structure meets requirements
 */

console.log('🧪 SpawnKit Demo Data Structure Validation\n');

// Extract demo data from the data bridge
const fs = require('fs');
const dataBridgeContent = fs.readFileSync('./src/data-bridge.js', 'utf8');

// Parse the demo data structure
const demoDataMatch = dataBridgeContent.match(/function makeDemoData\(\) \{[\s\S]*?return \{([\s\S]*?)\};\s*\}/);
if (!demoDataMatch) {
    console.log('❌ Could not find makeDemoData function');
    process.exit(1);
}

// Count elements in the demo data
const agentMatches = dataBridgeContent.match(/agents: \[[\s\S]*?\]/);
const subagentMatches = dataBridgeContent.match(/subagents: \[[\s\S]*?\]/);
const missionMatches = dataBridgeContent.match(/missions: \[[\s\S]*?\]/);
const cronMatches = dataBridgeContent.match(/crons: \[[\s\S]*?\]/);

// Count agents
const agentCount = (agentMatches?.[0].match(/\{\s*id:/g) || []).length;
const subagentCount = (subagentMatches?.[0].match(/\{\s*id:/g) || []).length; 
const missionCount = (missionMatches?.[0].match(/\{\s*id:/g) || []).length;
const cronCount = (cronMatches?.[0].match(/\{\s*id:/g) || []).length;

console.log(`📊 Demo Data Structure:`);
console.log(`👥 Agents: ${agentCount}`);
console.log(`🤖 Subagents: ${subagentCount}`);
console.log(`🎯 Missions: ${missionCount}`);
console.log(`⏰ Crons: ${cronCount}\n`);

// Check for realistic data patterns
const hasRealisticAgentNames = dataBridgeContent.includes('Forge') && dataBridgeContent.includes('Hunter') && dataBridgeContent.includes('Kira');
const hasRealisticRoles = dataBridgeContent.includes('CTO') && dataBridgeContent.includes('CEO') && dataBridgeContent.includes('CRO');
const hasAgentOSNaming = dataBridgeContent.includes('agentOSName') && dataBridgeContent.includes('CodeBuilder') && dataBridgeContent.includes('TaskRunner');
const hasVariedStatuses = dataBridgeContent.includes('active') && dataBridgeContent.includes('running') && dataBridgeContent.includes('completed');
const hasRealisticTasks = dataBridgeContent.includes('SpawnKit') && dataBridgeContent.includes('analysis') && dataBridgeContent.includes('optimization');

console.log('🔍 Data Quality Checks:');
console.log(`  Realistic Agent Names: ${hasRealisticAgentNames ? '✅' : '❌'}`);
console.log(`  Professional Roles: ${hasRealisticRoles ? '✅' : '❌'}`);
console.log(`  Agent OS Naming v2.0: ${hasAgentOSNaming ? '✅' : '❌'}`);
console.log(`  Varied Status Types: ${hasVariedStatuses ? '✅' : '❌'}`);
console.log(`  Realistic Task Descriptions: ${hasRealisticTasks ? '✅' : '❌'}`);

// Requirements check
const meetsRequirements = 
    agentCount >= 8 && agentCount <= 12 &&
    subagentCount >= 5 && 
    missionCount >= 3 &&
    cronCount >= 3;

console.log('\n🎯 REQUIREMENTS VALIDATION:');
console.log(`Agent Count (8-12): ${agentCount} ${agentCount >= 8 && agentCount <= 12 ? '✅' : '❌'}`);
console.log(`Subagent Count (5+): ${subagentCount} ${subagentCount >= 5 ? '✅' : '❌'}`);
console.log(`Mission Count (3+): ${missionCount} ${missionCount >= 3 ? '✅' : '❌'}`);
console.log(`Cron Count (3+): ${cronCount} ${cronCount >= 3 ? '✅' : '❌'}`);

const allQualityChecks = hasRealisticAgentNames && hasRealisticRoles && hasAgentOSNaming && hasVariedStatuses && hasRealisticTasks;

console.log(`\n${meetsRequirements && allQualityChecks ? '🎉 ALL REQUIREMENTS MET!' : '❌ REQUIREMENTS NOT MET'}`);
console.log(`${meetsRequirements && allQualityChecks ? 'Demo data is ready for customer showcase! 🚀' : 'Demo data needs improvements.'}`);