/* medieval-a11y.js — Accessibility enhancements for medieval theme */
(function() {
  'use strict';

  function init() {
    enhanceKeyboardNavigation();
    addARIALabels();
    improveFocus();
    addScreenReaderSupport();
  }

  function enhanceKeyboardNavigation() {
    // Hotbar keyboard navigation
    var hotbarItems = document.querySelectorAll('.hotbar-item');
    hotbarItems.forEach(function(item, index) {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          var nextItem = hotbarItems[index + 1] || hotbarItems[0];
          nextItem.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          var prevItem = hotbarItems[index - 1] || hotbarItems[hotbarItems.length - 1];
          prevItem.focus();
        }
      });
    });

    // Sidebar navigation
    var statsItems = document.querySelectorAll('.castle-sidebar .stat-item');
    statsItems.forEach(function(item) {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      
      item.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });

    // Panel close buttons
    var closeButtons = document.querySelectorAll('.agent-detail-close, .customize-close, .sk-chat-close');
    closeButtons.forEach(function(btn) {
      btn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // ESC to close modals/overlays
      if (e.key === 'Escape') {
        var openOverlays = document.querySelectorAll('.agent-detail-overlay.visible, .customize-overlay.open, #medievalChat.open');
        if (openOverlays.length > 0) {
          e.preventDefault();
          openOverlays[openOverlays.length - 1].querySelector('button[class*="close"]')?.click();
        }
      }
      
      // CTRL+M to toggle mobile sidebar
      if (e.ctrlKey && e.key === 'm' && window.MedievalMobile) {
        e.preventDefault();
        if (window.MedievalMobile.isOpen()) {
          window.MedievalMobile.closeSidebar();
        } else {
          window.MedievalMobile.openSidebar();
        }
      }
    });
  }

  function addARIALabels() {
    // Hotbar items
    var hotbarLabels = [
      'View Agents', 'Chat', 'Customize Castle', 'Market', 'Settings', 'Library', 'Edit Map'
    ];
    var hotbarItems = document.querySelectorAll('.hotbar-item');
    hotbarItems.forEach(function(item, index) {
      var label = hotbarLabels[index] || 'Action ' + (index + 1);
      item.setAttribute('aria-label', label);
      
      // Add live region for state changes
      if (!item.getAttribute('aria-describedby')) {
        var descId = 'hotbar-desc-' + index;
        item.setAttribute('aria-describedby', descId);
        
        var desc = document.createElement('div');
        desc.id = descId;
        desc.className = 'sr-only';
        desc.textContent = getHotbarItemState(item);
        document.body.appendChild(desc);
      }
    });

    // Stats in sidebar
    var statItems = document.querySelectorAll('.stat-item');
    statItems.forEach(function(item) {
      var value = item.querySelector('.stat-value')?.textContent || '';
      var label = item.querySelector('.stat-label')?.textContent || '';
      item.setAttribute('aria-label', label + ': ' + value);
    });

    // Agent cards
    var agentCards = document.querySelectorAll('[data-agent-id]');
    agentCards.forEach(function(card) {
      var agentName = card.querySelector('.agent-name')?.textContent || 'Agent';
      var status = card.querySelector('.agent-status')?.textContent || 'Unknown status';
      card.setAttribute('aria-label', agentName + ', ' + status);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
    });

    // Canvas
    var canvas = document.querySelector('.castle-main canvas');
    if (canvas) {
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', '3D castle view showing your AI agents and buildings. Use hotbar for interactions.');
    }

    // Minimap
    var minimap = document.getElementById('minimap-overlay');
    if (minimap) {
      minimap.setAttribute('aria-label', 'Castle minimap overview');
    }
  }

  function improveFocus() {
    // Add focus indicators
    var style = document.createElement('style');
    style.textContent = `
      .hotbar-item:focus,
      .stat-item:focus,
      [data-agent-id]:focus,
      button:focus,
      input:focus,
      textarea:focus {
        outline: 2px solid var(--castle-gold) !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 8px rgba(201, 169, 89, 0.4) !important;
      }
      
      .focus-trap {
        position: fixed;
        top: -1px;
        left: -1px;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    // Focus trap for modals
    document.addEventListener('focus', function(e) {
      var activeModal = document.querySelector('.agent-detail-overlay.visible, .customize-overlay.open');
      if (activeModal && !activeModal.contains(e.target)) {
        var focusable = activeModal.querySelectorAll('button, input, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, true);
  }

  function addScreenReaderSupport() {
    // Add screen reader only text
    var srOnlyStyle = document.createElement('style');
    srOnlyStyle.textContent = `
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
    `;
    document.head.appendChild(srOnlyStyle);

    // Add live regions for dynamic content
    var liveRegion = document.createElement('div');
    liveRegion.id = 'castle-announcements';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);

    // Announce important state changes
    window.announceToScreenReader = function(message) {
      var region = document.getElementById('castle-announcements');
      if (region) {
        region.textContent = message;
        setTimeout(function() { region.textContent = ''; }, 5000);
      }
    };

    // Page structure landmarks
    var main = document.querySelector('.castle-main');
    if (main) {
      main.setAttribute('role', 'main');
      main.setAttribute('aria-label', 'Castle main view');
    }

    var sidebar = document.querySelector('.castle-sidebar');
    if (sidebar) {
      sidebar.setAttribute('role', 'navigation');
      sidebar.setAttribute('aria-label', 'Castle navigation and status');
    }

    // Activity log
    var activityLog = document.getElementById('activity-log');
    if (activityLog) {
      activityLog.setAttribute('role', 'log');
      activityLog.setAttribute('aria-label', 'Agent activity feed');
      activityLog.setAttribute('aria-live', 'polite');
    }

    // Skip link for keyboard users
    var skipLink = document.createElement('a');
    skipLink.href = '#castle-main';
    skipLink.textContent = 'Skip to main castle view';
    skipLink.className = 'sr-only';
    skipLink.style.position = 'absolute';
    skipLink.style.top = '10px';
    skipLink.style.left = '10px';
    skipLink.style.zIndex = '10000';
    skipLink.style.background = 'var(--castle-gold)';
    skipLink.style.color = 'var(--castle-navy)';
    skipLink.style.padding = '8px 12px';
    skipLink.style.textDecoration = 'none';
    skipLink.style.borderRadius = '4px';
    
    skipLink.addEventListener('focus', function() {
      this.className = '';
    });
    
    skipLink.addEventListener('blur', function() {
      this.className = 'sr-only';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  function getHotbarItemState(item) {
    if (item.classList.contains('active')) {
      return 'Active';
    }
    return 'Available';
  }

  // Enhanced error announcements
  window.addEventListener('error', function(e) {
    if (window.announceToScreenReader) {
      window.announceToScreenReader('An error occurred: ' + e.message);
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Initialize after other scripts have loaded
  setTimeout(init, 1000);
})();