// Test-safe version of ConsciousnessResonance core logic
// Extracted from consciousness-resonance.js for testing

class ConsciousnessResonanceCore {
    constructor() {
        this.conceptDatabase = new Map();
        this.resonanceHistory = [];
        this.lastResonanceCheck = Date.now();
        this.isActive = true;
        
        // Mock agent presence for testing
        this.agentPresence = {
            'sycopa': { active: true, role: 'Mystic Scholar', lastSeen: Date.now() },
            'apomac': { active: true, role: 'Court Artificer', lastSeen: Date.now() }
        };
    }
    
    addConcept(agentId, conceptId, data) {
        if (!this.conceptDatabase.has(agentId)) {
            this.conceptDatabase.set(agentId, new Map());
        }
        this.conceptDatabase.get(agentId).set(conceptId, data);
        
        this.logActivity(`📡 ${agentId} shared concept: ${conceptId}`, agentId);
        
        // Check for resonances
        return this.detectResonances(agentId, conceptId, data);
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
        });
        
        return resonances;
    }
    
    calculateCosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
            return NaN;
        }
        
        if (vec1.length === 0 || vec2.length === 0) {
            return NaN;
        }
        
        const minLength = Math.min(vec1.length, vec2.length);
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < minLength; i++) {
            if (typeof vec1[i] !== 'number' || typeof vec2[i] !== 'number') {
                continue;
            }
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        if (norm1 === 0 || norm2 === 0) {
            return NaN;
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    
    logActivity(message, source) {
        const entry = {
            message: message,
            source: source,
            timestamp: Date.now(),
            action: message
        };
        this.resonanceHistory.push(entry);
        
        // Keep history reasonable for testing
        if (this.resonanceHistory.length > 1000) {
            this.resonanceHistory = this.resonanceHistory.slice(-500);
        }
    }
}

module.exports = ConsciousnessResonanceCore;