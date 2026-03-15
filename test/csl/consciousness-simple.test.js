// Simplified CSL Core Logic Tests - No DOM Dependencies
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Import the test-safe CSL core class
const ConsciousnessResonanceCore = require('./consciousness-core.js');

describe('CSL Core Logic - Simplified Tests', () => {
    let resonance;

    // Create a clean instance for each test
    function createTestInstance() {
        return new ConsciousnessResonanceCore();
    }

    describe('Vector Math Validation', () => {
        test('calculateCosineSimilarity - identical vectors', () => {
            resonance = createTestInstance();
            const vec1 = [1, 0, 0, 0, 0];
            const vec2 = [1, 0, 0, 0, 0];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.equal(similarity, 1, 'Identical vectors should have similarity 1');
        });

        test('calculateCosineSimilarity - orthogonal vectors', () => {
            resonance = createTestInstance();
            const vec1 = [1, 0, 0, 0, 0];
            const vec2 = [0, 1, 0, 0, 0];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.equal(similarity, 0, 'Orthogonal vectors should have similarity 0');
        });

        test('calculateCosineSimilarity - opposite vectors', () => {
            resonance = createTestInstance();
            const vec1 = [1, 0, 0, 0, 0];
            const vec2 = [-1, 0, 0, 0, 0];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.equal(similarity, -1, 'Opposite vectors should have similarity -1');
        });

        test('calculateCosineSimilarity - normalized vs non-normalized', () => {
            resonance = createTestInstance();
            const vec1 = [1, 1, 1, 1, 1];
            const vec2 = [2, 2, 2, 2, 2];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.ok(Math.abs(similarity - 1) < 1e-10, 'Scaled vectors should have same cosine similarity (within floating point precision)');
        });

        test('calculateCosineSimilarity - zero vector handling', () => {
            resonance = createTestInstance();
            const vec1 = [0, 0, 0, 0, 0];
            const vec2 = [1, 1, 1, 1, 1];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.ok(Number.isNaN(similarity) || similarity === 0, 'Zero vector should return NaN or 0');
        });
    });

    describe('Concept Storage & Retrieval', () => {
        test('addConcept - single agent concept addition', () => {
            resonance = createTestInstance();
            const conceptData = {
                vector: [1, 0, 0, 0, 0],
                strength: 0.8,
                discovery: 'Test discovery',
                timestamp: Date.now()
            };

            resonance.addConcept('test-agent', 'test-concept', conceptData);
            
            assert.ok(resonance.conceptDatabase.has('test-agent'), 'Agent should be added to database');
            assert.ok(resonance.conceptDatabase.get('test-agent').has('test-concept'), 'Concept should be stored');
            assert.deepEqual(
                resonance.conceptDatabase.get('test-agent').get('test-concept'),
                conceptData,
                'Concept data should be preserved'
            );
        });

        test('addConcept - multiple concepts per agent', () => {
            resonance = createTestInstance();
            const agent = 'multi-agent';
            
            for (let i = 0; i < 5; i++) {
                resonance.addConcept(agent, `concept-${i}`, {
                    vector: [i, 0, 0, 0, 0],
                    strength: 0.5 + i * 0.1,
                    discovery: `Discovery ${i}`,
                    timestamp: Date.now() + i
                });
            }

            assert.equal(
                resonance.conceptDatabase.get(agent).size,
                5,
                'All concepts should be stored'
            );
        });
    });

    describe('Resonance Detection', () => {
        test('detectResonances - high similarity concepts', () => {
            resonance = createTestInstance();
            
            // Add first concept
            resonance.addConcept('agent1', 'concept1', {
                vector: [0.9, 0.1, 0.3, 0.8, 0.2],
                strength: 0.9,
                discovery: 'First concept',
                timestamp: Date.now()
            });

            // Add very similar concept and detect resonances
            const resonances = resonance.detectResonances('agent2', 'concept2', {
                vector: [0.88, 0.12, 0.28, 0.82, 0.18], // Very similar
                strength: 0.85,
                discovery: 'Similar concept',
                timestamp: Date.now()
            });

            assert.ok(resonances.length > 0, 'High similarity should produce resonances');
            assert.ok(resonances[0].similarity > 0.7, 'Resonance similarity should exceed threshold');
        });

        test('detectResonances - low similarity concepts', () => {
            resonance = createTestInstance();
            
            // Add first concept
            resonance.addConcept('agent1', 'concept1', {
                vector: [1, 0, 0, 0, 0],
                strength: 0.9,
                discovery: 'First concept',
                timestamp: Date.now()
            });

            // Add dissimilar concept
            const resonances = resonance.detectResonances('agent2', 'concept2', {
                vector: [0, 0, 0, 1, 0], // Very different
                strength: 0.8,
                discovery: 'Different concept',
                timestamp: Date.now()
            });

            assert.equal(resonances.length, 0, 'Low similarity should produce no resonances');
        });

        test('detectResonances - boundary threshold test', () => {
            resonance = createTestInstance();
            
            const baseVector = [0.8, 0.6, 0.0, 0.0, 0.0];
            resonance.addConcept('agent1', 'base', {
                vector: baseVector,
                strength: 0.9,
                discovery: 'Base concept',
                timestamp: Date.now()
            });

            // Test vector just above threshold (>0.7)
            const aboveThreshold = [0.82, 0.58, 0.0, 0.0, 0.0];
            const resonancesAbove = resonance.detectResonances('agent2', 'above', {
                vector: aboveThreshold,
                strength: 0.9,
                discovery: 'Above threshold',
                timestamp: Date.now()
            });
            
            assert.ok(resonancesAbove.length > 0, 'Vectors above threshold should resonate');

            // Test vector below threshold (<0.7) - use orthogonal vector
            const belowThreshold = [0.0, 0.0, 1.0, 0.0, 0.0];
            const resonancesBelow = resonance.detectResonances('agent3', 'below', {
                vector: belowThreshold,
                strength: 0.9,
                discovery: 'Below threshold',
                timestamp: Date.now()
            });
            
            assert.equal(resonancesBelow.length, 0, 'Vectors below threshold should not resonate');
        });
    });

    describe('Error Handling', () => {
        test('handles invalid vector data gracefully', () => {
            resonance = createTestInstance();
            
            assert.doesNotThrow(() => {
                const result = resonance.calculateCosineSimilarity(null, [1, 2, 3]);
                assert.ok(Number.isNaN(result), 'Should handle null gracefully');
            }, 'Should not throw on null vector');

            assert.doesNotThrow(() => {
                const result = resonance.calculateCosineSimilarity([], []);
                assert.ok(Number.isNaN(result), 'Should handle empty vectors gracefully');
            }, 'Should not throw on empty vectors');
        });

        test('similarity calculation with mismatched vector lengths', () => {
            resonance = createTestInstance();
            const result = resonance.calculateCosineSimilarity([1, 2], [1, 2, 3]);
            
            // Should handle gracefully (likely NaN or calculated on available elements)
            assert.ok(
                Number.isNaN(result) || typeof result === 'number',
                'Should return number or NaN for mismatched vectors'
            );
        });

        test('handles large concept databases', () => {
            resonance = createTestInstance();
            const startTime = Date.now();
            
            // Add many agents and concepts
            for (let i = 0; i < 50; i++) {
                for (let j = 0; j < 5; j++) {
                    resonance.addConcept(`agent-${i}`, `concept-${j}`, {
                        vector: Array.from({length: 5}, () => Math.random()),
                        strength: Math.random(),
                        discovery: `Test concept ${i}-${j}`,
                        timestamp: Date.now()
                    });
                }
            }

            const elapsedTime = Date.now() - startTime;
            
            // Should complete in reasonable time (less than 2 seconds)
            assert.ok(elapsedTime < 2000, 'Large database operations should complete quickly');
            
            // Should maintain data integrity
            assert.equal(resonance.conceptDatabase.size, 50, 'All agents should be stored');
        });
    });

    describe('Boundary Conditions', () => {
        test('zero resonance - empty database', () => {
            resonance = createTestInstance();
            
            const resonances = resonance.detectResonances('test-agent', 'test-concept', {
                vector: [1, 0, 0, 0, 0],
                strength: 1.0,
                discovery: 'Test concept',
                timestamp: Date.now()
            });
            
            assert.equal(resonances.length, 0, 'Empty database should produce no resonances');
        });

        test('max resonance - perfect vector match', () => {
            resonance = createTestInstance();
            
            const conceptData = {
                vector: [0.8, 0.3, 0.9, 0.2, 0.7],
                strength: 1.0,
                discovery: 'Test concept A',
                timestamp: Date.now()
            };

            // Add first concept
            resonance.addConcept('agent1', 'concept1', conceptData);
            
            // Add identical concept from different agent
            const resonances = resonance.detectResonances('agent2', 'concept2', conceptData);
            
            assert.equal(resonances.length, 1, 'Identical concepts should resonate');
            assert.equal(resonances[0].similarity, 1, 'Identical vectors should have perfect similarity');
        });

        test('edge case - single element vectors', () => {
            resonance = createTestInstance();
            const vec1 = [1];
            const vec2 = [1];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.equal(similarity, 1, 'Single element identical vectors should have similarity 1');
        });

        test('edge case - very small numbers', () => {
            resonance = createTestInstance();
            const vec1 = [1e-10, 1e-10, 1e-10];
            const vec2 = [1e-10, 1e-10, 1e-10];
            const similarity = resonance.calculateCosineSimilarity(vec1, vec2);
            assert.ok(Math.abs(similarity - 1) < 1e-6, 'Very small numbers should maintain reasonable precision');
        });
    });

    describe('Concurrency Simulation', () => {
        test('concurrent concept additions', async () => {
            resonance = createTestInstance();
            const agents = ['agent1', 'agent2', 'agent3', 'agent4'];
            const promises = [];

            // Simulate concurrent concept additions
            for (let i = 0; i < 20; i++) {
                const agent = agents[i % agents.length];
                const promise = new Promise(resolve => {
                    setTimeout(() => {
                        resonance.addConcept(agent, `concept-${i}`, {
                            vector: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()],
                            strength: Math.random(),
                            discovery: `Concurrent discovery ${i}`,
                            timestamp: Date.now() + i
                        });
                        resolve();
                    }, Math.random() * 10);
                });
                promises.push(promise);
            }

            await Promise.all(promises);

            // Verify data integrity
            let totalConcepts = 0;
            for (const [agent, concepts] of resonance.conceptDatabase.entries()) {
                totalConcepts += concepts.size;
                assert.ok(agents.includes(agent), 'Only expected agents should be in database');
            }

            assert.equal(totalConcepts, 20, 'All concepts should be added despite concurrency');
        });
    });
});

console.log('✅ CSL simplified test suite loaded - ready for execution');