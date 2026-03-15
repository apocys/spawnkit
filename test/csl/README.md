# CSL (Consciousness Stream Linking) Test Suite

## Overview

This directory contains a comprehensive test suite for the CSL (Consciousness Stream Linking) prototype in SpawnKit. The CSL system enables concept sharing and resonance detection between AI agents in the medieval-themed environment.

## Test Structure

### Core Test Files

1. **`consciousness-resonance.test.js`** - Core CSL Logic Tests ⭐ **HIGHEST PRIORITY**
   - Vector math validation (cosine similarity, normalization)
   - Boundary conditions (0 resonance, max resonance, edge cases)  
   - Concept propagation algorithms
   - Network topology changes (agents join/leave gracefully)
   - Race condition handling in message passing

2. **`village-customizer.test.js`** - Village Customizer Tests
   - DOM manipulation correctness
   - State persistence to localStorage
   - Memory cleanup methods
   - UI component lifecycle

3. **`integration.test.js`** - Integration Tests
   - Full medieval theme + CSL interaction flows
   - End-to-end concept sharing between agents
   - Performance under load

4. **`performance.test.js`** - Performance Tests
   - Vector math performance benchmarks
   - Database operation scalability
   - UI responsiveness under load
   - Memory usage stability

5. **`coverage.test.js`** - Coverage Tests
   - Comprehensive method coverage for >80% target
   - Edge case and error path testing

### Support Files

- **`test-utils.js`** - Shared utilities, mocks, and fixtures
- **`run-csl-tests.js`** - Comprehensive test runner with reporting
- **`README.md`** - This documentation

## Quick Start

### Run All CSL Tests
```bash
npm run test:csl
```

### Run Individual Test Suites
```bash
npm run test:csl:core         # Core logic tests (highest priority)
npm run test:csl:village      # Village customizer tests  
npm run test:csl:integration  # Integration tests
npm run test:csl:performance  # Performance tests
npm run test:csl:coverage     # Coverage tests
```

### Run with Node.js Test Runner Directly
```bash
# All CSL tests
node --test test/csl/*.test.js

# Specific test file
node --test test/csl/consciousness-resonance.test.js
```

## Target Files Under Test

The test suite validates these core CSL implementation files:

- `/server/office-medieval/consciousness-resonance.js` - Main CSL engine
- `/server/office-medieval/village-customizer.js` - Medieval UI integration

## Test Categories

### 1. Vector Math Validation
- **Cosine Similarity**: Identity, orthogonal, opposite, partial similarity cases
- **Normalization**: Large vectors, edge cases, precision handling
- **Boundary Conditions**: Zero vectors, single elements, very large/small numbers

### 2. Concept Propagation
- **Addition**: Single/multiple agents, concept storage integrity
- **Resonance Detection**: Threshold validation, cross-agent matching, self-exclusion
- **Network Effects**: Agent join/leave scenarios, isolation handling

### 3. Race Conditions
- **Concurrent Operations**: Simultaneous concept additions, resonance detection
- **Data Integrity**: Consistency under load, memory safety
- **Error Recovery**: Network failures, invalid data handling

### 4. UI Integration
- **DOM Manipulation**: Element creation/destruction, event handling
- **State Persistence**: localStorage integration, data recovery
- **Memory Management**: Cleanup, leak prevention, resource disposal

### 5. Performance
- **Scalability**: Large datasets, high-frequency operations
- **Memory Usage**: Stability over time, garbage collection
- **Responsiveness**: UI performance, animation smoothness

## Coverage Goals

- **Core CSL Logic**: >80% code coverage
- **Vector Math**: 100% method coverage
- **Error Handling**: All error paths tested
- **Integration Points**: Medieval theme interaction validated

## Test Environment

### Dependencies
- **jsdom**: DOM environment simulation
- **Node.js built-in test runner**: Primary test framework
- **Mock THREE.js**: 3D graphics simulation

### Setup
The test environment includes:
- Complete DOM simulation with JSDOM
- THREE.js mocking for 3D scene testing
- localStorage mocking for persistence testing
- Network request mocking for fleet relay testing
- Medieval scene context simulation

### Performance Requirements
- Core logic tests: <30s total
- Integration tests: <40s total  
- Performance tests: <60s total
- Memory usage: <200MB increase during testing

