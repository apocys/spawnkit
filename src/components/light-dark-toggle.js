/**
 * SpawnKit Theme Toggle Component
 * 
 * A premium light/dark mode toggle with smooth animations
 * and automatic CSS variable management.
 * 
 * Usage:
 * const toggle = new SpawnKitThemeToggle(containerElement, {
 *   defaultMode: 'auto', // 'light' | 'dark' | 'auto'
 *   onToggle: (mode) => { console.log('Theme changed to:', mode); },
 *   persist: true // save to localStorage
 * });
 * 
 * Methods:
 * toggle.setMode('light');
 * toggle.getMode(); // → 'light'
 */

class SpawnKitThemeToggle {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      defaultMode: 'light', // light as default for Executive
      onToggle: null,
      persist: true,
      storageKey: 'spawnkit-theme',
      ...options
    };

    this.currentMode = null;
    this.systemPreference = this.getSystemPreference();
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    this.init();
  }

  init() {
    this.createToggleElement();
    this.setupEventListeners();
    this.initializeTheme();
  }

  createToggleElement() {
    this.element = document.createElement('div');
    this.element.className = 'spawnkit-theme-toggle';
    this.element.innerHTML = `
      <button class="theme-toggle-btn" type="button" aria-label="Toggle theme">
        <div class="theme-toggle-track">
          <div class="theme-toggle-thumb">
            <div class="theme-toggle-icon theme-toggle-icon--sun">☀️</div>
            <div class="theme-toggle-icon theme-toggle-icon--moon">🌙</div>
          </div>
        </div>
      </button>
    `;

    // Inject styles
    if (!document.querySelector('#spawnkit-theme-toggle-styles')) {
      this.injectStyles();
    }

    this.container.appendChild(this.element);
    
    this.button = this.element.querySelector('.theme-toggle-btn');
    this.thumb = this.element.querySelector('.theme-toggle-thumb');
  }

  injectStyles() {
    const style = document.createElement('style');
    style.id = 'spawnkit-theme-toggle-styles';
    style.textContent = `
      /* SpawnKit Theme Toggle Styles */
      .spawnkit-theme-toggle {
        display: inline-block;
      }

      .theme-toggle-btn {
        position: relative;
        width: 60px;
        height: 32px;
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0;
        outline: none;
        border-radius: 16px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .theme-toggle-btn:focus-visible {
        outline: 2px solid var(--sk-accent, #007AFF);
        outline-offset: 2px;
      }

      .theme-toggle-track {
        width: 100%;
        height: 100%;
        background: var(--sk-bg-tertiary, #e5e5ea);
        border: 1.5px solid var(--sk-border, rgba(0,0,0,0.1));
        border-radius: 16px;
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }

      [data-theme="dark"] .theme-toggle-track {
        background: var(--sk-bg-tertiary, #3a3a3c);
        border-color: var(--sk-border, rgba(255,255,255,0.1));
      }

      .theme-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 26px;
        height: 26px;
        background: var(--sk-surface, #ffffff);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.15),
          0 1px 2px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      [data-theme="dark"] .theme-toggle-thumb {
        background: var(--sk-surface, #2c2c2e);
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.3),
          0 1px 2px rgba(0, 0, 0, 0.2);
      }

      .theme-toggle-btn[data-mode="dark"] .theme-toggle-thumb {
        transform: translateX(28px);
      }

      .theme-toggle-icon {
        position: absolute;
        font-size: 14px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
      }

      .theme-toggle-icon--sun {
        opacity: 1;
        transform: rotate(0deg) scale(1);
      }

      .theme-toggle-icon--moon {
        opacity: 0;
        transform: rotate(-90deg) scale(0.8);
      }

      .theme-toggle-btn[data-mode="dark"] .theme-toggle-icon--sun {
        opacity: 0;
        transform: rotate(90deg) scale(0.8);
      }

      .theme-toggle-btn[data-mode="dark"] .theme-toggle-icon--moon {
        opacity: 1;
        transform: rotate(0deg) scale(1);
      }

      .theme-toggle-btn:hover .theme-toggle-track {
        box-shadow: 0 0 0 4px rgba(var(--sk-accent-rgb, 0, 122, 255), 0.1);
      }

      .theme-toggle-btn:active .theme-toggle-thumb {
        transform: translateX(28px) scale(0.95);
      }

      .theme-toggle-btn[data-mode="light"]:active .theme-toggle-thumb {
        transform: translateX(0) scale(0.95);
      }

      /* Hover animations */
      @keyframes sunRays {
        0%, 100% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(15deg) scale(1.1); }
      }

      .theme-toggle-btn[data-mode="light"]:hover .theme-toggle-icon--sun {
        animation: sunRays 0.6s ease-in-out;
      }

      @keyframes moonGlow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.3); }
      }

      .theme-toggle-btn[data-mode="dark"]:hover .theme-toggle-icon--moon {
        animation: moonGlow 0.8s ease-in-out;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .theme-toggle-btn {
          width: 52px;
          height: 28px;
        }
        
        .theme-toggle-thumb {
          width: 22px;
          height: 22px;
        }
        
        .theme-toggle-btn[data-mode="dark"] .theme-toggle-thumb {
          transform: translateX(22px);
        }
        
        .theme-toggle-icon {
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // Toggle click
    this.button.addEventListener('click', () => {
      const newMode = this.currentMode === 'light' ? 'dark' : 'light';
      this.setMode(newMode);
    });

    // System preference changes
    this.mediaQuery.addEventListener('change', (e) => {
      this.systemPreference = e.matches ? 'dark' : 'light';
      if (this.options.defaultMode === 'auto') {
        this.applyTheme(this.systemPreference);
      }
    });

    // Storage changes from other tabs
    if (this.options.persist) {
      window.addEventListener('storage', (e) => {
        if (e.key === this.options.storageKey) {
          const savedMode = e.newValue;
          if (savedMode && savedMode !== this.currentMode) {
            this.setMode(savedMode, false); // Don't save again
          }
        }
      });
    }
  }

  initializeTheme() {
    let initialMode = this.options.defaultMode;

    // Check localStorage first
    if (this.options.persist) {
      const savedMode = localStorage.getItem(this.options.storageKey);
      if (savedMode && ['light', 'dark', 'auto'].includes(savedMode)) {
        initialMode = savedMode;
      }
    }

    // Resolve auto mode
    if (initialMode === 'auto') {
      initialMode = this.systemPreference;
    }

    this.setMode(initialMode, false);
  }

  getSystemPreference() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setMode(mode, save = true) {
    if (!['light', 'dark'].includes(mode)) {
      console.warn(`Invalid theme mode: ${mode}. Using 'light' instead.`);
      mode = 'light';
    }

    this.currentMode = mode;
    this.applyTheme(mode);
    this.updateToggleUI();

    // Save to localStorage
    if (save && this.options.persist) {
      localStorage.setItem(this.options.storageKey, mode);
    }

    // Callback
    if (this.options.onToggle) {
      this.options.onToggle(mode);
    }
  }

  applyTheme(mode) {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);

    // Apply CSS variables
    const variables = mode === 'light' ? this.getLightModeVariables() : this.getDarkModeVariables();
    
    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  getLightModeVariables() {
    return {
      // Backgrounds
      '--sk-bg-primary': '#f5f5f7',
      '--sk-bg-secondary': '#ffffff',
      '--sk-bg-tertiary': '#e5e5ea',
      
      // Text
      '--sk-text-primary': '#1d1d1f',
      '--sk-text-secondary': '#6e6e73',
      '--sk-text-tertiary': '#aeaeb2',
      
      // Accent
      '--sk-accent': '#007AFF',
      '--sk-accent-rgb': '0, 122, 255',
      
      // Borders & Surfaces
      '--sk-border': 'rgba(0,0,0,0.1)',
      '--sk-shadow': '0 2px 10px rgba(0,0,0,0.08)',
      '--sk-surface': '#ffffff',

      // Executive-specific overrides for light mode
      '--bg-primary': '#f5f5f7',
      '--bg-secondary': '#ffffff',
      '--bg-tertiary': '#e5e5ea',
      '--bg-room': 'rgba(255, 255, 255, 0.8)',
      '--bg-room-hover': 'rgba(255, 255, 255, 0.95)',
      '--bg-frosted': 'rgba(255, 255, 255, 0.8)',
      '--text-primary': '#1d1d1f',
      '--text-secondary': '#6e6e73',
      '--text-tertiary': '#aeaeb2',
      '--border-subtle': 'rgba(0, 0, 0, 0.06)',
      '--border-medium': 'rgba(0, 0, 0, 0.1)',
      '--border-strong': 'rgba(0, 0, 0, 0.16)',
      '--color-accent': '#007AFF',
      '--color-accent-hover': '#0056CC',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.1)',
      '--shadow-lg': '0 8px 40px rgba(0, 0, 0, 0.15)',
      '--shadow-card': '0 2px 20px rgba(0, 0, 0, 0.04)',
    };
  }

  getDarkModeVariables() {
    return {
      // Backgrounds
      '--sk-bg-primary': '#1d1d1f',
      '--sk-bg-secondary': '#2c2c2e',
      '--sk-bg-tertiary': '#3a3a3c',
      
      // Text
      '--sk-text-primary': '#f5f5f7',
      '--sk-text-secondary': '#aeaeb2',
      '--sk-text-tertiary': '#6e6e73',
      
      // Accent
      '--sk-accent': '#0A84FF',
      '--sk-accent-rgb': '10, 132, 255',
      
      // Borders & Surfaces
      '--sk-border': 'rgba(255,255,255,0.1)',
      '--sk-shadow': '0 2px 10px rgba(0,0,0,0.3)',
      '--sk-surface': '#2c2c2e',

      // Executive-specific (restore original dark values)
      '--bg-primary': '#000000',
      '--bg-secondary': '#1c1c1e',
      '--bg-tertiary': '#2c2c2e',
      '--bg-room': 'rgba(28, 28, 30, 0.85)',
      '--bg-room-hover': 'rgba(44, 44, 46, 0.95)',
      '--bg-frosted': 'rgba(29, 29, 31, 0.72)',
      '--text-primary': '#f5f5f7',
      '--text-secondary': '#86868b',
      '--text-tertiary': '#636366',
      '--border-subtle': 'rgba(255, 255, 255, 0.06)',
      '--border-medium': 'rgba(255, 255, 255, 0.1)',
      '--border-strong': 'rgba(255, 255, 255, 0.16)',
      '--color-accent': '#0071e3',
      '--color-accent-hover': '#0077ed',
      '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.3)',
      '--shadow-md': '0 4px 16px rgba(0, 0, 0, 0.3)',
      '--shadow-lg': '0 8px 40px rgba(0, 0, 0, 0.4)',
      '--shadow-card': '0 2px 20px rgba(0, 0, 0, 0.06)',
    };
  }

  updateToggleUI() {
    this.button.setAttribute('data-mode', this.currentMode);
  }

  getMode() {
    return this.currentMode;
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    this.mediaQuery.removeEventListener('change', this.handleSystemChange);
  }
}

// Export for use in modules or window global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpawnKitThemeToggle;
} else {
  window.SpawnKitThemeToggle = SpawnKitThemeToggle;
}