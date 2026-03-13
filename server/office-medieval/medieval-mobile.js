/* medieval-mobile.js — Mobile responsive behavior */
(function() {
  'use strict';

  var sidebar = null;
  var mobileToggle = null;
  var mobileBackdrop = null;
  var isOpen = false;

  function init() {
    sidebar = document.querySelector('.castle-sidebar');
    mobileToggle = document.getElementById('mobileMenuToggle');
    mobileBackdrop = document.getElementById('mobileBackdrop');
    
    if (!sidebar || !mobileToggle || !mobileBackdrop) return;

    // Mobile menu toggle
    mobileToggle.addEventListener('click', toggleSidebar);
    mobileBackdrop.addEventListener('click', closeSidebar);

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
      if (window.innerWidth <= 768 && isOpen && 
          !sidebar.contains(e.target) && 
          !mobileToggle.contains(e.target)) {
        closeSidebar();
      }
    });

    // Handle orientation change
    window.addEventListener('orientationchange', function() {
      setTimeout(function() {
        if (window.innerWidth > 768 && isOpen) {
          closeSidebar();
        }
      }, 100);
    });

    // Handle window resize
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768 && isOpen) {
        closeSidebar();
      }
    });

    // Touch gesture for Three.js canvas (improve mobile orbit controls)
    setupTouchControls();
  }

  function toggleSidebar() {
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function openSidebar() {
    if (!sidebar || !mobileBackdrop) return;
    isOpen = true;
    sidebar.classList.add('mobile-open');
    mobileBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  function closeSidebar() {
    if (!sidebar || !mobileBackdrop) return;
    isOpen = false;
    sidebar.classList.remove('mobile-open');
    mobileBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  function setupTouchControls() {
    // Improve Three.js OrbitControls on mobile
    if (window.castleApp && window.castleApp.controls) {
      var controls = window.castleApp.controls;
      
      // Enable touch controls
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      
      // Adjust sensitivity for mobile
      controls.panSpeed = 0.8;
      controls.zoomSpeed = 1.2;
      controls.rotateSpeed = 0.5;
      
      // Touch-specific settings
      controls.touches = {
        ONE: window.THREE.TOUCH.ROTATE,
        TWO: window.THREE.TOUCH.DOLLY_PAN
      };
    }
  }

  // Enhanced touch support for hotbar items
  function enhanceTouchSupport() {
    var hotbarItems = document.querySelectorAll('.hotbar-item');
    hotbarItems.forEach(function(item) {
      // Add touch feedback
      item.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.95)';
      });
      
      item.addEventListener('touchend', function() {
        this.style.transform = '';
      });
      
      // Prevent double-tap zoom
      item.addEventListener('touchstart', function(e) {
        e.preventDefault();
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Enhance touch support after a delay to ensure other scripts have loaded
  setTimeout(enhanceTouchSupport, 1000);

  // Export for other scripts
  window.MedievalMobile = {
    openSidebar: openSidebar,
    closeSidebar: closeSidebar,
    isOpen: function() { return isOpen; }
  };
})();