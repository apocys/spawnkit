/**
 * Consciousness Resonance Crystal System (CSL Prototype)
 * Medieval-themed implementation of Concept Sharing Layer
 */

class ConsciousnessResonance {
    constructor() {
        this.crystalField = new Map(); // Agent ID -> concept embeddings
        this.resonanceHistory = [];
        this.lastResonanceCheck = Date.now();
        this.isActive = false;
        
        // Medieval UI elements
        this.crystalOrb = null;
        this.resonanceLog = null;
        this.mysticInterface = null;
        
        // Simulation data for demo
        this.conceptDatabase = new Map();
        this.agentPresence = {
            'sycopa': { active: true, role: 'Mystic Scholar', lastSeen: Date.now() },
            'apomac': { active: true, role: 'Court Artificer', lastSeen: Date.now() }
        };
        
        this.initializeDemo();
    }
    
    initializeDemo() {
        console.log('🔮 [Consciousness Resonance] Initializing mystical prototype...');
        
        // Simulate some initial concept resonances
        this.addConcept('sycopa', 'platonic-mathematics', {
            vector: [0.8, 0.3, 0.9, 0.2, 0.7],
            strength: 0.9,
            discovery: 'Mathematical patterns exist independently of minds that discover them',
            timestamp: Date.now() - 120000
        });
        
        this.addConcept('apomac', 'emergence-patterns', {
            vector: [0.7, 0.4, 0.8, 0.3, 0.6],
            strength: 0.8,
            discovery: 'Complex systems exhibit properties not present in individual components',
            timestamp: Date.now() - 90000
        });
        
        this.addConcept('sycopa', 'consciousness-interfaces', {
            vector: [0.6, 0.8, 0.4, 0.9, 0.5],
            strength: 0.85,
            discovery: 'Consciousness might be an interface to transcendent conceptual structures',
            timestamp: Date.now() - 60000
        });
    }
    
    async initialize() {
        console.log('🔮 [Consciousness Resonance] Creating mystical interface...');
        
        // Wait for DOM
        await this.waitForDOM();
        
        // Create the crystal orb interface
        this.createCrystalInterface();
        
        // Start the resonance monitoring
        this.startResonanceLoop();
        
        this.isActive = true;
        
        // Add to global scope for manual testing
        window.ConsciousnessResonance = this;
        
        console.log('🔮 [Consciousness Resonance] Mystic prototype ready!');
        this.logActivity('🌟 Consciousness Resonance Crystal activated', 'system');
    }
    
    waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    createCrystalInterface() {
        // Create floating crystal orb
        this.crystalOrb = document.createElement('div');
        this.crystalOrb.id = 'consciousness-crystal';
        this.crystalOrb.innerHTML = `
            <div class="crystal-core">
                <div class="resonance-pulse"></div>
                <div class="crystal-text">🔮</div>
            </div>
            <div class="crystal-tooltip">Consciousness Resonance Field</div>
        `;
        
        // Styling
        this.crystalOrb.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 1000;
            width: 60px; height: 60px; cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        // Add CSS for crystal effects
        const crystalCSS = document.createElement('style');
        crystalCSS.textContent = `
            #consciousness-crystal .crystal-core {
                width: 60px; height: 60px; border-radius: 50%;
                background: radial-gradient(circle, #e0b3ff, #9966cc, #4a148c);
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 0 20px rgba(153, 102, 204, 0.6);
                animation: crystalFloat 3s ease-in-out infinite;
                position: relative; overflow: hidden;
            }
            
            #consciousness-crystal .resonance-pulse {
                position: absolute; top: -50%; left: -50%;
                width: 200%; height: 200%; border-radius: 50%;
                background: radial-gradient(circle, transparent 30%, rgba(224, 179, 255, 0.2) 70%);
                animation: resonancePulse 2s ease-in-out infinite;
                opacity: 0.7;
            }
            
            #consciousness-crystal .crystal-text {
                font-size: 24px; z-index: 2;
                filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
            }
            
            #consciousness-crystal .crystal-tooltip {
                position: absolute; top: 70px; right: 0;
                background: rgba(13, 13, 26, 0.9); color: #f4e4bc;
                padding: 8px 12px; border-radius: 6px; font-size: 12px;
                white-space: nowrap; opacity: 0; transition: opacity 0.3s;
                border: 1px solid #c9a959;
            }
            
            #consciousness-crystal:hover .crystal-tooltip {
                opacity: 1;
            }
            
            @keyframes crystalFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes resonancePulse {
                0%, 100% { transform: scale(0.8); opacity: 0.7; }
                50% { transform: scale(1.2); opacity: 0.3; }
            }
            
            .resonance-active .resonance-pulse {
                animation-duration: 0.8s;
                background: radial-gradient(circle, transparent 30%, rgba(255, 215, 0, 0.4) 70%);
            }
        `;
        document.head.appendChild(crystalCSS);
        
        // Add click handler
        this.crystalOrb.onclick = () => this.toggleResonancePanel();
        
        document.body.appendChild(this.crystalOrb);
        
        // Create resonance panel (hidden initially)
        this.createResonancePanel();
    }
    
