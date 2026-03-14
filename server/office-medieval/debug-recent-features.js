/**
 * Debug Recent Features - Cinematic & Responsive Issues
 * Isolates problems introduced in recent refactoring
 */
(function() {
    'use strict';
    
    const DEBUG_LOG = [];
    let debugPanel = null;
    
    function log(msg, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `[${timestamp}] ${msg}`;
        DEBUG_LOG.push({timestamp, msg, level});
        console.log(`[Debug Recent] ${entry}`);
        
        if (level === 'error') {
            showDebugPanel();
        }
    }
    
    function showDebugPanel() {
        if (debugPanel) return;
        
        debugPanel = document.createElement('div');
        debugPanel.id = 'recent-features-debug';
        debugPanel.style.cssText = `
            position: fixed; top: 50px; left: 10px; width: 350px; max-height: 400px;
            background: rgba(13, 13, 26, 0.95); border: 2px solid #e94560;
            border-radius: 8px; padding: 12px; z-index: 999999; overflow-y: auto;
            font-family: 'Crimson Text', serif; font-size: 12px; color: #f4e4bc;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '🐛 Recent Features Debug';
        title.style.cssText = 'margin: 0 0 8px 0; color: #e94560; font-size: 14px;';
        debugPanel.appendChild(title);
        
        const logContainer = document.createElement('div');
        DEBUG_LOG.forEach(entry => {
            const line = document.createElement('div');
            line.style.cssText = `margin: 2px 0; color: ${entry.level === 'error' ? '#e94560' : '#f4e4bc'};`;
            line.textContent = `[${entry.timestamp}] ${entry.msg}`;
            logContainer.appendChild(line);
        });
        debugPanel.appendChild(logContainer);
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute; top: 4px; right: 4px;
            background: #e94560; color: white; border: none; border-radius: 3px;
            width: 20px; height: 20px; cursor: pointer; font-size: 11px;
        `;
        closeBtn.onclick = () => debugPanel.remove();
        debugPanel.appendChild(closeBtn);
        
        document.body.appendChild(debugPanel);
    }
    
    // Test 1: Check if Three.js and scene are ready
    function testThreeJSReady() {
        log('Testing Three.js readiness...');
        
        if (typeof window.THREE === 'undefined') {
            log('❌ Three.js not loaded', 'error');
            return false;
        }
        
        if (!window.castleApp || !window.castleApp.scene) {
            log('❌ Castle scene not ready', 'error');
            return false;
        }
        
        if (!window.castleApp.camera) {
            log('❌ Camera not initialized', 'error');
            return false;
        }
        
        log('✅ Three.js and scene ready');
        return true;
    }
    
    // Test 2: Check for script load failures
    function testScriptLoadFailures() {
        log('Checking for script load failures...');
        
        const expectedScripts = [
            'medieval-cinematic.js',
            'onboarding.js',
            'medieval-scene.js',
            'medieval-world.js',
            'medieval-mobile.js'
        ];
        
        let failures = [];
        expectedScripts.forEach(script => {
            const scriptEl = document.querySelector(`script[src*="${script}"]`);
            if (!scriptEl) {
                failures.push(script);
            }
        });
        
        if (failures.length > 0) {
            log(`❌ Missing scripts: ${failures.join(', ')}`, 'error');
            return false;
        }
        
        log('✅ All expected scripts found in DOM');
        return true;
    }
    
    // Test 3: Check cinematic tour conflicts
    function testCinematicConflicts() {
        log('Testing cinematic tour...');
        
        // Check if tour is blocked by localStorage
        const tourDone = localStorage.getItem('spawnkit-tour-done');
        if (tourDone === 'true') {
            log('⚠️ Tour already marked as done in localStorage');
            return true;
        }
        
        // Check if cinematic functions exist
        if (typeof window.startCinematicTour === 'function') {
            log('✅ Cinematic tour function available');
        } else {
            log('❌ Cinematic tour function not found', 'error');
            return false;
        }
        
        return true;
    }
    
    // Test 4: Check responsive/mobile conflicts
    function testResponsiveConflicts() {
        log('Testing responsive features...');
        
        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            log('❌ Viewport meta tag missing', 'error');
            return false;
        }
        
        // Check if mobile breakpoints are working
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            log(`📱 Mobile mode detected (${window.innerWidth}px)`);
        } else {
            log(`🖥️ Desktop mode (${window.innerWidth}px)`);
        }
        
        return true;
    }
    
    // Test 5: Check for CSS conflicts
    function testCSSConflicts() {
        log('Testing CSS loading...');
        
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        const backgroundColor = computedStyle.backgroundColor;
        
        if (backgroundColor.includes('rgba(0, 0, 0, 0)') || backgroundColor === 'transparent') {
            log('❌ Background color not applied, CSS may not be loading', 'error');
            return false;
        }
        
        log('✅ CSS appears to be loading correctly');
        return true;
    }
    
    // Test 6: Check for timing race conditions  
    function testTimingIssues() {
        log('Testing timing issues...');
        
        // Check if DOM is ready
        if (document.readyState !== 'complete') {
            log(`⚠️ Document not fully loaded (${document.readyState})`);
        } else {
            log('✅ Document ready state: complete');
        }
        
        // Check if window.onload fired
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const domComplete = timing.domComplete - timing.navigationStart;
            const loadComplete = timing.loadEventEnd - timing.navigationStart;
            
            log(`📊 DOM complete: ${domComplete}ms`);
            log(`📊 Load complete: ${loadComplete}ms`);
        }
        
        return true;
    }
    
    // Run all tests
    function runDiagnostics() {
        log('🔍 Starting recent features diagnostics...');
        
        const tests = [
            testScriptLoadFailures,
            testCSSConflicts,
            testTimingIssues,
            testThreeJSReady,
            testCinematicConflicts,
            testResponsiveConflicts
        ];
        
        let passedTests = 0;
        tests.forEach((test, index) => {
            try {
                if (test()) {
                    passedTests++;
                }
            } catch (error) {
                log(`❌ Test ${index + 1} threw error: ${error.message}`, 'error');
            }
        });
        
        log(`📋 Diagnostic complete: ${passedTests}/${tests.length} tests passed`);
        
        if (passedTests < tests.length) {
            showDebugPanel();
            log('⚠️ Issues detected, check debug panel', 'error');
        } else {
            log('✅ All tests passed - issue may be elsewhere');
        }
    }
    
    // Auto-run diagnostics on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runDiagnostics, 1000);
        });
    } else {
        setTimeout(runDiagnostics, 1000);
    }
    
    // Manual trigger for console debugging
    window.debugRecentFeatures = runDiagnostics;
    
    // Monitor for errors
    window.addEventListener('error', function(e) {
        if (e.filename && (
            e.filename.includes('medieval-cinematic') ||
            e.filename.includes('onboarding') ||
            e.filename.includes('mobile')
        )) {
            log(`❌ Script error in ${e.filename}: ${e.message}`, 'error');
        }
    });
    
    log('🔧 Recent features debugger loaded');
})();