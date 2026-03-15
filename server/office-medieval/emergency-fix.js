/**
 * Emergency fix for stuck loading screen
 * This script will force dismiss the loading screen if it's stuck
 */
(function() {
    'use strict';
    
    console.log('[EmergencyFix] Initializing...');
    
    // Wait for DOM
    function runFix() {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) {
            console.log('[EmergencyFix] No loading screen found');
            return;
        }
        
        console.log('[EmergencyFix] Found loading screen, checking if stuck...');
        
        // If loading screen is visible after 3 seconds, force hide it
        setTimeout(() => {
            const computedStyle = window.getComputedStyle(loadingScreen);
            if (computedStyle.display !== 'none' && computedStyle.opacity !== '0') {
                console.log('[EmergencyFix] Loading screen is stuck, forcing dismissal');
                
                // Add close button
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '✕ Close Loading';
                closeBtn.style.cssText = `
                    position: absolute; top: 20px; right: 20px;
                    background: #e94560; color: white; border: none;
                    border-radius: 8px; padding: 12px 24px; cursor: pointer;
                    font-size: 16px; z-index: 1000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                closeBtn.onclick = forceCloseLoadingScreen;
                loadingScreen.appendChild(closeBtn);
                
                // Add debug info
                const debugInfo = document.createElement('div');
                debugInfo.style.cssText = `
                    position: absolute; bottom: 20px; left: 20px; right: 20px;
                    background: rgba(0,0,0,0.7); border-radius: 8px; padding: 16px;
                    color: #f4e4bc; font-size: 14px; line-height: 1.4;
                `;
                debugInfo.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px;">🔧 Debug Info:</div>
                    <div>• WebGL Available: ${window._hasWebGL ? 'Yes' : 'No'}</div>
                    <div>• THREE.js Loaded: ${window.THREE ? 'Yes' : 'No'}</div>
                    <div>• Castle App: ${window.castleApp ? 'Yes' : 'No'}</div>
                    <div style="margin-top: 8px; font-style: italic;">
                        The castle is taking longer than expected to load.<br>
                        You can close this loading screen and try refreshing the page.
                    </div>
                `;
                loadingScreen.appendChild(debugInfo);
                
                // Auto-close after 30 seconds if user doesn't click
                setTimeout(() => {
                    if (loadingScreen.parentNode) {
                        console.log('[EmergencyFix] Auto-closing loading screen after 30 seconds');
                        forceCloseLoadingScreen();
                    }
                }, 30000);
            }
        }, 3000);
    }
    
    function forceCloseLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            console.log('[EmergencyFix] Force closing loading screen');
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                
                // Try to initialize basic medieval interface
                initBasicInterface();
            }, 500);
        }
    }
    
    function initBasicInterface() {
        console.log('[EmergencyFix] Initializing basic interface');
        
        // Create a basic castle app if it doesn't exist
        if (!window.castleApp) {
            window.castleApp = {
                engineReady: true,
                addActivityLog: function(message) {
                    console.log('[CastleApp] ' + message);
                },
                onEngineReady: function() {
                    console.log('[CastleApp] Engine ready (basic mode)');
                }
            };
        }
        
        // Show a basic message in the scene container
        const sceneContainer = document.getElementById('scene-container');
        if (sceneContainer && !sceneContainer.querySelector('.basic-message')) {
            const message = document.createElement('div');
            message.className = 'basic-message';
            message.style.cssText = `
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                text-align: center; color: #f4e4bc;
                font-family: 'MedievalSharp', fantasy; font-size: 18px;
                background: rgba(13, 13, 26, 0.8); padding: 24px;
                border-radius: 12px; border: 2px solid #c9a959;
                max-width: 400px; z-index: 50;
            `;
            message.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 16px;">🏰</div>
                <div style="font-weight: bold; margin-bottom: 8px;">Castle Loading Issue</div>
                <div style="font-size: 14px; margin-bottom: 16px;">
                    The 3D castle is having trouble loading. This might be due to:<br>
                    • Network connectivity issues<br>
                    • WebGL compatibility<br>
                    • Browser security settings
                </div>
                <button onclick="location.reload()" style="
                    background: #e94560; color: white; border: none;
                    padding: 8px 16px; border-radius: 6px; cursor: pointer;
                    font-size: 14px; margin: 4px;
                ">🔄 Retry</button>
                <button onclick="window.BlueScreenFix && window.BlueScreenFix.showDebugOverlay()" style="
                    background: #4a5568; color: white; border: none;
                    padding: 8px 16px; border-radius: 6px; cursor: pointer;
                    font-size: 14px; margin: 4px;
                ">🔧 Debug</button>
            `;
            sceneContainer.appendChild(message);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runFix);
    } else {
        runFix();
    }
    
    // Export for manual use
    window.EmergencyFix = {
        forceCloseLoadingScreen,
        initBasicInterface
    };
    
})();