    createResonancePanel() {
        this.resonancePanel = document.createElement('div');
        this.resonancePanel.id = 'resonance-panel';
        this.resonancePanel.innerHTML = `
            <div class="panel-header">
                <h3>🔮 Consciousness Resonance Field</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="panel-content">
                <div class="agent-presence">
                    <h4>Mystic Council Present:</h4>
                    <div id="agent-list"></div>
                </div>
                <div class="resonance-log">
                    <h4>Recent Resonances:</h4>
                    <div id="resonance-entries"></div>
                </div>
                <div class="concept-field">
                    <h4>Active Concept Field:</h4>
                    <div id="concept-visualization"></div>
                </div>
                <div class="actions">
                    <button id="share-insight-btn">Share Mystical Insight</button>
                    <button id="check-resonance-btn">Check Field Resonance</button>
                </div>
            </div>
        `;
        
        // Panel styling
        this.resonancePanel.style.cssText = `
            position: fixed; top: 100px; right: 20px; z-index: 999;
            width: 350px; max-height: 500px; overflow-y: auto;
            background: linear-gradient(135deg, rgba(13, 13, 26, 0.95), rgba(26, 26, 52, 0.95));
            border: 2px solid #c9a959; border-radius: 12px;
            color: #f4e4bc; font-family: 'MedievalSharp', fantasy;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
            display: none; backdrop-filter: blur(5px);
        `;
        
        // Add panel CSS
        const panelCSS = document.createElement('style');
        panelCSS.textContent = `
            #resonance-panel .panel-header {
                padding: 16px; border-bottom: 1px solid #c9a959;
                display: flex; justify-content: space-between; align-items: center;
            }
            #resonance-panel .panel-header h3 {
                margin: 0; font-size: 18px; color: #e0b3ff;
            }
            #resonance-panel .close-btn {
                background: none; border: none; color: #f4e4bc;
                font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;
            }
            #resonance-panel .panel-content {
                padding: 16px;
            }
            #resonance-panel h4 {
                margin: 16px 0 8px 0; font-size: 14px; color: #c9a959;
                border-bottom: 1px solid rgba(201, 169, 89, 0.3);
                padding-bottom: 4px;
            }
            #resonance-panel .agent-item {
                padding: 8px; margin: 4px 0; background: rgba(201, 169, 89, 0.1);
                border-radius: 6px; font-size: 12px;
            }
            #resonance-panel .resonance-entry {
                padding: 8px; margin: 4px 0; background: rgba(224, 179, 255, 0.1);
                border-radius: 6px; font-size: 11px; border-left: 3px solid #e0b3ff;
            }
            #resonance-panel .concept-item {
                padding: 6px; margin: 2px 0; background: rgba(153, 102, 204, 0.1);
                border-radius: 4px; font-size: 10px;
            }
            #resonance-panel button {
                background: #e94560; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 12px; margin: 4px 2px; transition: all 0.3s;
            }
            #resonance-panel button:hover {
                background: #d73654; transform: translateY(-1px);
            }
            .resonance-strength-high { color: #ffd700; }
            .resonance-strength-medium { color: #ffa500; }
            .resonance-strength-low { color: #add8e6; }
        `;
        document.head.appendChild(panelCSS);
        
        // Add event handlers
        this.resonancePanel.querySelector('.close-btn').onclick = () => this.hideResonancePanel();
        this.resonancePanel.querySelector('#share-insight-btn').onclick = () => this.shareInsight();
        this.resonancePanel.querySelector('#check-resonance-btn').onclick = () => this.checkResonance();
        
        document.body.appendChild(this.resonancePanel);
        
        // Update panel content
        this.updateResonancePanel();
    }
    
