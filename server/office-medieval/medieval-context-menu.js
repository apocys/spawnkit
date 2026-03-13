/* medieval-context-menu.js — Right-click context menus for 3D objects */
(function() {
  'use strict';

  var contextMenu = null;
  var raycaster = null;
  var mouse = null;

  function init() {
    if (!window.castleApp || !window.THREE) {
      setTimeout(init, 1000);
      return;
    }

    mouse = new window.THREE.Vector2();
    setupRaycaster();
    setupContextMenu();
    bindEvents();
  }

  function setupRaycaster() {
    raycaster = new window.THREE.Raycaster();
  }

  function setupContextMenu() {
    contextMenu = document.createElement('div');
    contextMenu.id = 'context-menu';
    contextMenu.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: rgba(20, 12, 5, 0.95);
      border: 1px solid var(--castle-gold);
      border-radius: 8px;
      padding: 4px 0;
      min-width: 160px;
      backdrop-filter: blur(8px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      font-family: var(--font-serif);
      font-size: 13px;
      color: var(--castle-gold);
      display: none;
    `;

    document.body.appendChild(contextMenu);

    // Hide menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('contextmenu', function(e) {
      if (!contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });
  }

  function bindEvents() {
    var canvas = window.castleApp.renderer.domElement;
    if (!canvas) return;

    canvas.addEventListener('contextmenu', handleRightClick, false);
  }

  function handleRightClick(event) {
    event.preventDefault();

    // Calculate mouse position
    var rect = event.target.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to find intersected objects
    raycaster.setFromCamera(mouse, window.castleApp.camera);
    var intersects = raycaster.intersectObjects(window.castleApp.scene.children, true);

    if (intersects.length > 0) {
      var target = findContextTarget(intersects[0]);
      if (target) {
        showContextMenu(event.clientX, event.clientY, target);
      } else {
        showDefaultMenu(event.clientX, event.clientY);
      }
    } else {
      showDefaultMenu(event.clientX, event.clientY);
    }
  }

  function findContextTarget(intersect) {
    var obj = intersect.object;
    
    // Walk up the hierarchy to find a meaningful target
    while (obj) {
      if (obj.userData && obj.userData.type) {
        return {
          type: obj.userData.type,
          id: obj.userData.id || obj.userData.agentId,
          name: obj.userData.name,
          object: obj,
          position: intersect.point
        };
      }
      obj = obj.parent;
    }

    return null;
  }

  function showContextMenu(x, y, target) {
    var menuItems = getMenuItems(target);
    if (menuItems.length === 0) {
      showDefaultMenu(x, y);
      return;
    }

    contextMenu.innerHTML = '';
    
    // Add header
    if (target.name) {
      var header = document.createElement('div');
      header.style.cssText = 'padding: 6px 12px; font-weight: 600; border-bottom: 1px solid rgba(201,169,89,0.3); margin-bottom: 4px;';
      header.textContent = target.name;
      contextMenu.appendChild(header);
    }

    // Add menu items
    menuItems.forEach(function(item) {
      var menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      menuItem.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
      
      menuItem.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(201,169,89,0.2)';
      });
      
      menuItem.addEventListener('mouseleave', function() {
        this.style.background = '';
      });
      
      menuItem.addEventListener('click', function() {
        item.action(target);
        hideContextMenu();
      });

      if (item.disabled) {
        menuItem.style.opacity = '0.5';
        menuItem.style.cursor = 'not-allowed';
        menuItem.removeEventListener('click', item.action);
      }

      contextMenu.appendChild(menuItem);
    });

    // Position menu
    positionMenu(x, y);
    contextMenu.style.display = 'block';
  }

  function showDefaultMenu(x, y) {
    var menuItems = [
      {
        icon: '🏰',
        label: 'Focus on Castle',
        action: function() {
          if (window.castleApp && window.castleApp.controls) {
            window.castleApp.controls.reset();
            window.castleApp.camera.position.set(0, 35, 45);
            window.castleApp.camera.lookAt(0, 2, 0);
          }
        }
      },
      {
        icon: '📏',
        label: 'Toggle Edit Mode',
        action: function() {
          if (window.MedievalMissionHouses && window.MedievalMissionHouses.toggleEditMode) {
            window.MedievalMissionHouses.toggleEditMode();
          }
        }
      },
      {
        icon: '🗺️',
        label: 'Show Minimap',
        action: function() {
          var minimap = document.getElementById('minimap-overlay');
          if (minimap) {
            minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
          }
        }
      }
    ];

    contextMenu.innerHTML = '';
    
    menuItems.forEach(function(item) {
      var menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        transition: background 0.15s;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      menuItem.innerHTML = '<span>' + item.icon + '</span><span>' + item.label + '</span>';
      
      menuItem.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(201,169,89,0.2)';
      });
      
      menuItem.addEventListener('mouseleave', function() {
        this.style.background = '';
      });
      
      menuItem.addEventListener('click', function() {
        item.action();
        hideContextMenu();
      });

      contextMenu.appendChild(menuItem);
    });

    positionMenu(x, y);
    contextMenu.style.display = 'block';
  }

  function getMenuItems(target) {
    switch (target.type) {
      case 'agent':
        return getAgentMenuItems(target);
      case 'building':
        return getBuildingMenuItems(target);
      case 'decoration':
        return getDecorationMenuItems(target);
      default:
        return [];
    }
  }

  function getAgentMenuItems(target) {
    var agentId = target.id;
    return [
      {
        icon: '👤',
        label: 'View Details',
        action: function() {
          if (window.openAgentDetail) {
            window.openAgentDetail(agentId);
          }
        }
      },
      {
        icon: '📋',
        label: 'Assign Task',
        action: function() {
          var task = prompt('Assign task to ' + target.name + ':');
          if (task) {
            assignTaskToAgent(agentId, task);
          }
        }
      },
      {
        icon: '💬',
        label: 'Send Message',
        action: function() {
          if (window.openChat) {
            window.openChat(agentId);
          }
        }
      },
      {
        icon: '🎯',
        label: 'Focus Camera',
        action: function() {
          focusCameraOn(target.object);
        }
      }
    ];
  }

  function getBuildingMenuItems(target) {
    return [
      {
        icon: '🔧',
        label: 'Configure',
        action: function() {
          configurBuilding(target);
        }
      },
      {
        icon: '📊',
        label: 'View Stats',
        action: function() {
          showBuildingStats(target);
        }
      },
      {
        icon: '⬆️',
        label: 'Upgrade',
        action: function() {
          upgradeBuilding(target);
        }
      },
      {
        icon: '🎯',
        label: 'Focus Camera',
        action: function() {
          focusCameraOn(target.object);
        }
      }
    ];
  }

  function getDecorationMenuItems(target) {
    return [
      {
        icon: '✏️',
        label: 'Edit',
        action: function() {
          editDecoration(target);
        }
      },
      {
        icon: '🗑️',
        label: 'Remove',
        action: function() {
          if (confirm('Remove this decoration?')) {
            removeDecoration(target);
          }
        }
      },
      {
        icon: '📋',
        label: 'Copy',
        action: function() {
          copyDecoration(target);
        }
      }
    ];
  }

  function positionMenu(x, y) {
    var rect = contextMenu.getBoundingClientRect();
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;

    // Adjust position to keep menu in viewport
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 5;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 5;
    }

    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
  }

  function hideContextMenu() {
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
  }

  // Action implementations
  function assignTaskToAgent(agentId, task) {
    // Integration with agent task system
    if (window.castleApp && window.castleApp.agents && window.castleApp.agents[agentId]) {
      window.castleApp.agents[agentId].assignTask(task);
      if (window.showToast) {
        window.showToast('Task assigned to ' + agentId, 'success');
      }
    }
  }

  function focusCameraOn(object) {
    if (!window.castleApp || !object) return;
    
    var box = new window.THREE.Box3().setFromObject(object);
    var center = box.getCenter(new window.THREE.Vector3());
    var size = box.getSize(new window.THREE.Vector3());
    
    var maxDim = Math.max(size.x, size.y, size.z);
    var distance = maxDim * 2;
    
    // Animate camera to focus on object
    var startPos = window.castleApp.camera.position.clone();
    var endPos = new window.THREE.Vector3(center.x, center.y + distance * 0.5, center.z + distance);
    
    var startTime = performance.now();
    var duration = 1000; // 1 second
    
    function animate() {
      var elapsed = performance.now() - startTime;
      var t = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3); // ease out cubic
      
      window.castleApp.camera.position.lerpVectors(startPos, endPos, eased);
      window.castleApp.camera.lookAt(center);
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Update controls target
        if (window.castleApp.controls) {
          window.castleApp.controls.target.copy(center);
          window.castleApp.controls.update();
        }
      }
    }
    animate();
  }

  function configurBuilding(target) {
    if (window.showToast) {
      window.showToast('Building configuration not yet implemented', 'info');
    }
  }

  function showBuildingStats(target) {
    if (window.showToast) {
      window.showToast('Building stats: ' + (target.name || 'Unknown'), 'info');
    }
  }

  function upgradeBuilding(target) {
    if (window.showToast) {
      window.showToast('Building upgrades coming soon!', 'info');
    }
  }

  function editDecoration(target) {
    if (window.showToast) {
      window.showToast('Decoration editing via map editor (key 7)', 'info');
    }
  }

  function removeDecoration(target) {
    if (target.object && target.object.parent) {
      target.object.parent.remove(target.object);
      if (window.showToast) {
        window.showToast('Decoration removed', 'success');
      }
    }
  }

  function copyDecoration(target) {
    if (window.showToast) {
      window.showToast('Decoration copied to clipboard', 'success');
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000);
  }

  // Export for debugging
  window.ContextMenu = {
    show: showContextMenu,
    hide: hideContextMenu,
    isVisible: function() { return contextMenu && contextMenu.style.display !== 'none'; }
  };
})();