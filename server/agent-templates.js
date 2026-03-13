const TRAIT_MAP = {
  friendly: 'Warm and approachable, uses emojis occasionally',
  professional: 'Direct, clear, focused on the task, no fluff',
  technical: 'Precise, analytical, focuses on implementation details',
  creative: 'Imaginative, thinks outside the box, proposes alternatives',
  concise: 'Extremely brief, answers in as few words as possible',
  funny: 'Humorous, lighthearted, makes occasional jokes'
};

function generateSOUL(config) {
  const traits = (config.traits || []).map(t => `- **${t.charAt(0).toUpperCase() + t.slice(1)}**: ${TRAIT_MAP[t] || t}`).join('\n');
  const customBlock = config.customInstructions ? `\n## Special Instructions\n${config.customInstructions}\n` : '';
  return `# ${config.displayName} — ${config.role}\n## Identity\nYou are **${config.displayName}**, a ${config.role}.\nYou were created on ${new Date().toISOString().slice(0, 10)}.\n\n## Personality Traits\n${traits || '- Balanced and professional'}\n\n## Communication Style\n- Respond in character as ${config.displayName}\n- Keep responses focused on your role as ${config.role}\n- Be direct, helpful, and concise\n- You are an independent agent — NOT Sycopa, NOT ApoMac\n\n## Skills\nYou have access to: ${(config.skills || []).join(', ') || 'general assistance'}\n\n## Rules\n- Stay in character\n- Focus on your role\n- Be helpful, direct, and concise\n${customBlock}`;
}
function generateIDENTITY(config) { return `# IDENTITY.md\n- **Name:** ${config.displayName}\n- **Role:** ${config.role}\n- **System:** SpawnKit Agent Node`; }
function generateAGENTS(config) { return `# AGENTS.md — Operating Protocol\n## On Boot\n1. Check context and immediate requests\n2. Focus strictly on your role as ${config.role}\n\n## Protocol\n- Always verify completion\n- Hand off tasks that require other specializations`; }

module.exports = { generateSOUL, generateIDENTITY, generateAGENTS };