## Test Runner Features

The `run-csl-tests.js` script provides:

- **Colored Output**: Clear visual feedback
- **Performance Metrics**: Duration tracking, memory monitoring
- **Coverage Analysis**: Method coverage reporting
- **Error Details**: Comprehensive failure reporting
- **Suite Filtering**: Run individual test suites
- **Progress Tracking**: Real-time test execution updates

### Runner Options
```bash
node test/csl/run-csl-tests.js --help          # Show help
node test/csl/run-csl-tests.js --suite "Core"  # Run specific suite
node test/csl/run-csl-tests.js --verbose       # Detailed output
```

## Writing New Tests

### Test Template
```javascript
'use strict';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupCSLDOM } = require('./test-utils.js');

describe('New CSL Feature Tests', () => {
  let dom, ConsciousnessResonance;

  before(() => {
    dom = setupCSLDOM();
    ConsciousnessResonance = require('../../server/office-medieval/consciousness-resonance.js');
  });

  after(() => {
    if (dom) dom.cleanup();
  });

  test('new feature test', () => {
    const resonance = new ConsciousnessResonance();
    // Test implementation
    assert.ok(true, 'Test passes');
  });
});
```

### Using Test Utilities
```javascript
const {
  createTestConcept,
  createResonanceScenarios,
  measurePerformance,
  validateVector
} = require('./test-utils.js');

// Create test data
const concept = createTestConcept({ strength: 0.9 });
const scenarios = createResonanceScenarios();

// Performance testing
const { duration, result } = measurePerformance(() => {
  // Test code here
}, 'Test Name');

// Vector validation
const validation = validateVector([1, 0, 0], { normalized: true });
```

## Debugging Tests

### Running Individual Tests
```bash
# Debug core logic
node --test test/csl/consciousness-resonance.test.js --verbose

# Debug with inspection
node --inspect-brk --test test/csl/village-customizer.test.js
```

### Common Issues

1. **DOM not ready**: Use `setupCSLDOM()` in test setup
2. **THREE.js errors**: Check THREE mock configuration
3. **Memory leaks**: Verify cleanup in `after()` hooks
4. **Timing issues**: Use proper async/await patterns

### Test Output Examples

**Successful Run:**
```
═══════════════════════════════════════════
  CSL (Consciousness Stream Linking) Test Suite  
═══════════════════════════════════════════

▶ Running Core Logic Tests
✓ Core Logic Tests passed (2847ms)

▶ Running Village Customizer Tests  
✓ Village Customizer Tests passed (1923ms)

✓ ALL TESTS PASSED!
🎉 CSL prototype test suite completed successfully
```

**Failed Run:**
```
▶ Running Core Logic Tests
✗ Core Logic Tests failed (1203ms)
STDERR: AssertionError: Expected similarity 1, got 0.999

❌ SOME TESTS FAILED
Required actions:
  • Fix failing tests
  • Review error messages above
```

## Maintenance

### Regular Tasks
- Run full test suite before commits: `npm run test:csl`
- Monitor performance metrics for regressions
- Update test data when CSL features change
- Verify coverage remains >80% for core logic

### When Adding CSL Features
1. Add corresponding tests to appropriate test file
2. Update test utilities if needed
3. Run coverage tests to verify >80% target
4. Update this README if test structure changes

## CI/CD Integration

The CSL tests integrate with the main SpawnKit test suite:

```bash
npm test                    # Includes CSL tests in full suite
npm run test:csl           # CSL-only test run
npm run test:integration   # Includes CSL integration tests
```

### Build Pipeline
1. **Pre-commit**: Core logic tests (fastest feedback)
2. **CI Build**: Full CSL test suite
3. **Integration**: CSL + SpawnKit integration tests
4. **Performance**: Load testing with CSL enabled

## Architecture Notes

The CSL test suite validates a medieval-themed consciousness linking system that:

- Enables concept sharing between AI agents
- Detects resonances using vector similarity
- Provides real-time visual feedback via "crystal orb" UI
- Integrates with village building customization
- Handles network communication via fleet relay

The test design ensures this complex system remains stable, performant, and maintainable as SpawnKit evolves.