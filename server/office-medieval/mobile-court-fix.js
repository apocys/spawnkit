// Mobile Royal Court Fix
// Emergency hotfix for unresponsive close button on mobile

(function() {
  'use strict';
  
  function injectMobileFix() {
    var style = document.createElement('style');
    style.textContent = `
      .rc-close-btn {
        position: absolute !important;
        top: 8px !important;
        right: 12px !important;
        cursor: pointer !important;
        color: rgba(168,162,153,.7) !important;
        font-size: 24px !important;
        background: none !important;
        border: none !important;
        padding: 8px !important;
        min-width: 44px !important;
        min-height: 44px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 10000 !important;
        transition: color .2s !important;
        -webkit-tap-highlight-color: transparent !important;
        touch-action: manipulation !important;
      }
      .rc-close-btn:hover, .rc-close-btn:active {
        color: #c9a959 !important;
        background: rgba(201,169,89,.1) !important;
      }
      
      /* Make the entire overlay clickable to close on mobile */
      @media (max-width: 768px) {
        #royal-court-overlay {
          -webkit-tap-highlight-color: transparent !important;
        }
        
        /* Add a secondary close method - double tap anywhere */
        .rc-content::before {
          content: "Tap the ✕ or double-tap anywhere to close";
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          color: rgba(168,162,153,.6);
          font-size: 12px;
          background: rgba(0,0,0,.8);
          padding: 4px 12px;
          border-radius: 12px;
          white-space: nowrap;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  function enhanceCloseButton() {
    var closeBtn = document.querySelector('.rc-close-btn');
    if (!closeBtn) return;
    
    // Remove existing listeners and add a more robust one
    var newBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newBtn, closeBtn);
    
    // Add multiple event types for better mobile support
    ['click', 'touchend', 'mouseup'].forEach(function(eventType) {
      newBtn.addEventListener(eventType, function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Royal Court: Close button triggered via', eventType);
        if (window.RoyalCourt && typeof window.RoyalCourt.hide === 'function') {
          window.RoyalCourt.hide();
        }
      }, { passive: false });
    });
    
    // Add double-tap to close on mobile
    var tapCount = 0;
    var overlay = document.getElementById('royal-court-overlay');
    if (overlay) {
      overlay.addEventListener('touchend', function(e) {
        // Only if tapping the overlay background, not content
        if (e.target === overlay) {
          tapCount++;
          if (tapCount === 1) {
            setTimeout(function() { tapCount = 0; }, 300);
          } else if (tapCount === 2) {
            tapCount = 0;
            console.log('Royal Court: Double-tap close triggered');
            if (window.RoyalCourt && typeof window.RoyalCourt.hide === 'function') {
              window.RoyalCourt.hide();
            }
          }
        }
      });
    }
  }
  
  // Apply fixes when Royal Court is shown
  var originalShow = window.RoyalCourt && window.RoyalCourt.show;
  if (originalShow) {
    window.RoyalCourt.show = function() {
      originalShow.call(this);
      // Apply fixes after overlay is created
      setTimeout(function() {
        enhanceCloseButton();
      }, 100);
    };
  }
  
  // Inject CSS immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMobileFix);
  } else {
    injectMobileFix();
  }
  
  // Apply to existing overlay if present
  if (document.getElementById('royal-court-overlay')) {
    enhanceCloseButton();
  }
  
})();