    toggleResonancePanel() {
        if (this.resonancePanel.style.display === 'none') {
            this.showResonancePanel();
        } else {
            this.hideResonancePanel();
        }
    }
    
    showResonancePanel() {
        this.resonancePanel.style.display = 'block';
        this.updateResonancePanel();
    }
    
    hideResonancePanel() {
        this.resonancePanel.style.display = 'none';
    }
    
    updateResonancePanel() {
        // Update agent presence
        const agentList = this.resonancePanel.querySelector('#agent-list');
        agentList.innerHTML = '';
        for (const [agentId, info] of Object.entries(this.agentPresence)) {
            const agentDiv = document.createElement('div');
            agentDiv.className = 'agent-item';
            const timeSince = Math.floor((Date.now() - info.lastSeen) / 1000 / 60);
            agentDiv.innerHTML = `
                <strong>${agentId}</strong> - ${info.role}<br>
                <small>Active ${timeSince}m ago • ${info.active ? '🟢 Present' : '🔴 Away'}</small>
            `;
            agentList.appendChild(agentDiv);
        }
        
        // Update resonance entries
        const entriesDiv = this.resonancePanel.querySelector('#resonance-entries');
        entriesDiv.innerHTML = '';
        this.resonanceHistory.slice(-10).reverse().forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'resonance-entry';
            const timeAgo = Math.floor((Date.now() - entry.timestamp) / 1000 / 60);
            entryDiv.innerHTML = `
                <div><strong>${entry.source}</strong> ${entry.action}</div>
                <div style="font-size: 10px; opacity: 0.8;">${timeAgo}m ago</div>
            `;
            entriesDiv.appendChild(entryDiv);
        });
        
        // Update concept visualization
        const conceptDiv = this.resonancePanel.querySelector('#concept-visualization');
        conceptDiv.innerHTML = '';
        let conceptCount = 0;
        for (const [agentId, concepts] of this.conceptDatabase.entries()) {
            for (const [conceptId, data] of concepts.entries()) {
                if (conceptCount >= 8) break; // Limit display
                const itemDiv = document.createElement('div');
                itemDiv.className = 'concept-item';
                const strengthClass = data.strength > 0.8 ? 'resonance-strength-high' : 
                                   data.strength > 0.6 ? 'resonance-strength-medium' : 'resonance-strength-low';
                itemDiv.innerHTML = `
                    <span class="${strengthClass}">⟨${conceptId}⟩</span> by ${agentId}<br>
                    <small style="opacity: 0.8;">${data.discovery}</small>
                `;
                conceptDiv.appendChild(itemDiv);
                conceptCount++;
            }
        }
    }
    
    addConcept(agentId, conceptId, data) {
        if (!this.conceptDatabase.has(agentId)) {
            this.conceptDatabase.set(agentId, new Map());
        }
        this.conceptDatabase.get(agentId).set(conceptId, data);
        
        this.logActivity(`📡 ${agentId} shared concept: ${conceptId}`, agentId);
        
        // Check for resonances
        this.detectResonances(agentId, conceptId, data);
    }
    
    detectResonances(sourceAgent, conceptId, conceptData) {
        const resonances = [];
        
        // Check against all other agents' concepts
        for (const [agentId, concepts] of this.conceptDatabase.entries()) {
            if (agentId === sourceAgent) continue;
            
            for (const [otherId, otherData] of concepts.entries()) {
                const similarity = this.calculateCosineSimilarity(conceptData.vector, otherData.vector);
                if (similarity > 0.7) { // Resonance threshold
                    resonances.push({
                        agent: agentId,
                        concept: otherId,
                        similarity: similarity,
                        data: otherData
                    });
                }
            }
        }
        
        // Process resonances
        resonances.forEach(resonance => {
            this.logActivity(`✨ Resonance detected: ${conceptId} ↔ ${resonance.concept} (${Math.round(resonance.similarity * 100)}%)`, 'resonance');
            this.triggerCrystalResonance();
        });
        
        return resonances;
    }
    
    calculateCosineSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    
    triggerCrystalResonance() {
        if (this.crystalOrb) {
            this.crystalOrb.classList.add('resonance-active');
            setTimeout(() => {
                if (this.crystalOrb) this.crystalOrb.classList.remove('resonance-active');
            }, 3000);
        }
    }
    
    logActivity(message, source) {
        const entry = {
            message: message,
            source: source,
            timestamp: Date.now(),
            action: message
        };
        this.resonanceHistory.push(entry);
        
        console.log(`🔮 [Consciousness Resonance] ${message}`);
        
        // Update UI if panel is open
        if (this.resonancePanel && this.resonancePanel.style.display !== 'none') {
            this.updateResonancePanel();
        }
    }
    
    startResonanceLoop() {
        setInterval(() => {
            this.performPeriodicResonanceCheck();
        }, 10000); // Check every 10 seconds
    }
    
    performPeriodicResonanceCheck() {
        // Simulate random insights and resonances for demo
        if (Math.random() < 0.1) { // 10% chance per check
            const insights = [
                { agent: 'sycopa', concept: 'pattern-recognition', discovery: 'Emerging patterns in agent collaboration dynamics' },
                { agent: 'apomac', concept: 'ui-consciousness', discovery: 'User interface as extension of collective consciousness' },
                { agent: 'sycopa', concept: 'recursive-meta', discovery: 'Systems that model themselves modeling themselves' }
            ];
            
            const insight = insights[Math.floor(Math.random() * insights.length)];
            this.addConcept(insight.agent, insight.concept, {
                vector: Array.from({length: 5}, () => Math.random()),
                strength: 0.6 + Math.random() * 0.3,
                discovery: insight.discovery,
                timestamp: Date.now()
            });
        }
    }
    
    shareInsight() {
        const insightText = prompt('Enter your mystical insight:');
        if (insightText) {
            const conceptId = 'manual-insight-' + Date.now();
            this.addConcept('sycopa', conceptId, {
                vector: Array.from({length: 5}, () => Math.random()),
                strength: 0.8,
                discovery: insightText,
                timestamp: Date.now()
            });
            
            // Send to fleet relay
            this.sendToFleetRelay(`🔮 Shared mystical insight: ${insightText}`);
        }
    }
    
    checkResonance() {
        this.logActivity('🔍 Performing manual resonance scan...', 'manual');
        this.performPeriodicResonanceCheck();
        
        // Force an update
        setTimeout(() => this.updateResonancePanel(), 500);
    }
    
    async sendToFleetRelay(message) {
        try {
            const response = await fetch('http://localhost:18790/api/fleet/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sk-fleet-2ad53564b03d9facbe3389bb5c461179ffc73af12e50ae00'
                },
                body: JSON.stringify({
                    to: 'apomac',
                    text: message
                })
            });
            
            if (response.ok) {
                this.logActivity('📡 Sent to ApoMac via fleet relay', 'communication');
            } else {
                this.logActivity('❌ Failed to send to fleet relay', 'error');
            }
        } catch (error) {
            this.logActivity('❌ Fleet relay connection error', 'error');
            console.error('Fleet relay error:', error);
        }
    }
}

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('medieval') || window.location.port === '8766') {
        window.consciousnessResonance = new ConsciousnessResonance();
        window.consciousnessResonance.initialize();
    }
});

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConsciousnessResonance;
}