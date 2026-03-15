// Loading Sequence Fix — ensures Royal Court waits for proper initialization
// Fixes race condition where Royal Court shows before loading is complete

(function() {
  'use strict';
  
  // Track initialization state
  var LoadingManager = {
    states: {
      domReady: false,
      engineReady: false,
      castleAppReady: false,
      themesLoaded: false
    },
    
    isFullyReady: function() {
      return this.states.domReady && 
             this.states.engineReady && 
             this.states.castleAppReady;
    },
    
    markReady: function(component) {
      console.log('[Loading] Marking ready:', component);
      this.states[component] = true;
      this.checkAndProceed();
    },
    
    checkAndProceed: function() {
      if (this.isFullyReady() && window.RoyalCourt) {
        console.log('[Loading] All systems ready, safe to show Royal Court');
        // Hide loading screen first
        var loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
          loadingScreen.classList.add('hidden');
          setTimeout(function() {
            loadingScreen.style.display = 'none';
          }, 800);
        }
        
        // Wait a bit more for loading screen transition
        setTimeout(function() {
          if (window.RoyalCourt && window.RoyalCourt.isFirstVisit && window.RoyalCourt.isFirstVisit()) {
            console.log('[Loading] Showing Royal Court after proper initialization');
            window.RoyalCourt.show();
          }
        }, 1000);
      }
    }
  };
  
  // Override the original Royal Court auto-show logic
  var originalRoyalCourt = window.RoyalCourt;
  if (originalRoyalCourt) {
    // Disable auto-show in original script
    window.RoyalCourt.autoShow = false;
    console.log('[Loading] Disabled Royal Court auto-show');
  }
  
  // Monitor DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      LoadingManager.markReady('domReady');
    });
  } else {
    LoadingManager.markReady('domReady');
  }
  
  // Monitor engine initialization
  function waitForEngine() {
    if (window.castleApp && window.castleApp.scene && window.castleApp.characterModels) {
      LoadingManager.markReady('engineReady');
      
      // Monitor for character models to be populated
      function waitForCharacters() {
        if (window.castleApp.characterModels.size > 0) {
          LoadingManager.markReady('castleAppReady');
        } else {
          setTimeout(waitForCharacters, 500);
        }
      }
      setTimeout(waitForCharacters, 1000);
    } else {
      setTimeout(waitForEngine, 500);
    }
  }
  setTimeout(waitForEngine, 1000);
  
  // Emergency fallback - if nothing happens in 15 seconds, force show
  setTimeout(function() {
    if (!LoadingManager.isFullyReady()) {
      console.warn('[Loading] Emergency fallback - forcing ready state');
      Object.keys(LoadingManager.states).forEach(function(key) {
        LoadingManager.states[key] = true;
      });
      LoadingManager.checkAndProceed();
    }
  }, 15000);
  
  // Export for debugging
  window.LoadingManager = LoadingManager;
  
})();