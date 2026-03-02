/**
 * SpawnKit Chat Panel - Real-time agent communication interface
 * Apple Messages-inspired chat UI with OpenClaw relay integration
 */

class SpawnKitChat {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      relayUrl: options.relayUrl || window.OC_RELAY_URL || 'http://localhost:18790',
      theme: options.theme || 'dark',
      onSendMessage: options.onSendMessage || (() => {}),
      collapsed: options.collapsed || false,
      ...options
    };
    
    this.isConnected = false;
    this.agents = [];
    this.sessions = [];
    this.messages = [];
    this.currentAgent = null;
    this.pollInterval = null;
    
    this.init();
  }

  init() {
    this.injectStyles();
    this.createUI();
    this.attachEventListeners();
    this.checkConnection();
    this.startPolling();
    
    if (this.options.collapsed) {
      this.toggle();
    }
  }

  injectStyles() {
    if (document.getElementById('spawnkit-chat-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'spawnkit-chat-styles';
    style.textContent = `
      :root {
        --sk-chat-bg: #1a1a1a;
        --sk-chat-surface: #2a2a2a;
        --sk-chat-border: #3a3a3a;
        --sk-chat-text: #ffffff;
        --sk-chat-text-muted: #a0a0a0;
        --sk-chat-accent: #007aff;
        --sk-chat-accent-bg: rgba(0, 122, 255, 0.15);
        --sk-chat-success: #34c759;
        --sk-chat-warning: #ff9500;
        --sk-chat-error: #ff3b30;
        --sk-chat-shadow: rgba(0, 0, 0, 0.3);
      }
      
      [data-theme="light"] {
        --sk-chat-bg: #ffffff;
        --sk-chat-surface: #f5f5f7;
        --sk-chat-border: #d1d1d6;
        --sk-chat-text: #000000;
        --sk-chat-text-muted: #6d6d70;
        --sk-chat-accent: #007aff;
        --sk-chat-accent-bg: rgba(0, 122, 255, 0.1);
        --sk-chat-success: #30d158;
        --sk-chat-warning: #ff9f0a;
        --sk-chat-error: #ff3b30;
        --sk-chat-shadow: rgba(0, 0, 0, 0.1);
      }

      .spawnkit-chat {
        position: fixed;
        top: 0;
        right: 0;
        width: 320px;
        height: 100vh;
        background: var(--sk-chat-bg);
        border-left: 1px solid var(--sk-chat-border);
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: var(--sk-chat-text);
        z-index: 10000;
        transform: translateX(0);
        transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        box-shadow: -4px 0 20px var(--sk-chat-shadow);
      }

      .spawnkit-chat.collapsed {
        transform: translateX(100%);
      }

      .spawnkit-chat-header {
        padding: 16px;
        border-bottom: 1px solid var(--sk-chat-border);
        background: var(--sk-chat-surface);
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 24px;
      }

      .spawnkit-chat-title {
        font-weight: 600;
        font-size: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .spawnkit-chat-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--sk-chat-error);
        transition: background-color 0.2s;
      }

      .spawnkit-chat-status.connected {
        background: var(--sk-chat-success);
      }

      .spawnkit-chat-minimize {
        background: none;
        border: none;
        color: var(--sk-chat-text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .spawnkit-chat-minimize:hover {
        background: var(--sk-chat-border);
      }

      .spawnkit-chat-agents {
        padding: 12px;
        border-bottom: 1px solid var(--sk-chat-border);
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .spawnkit-chat-agents::-webkit-scrollbar {
        display: none;
      }

      .spawnkit-chat-agent-tabs {
        display: flex;
        gap: 8px;
        min-width: min-content;
      }

      .spawnkit-chat-agent-tab {
        padding: 6px 12px;
        background: transparent;
        border: 1px solid var(--sk-chat-border);
        border-radius: 16px;
        color: var(--sk-chat-text-muted);
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
        font-size: 12px;
      }

      .spawnkit-chat-agent-tab:hover {
        background: var(--sk-chat-border);
      }

      .spawnkit-chat-agent-tab.active {
        background: var(--sk-chat-accent);
        color: white;
        border-color: var(--sk-chat-accent);
      }

      .spawnkit-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scroll-behavior: smooth;
      }

      .spawnkit-chat-message {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        animation: fadeInUp 0.3s ease-out;
      }

      .spawnkit-chat-message.user {
        justify-content: flex-end;
      }

      .spawnkit-chat-message.system,
      .spawnkit-chat-message.event {
        justify-content: center;
      }

      .spawnkit-chat-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--sk-chat-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: 600;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .spawnkit-chat-bubble {
        max-width: 240px;
        padding: 8px 12px;
        border-radius: 18px;
        background: var(--sk-chat-surface);
        position: relative;
        word-wrap: break-word;
      }

      .spawnkit-chat-message.user .spawnkit-chat-bubble {
        background: var(--sk-chat-accent);
        color: white;
      }

      .spawnkit-chat-message.system .spawnkit-chat-bubble,
      .spawnkit-chat-message.event .spawnkit-chat-bubble {
        background: transparent;
        color: var(--sk-chat-text-muted);
        font-size: 12px;
        text-align: center;
        max-width: 280px;
      }

      .spawnkit-chat-message-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
      }

      .spawnkit-chat-message-name {
        font-weight: 600;
        font-size: 12px;
        color: var(--sk-chat-text-muted);
      }

      .spawnkit-chat-message-time {
        font-size: 10px;
        color: var(--sk-chat-text-muted);
        opacity: 0.7;
      }

      .spawnkit-chat-message-icon {
        margin-right: 4px;
      }

      .spawnkit-chat-input {
        padding: 16px;
        border-top: 1px solid var(--sk-chat-border);
        background: var(--sk-chat-surface);
      }

      .spawnkit-chat-input-form {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .spawnkit-chat-input-field {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--sk-chat-border);
        border-radius: 18px;
        background: var(--sk-chat-bg);
        color: var(--sk-chat-text);
        outline: none;
        transition: border-color 0.2s;
      }

      .spawnkit-chat-input-field:focus {
        border-color: var(--sk-chat-accent);
      }

      .spawnkit-chat-input-field::placeholder {
        color: var(--sk-chat-text-muted);
      }

      .spawnkit-chat-send {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--sk-chat-accent);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
      }

      .spawnkit-chat-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spawnkit-chat-demo-notice {
        padding: 12px;
        background: var(--sk-chat-accent-bg);
        border: 1px solid var(--sk-chat-accent);
        border-radius: 8px;
        margin: 16px;
        font-size: 12px;
        text-align: center;
        color: var(--sk-chat-accent);
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (max-width: 768px) {
        .spawnkit-chat {
          width: 100%;
          height: 50vh;
          top: auto;
          bottom: 0;
          border-left: none;
          border-top: 1px solid var(--sk-chat-border);
          border-radius: 16px 16px 0 0;
          transform: translateY(0);
        }

        .spawnkit-chat.collapsed {
          transform: translateY(100%);
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  createUI() {
    this.container.innerHTML = `
      <div class="spawnkit-chat" data-theme="${this.options.theme}">
        <div class="spawnkit-chat-header">
          <div class="spawnkit-chat-title">
            Fleet Chat
            <div class="spawnkit-chat-status"></div>
          </div>
          <button class="spawnkit-chat-minimize" title="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        
        <div class="spawnkit-chat-agents">
          <div class="spawnkit-chat-agent-tabs"></div>
        </div>
        
        <div class="spawnkit-chat-messages"></div>
        
        <div class="spawnkit-chat-input">
          <form class="spawnkit-chat-input-form">
            <input 
              type="text" 
              class="spawnkit-chat-input-field" 
              placeholder="Type a message..."
              maxlength="500"
            />
            <button type="submit" class="spawnkit-chat-send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    `;

    this.chatPanel = this.container.querySelector('.spawnkit-chat');
    this.statusDot = this.container.querySelector('.spawnkit-chat-status');
    this.agentTabs = this.container.querySelector('.spawnkit-chat-agent-tabs');
    this.messagesContainer = this.container.querySelector('.spawnkit-chat-messages');
    this.inputForm = this.container.querySelector('.spawnkit-chat-input-form');
    this.inputField = this.container.querySelector('.spawnkit-chat-input-field');
    this.sendButton = this.container.querySelector('.spawnkit-chat-send');
  }

  attachEventListeners() {
    // Minimize button
    this.container.querySelector('.spawnkit-chat-minimize').addEventListener('click', () => {
      this.toggle();
    });

    // Form submission
    this.inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSendMessage();
    });

    // Input field events
    this.inputField.addEventListener('input', () => {
      this.sendButton.disabled = !this.inputField.value.trim();
    });

    // Agent tab clicks
    this.agentTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('spawnkit-chat-agent-tab')) {
        this.selectAgent(e.target.dataset.agent);
      }
    });
  }

  async checkConnection() {
    try {
      const response = await fetch(`${this.options.relayUrl}/api/oc/health`, {
        timeout: 5000
      });
      
      if (response.ok) {
        this.isConnected = true;
        this.statusDot.classList.add('connected');
        await this.loadAgents();
        await this.loadSessions();
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      this.isConnected = false;
      this.statusDot.classList.remove('connected');
      this.loadDemoData();
    }
  }

  async loadAgents() {
    try {
      const response = await fetch(`${this.options.relayUrl}/api/oc/agents`);
      if (response.ok) {
        this.agents = await response.json();
        this.renderAgentTabs();
      }
    } catch (error) {
      console.warn('Failed to load agents:', error);
    }
  }

  async loadSessions() {
    try {
      const response = await fetch(`${this.options.relayUrl}/api/oc/sessions`);
      if (response.ok) {
        this.sessions = await response.json();
        this.convertSessionsToMessages();
        this.renderMessages();
      }
    } catch (error) {
      console.warn('Failed to load sessions:', error);
    }
  }

  convertSessionsToMessages() {
    // Convert session data to chat messages
    // This would depend on the actual API structure
    this.messages = this.sessions.map(session => ({
      type: 'system',
      text: `${session.agent || 'Agent'} ${session.status || 'active'}`,
      timestamp: new Date(session.timestamp || Date.now()),
      agent: session.agent
    }));
  }

  loadDemoData() {
    // Show demo notice
    if (!this.container.querySelector('.spawnkit-chat-demo-notice')) {
      const notice = document.createElement('div');
      notice.className = 'spawnkit-chat-demo-notice';
      notice.textContent = '🚀 Demo Mode - OpenClaw relay not available';
      this.messagesContainer.parentNode.insertBefore(notice, this.messagesContainer);
    }

    // Demo agents
    this.agents = [
      { id: 'apomac', name: 'ApoMac', avatar: 'AM' },
      { id: 'forge', name: 'Forge', avatar: 'FG' },
      { id: 'sentinel', name: 'Sentinel', avatar: 'SN' },
      { id: 'echo', name: 'Echo', avatar: 'EC' },
      { id: 'hunter', name: 'Hunter', avatar: 'HT' }
    ];

    // Demo messages
    this.messages = [
      {
        type: 'agent',
        agent: 'ApoMac',
        avatar: 'AM',
        text: 'Morning brief: 3 tasks pending, 2 completed overnight',
        timestamp: new Date(Date.now() - 1000 * 60 * 15)
      },
      {
        type: 'agent',
        agent: 'Forge',
        avatar: 'FG',
        text: 'Built new feature branch, running tests...',
        timestamp: new Date(Date.now() - 1000 * 60 * 12)
      },
      {
        type: 'event',
        icon: '✅',
        text: 'All tests passed - ready for review',
        timestamp: new Date(Date.now() - 1000 * 60 * 10)
      },
      {
        type: 'agent',
        agent: 'Sentinel',
        avatar: 'SN',
        text: 'Security audit passed — 0 vulnerabilities detected',
        timestamp: new Date(Date.now() - 1000 * 60 * 8)
      },
      {
        type: 'agent',
        agent: 'Echo',
        avatar: 'EC',
        text: 'Marketing draft ready for review. Analytics show 24% engagement increase.',
        timestamp: new Date(Date.now() - 1000 * 60 * 6)
      },
      {
        type: 'system',
        text: 'Hunter started market research task',
        timestamp: new Date(Date.now() - 1000 * 60 * 5)
      },
      {
        type: 'event',
        icon: '🔔',
        text: 'New deployment scheduled for 2:00 PM',
        timestamp: new Date(Date.now() - 1000 * 60 * 4)
      },
      {
        type: 'agent',
        agent: 'ApoMac',
        avatar: 'AM',
        text: 'Database optimization complete. Query time reduced by 40%.',
        timestamp: new Date(Date.now() - 1000 * 60 * 3)
      },
      {
        type: 'user',
        text: 'Great work everyone! Let\'s push the deployment.',
        timestamp: new Date(Date.now() - 1000 * 60 * 2)
      },
      {
        type: 'agent',
        agent: 'Forge',
        avatar: 'FG',
        text: 'Deployment initiated. ETA: 3 minutes.',
        timestamp: new Date(Date.now() - 1000 * 60 * 1)
      },
      {
        type: 'event',
        icon: '🚀',
        text: 'Deployment successful - all systems operational',
        timestamp: new Date(Date.now() - 1000 * 30)
      },
      {
        type: 'agent',
        agent: 'Echo',
        avatar: 'EC',
        text: 'Customer satisfaction scores just hit 4.8/5. New record!',
        timestamp: new Date(Date.now() - 1000 * 15)
      },
      {
        type: 'system',
        text: 'Auto-scaling triggered - handling increased traffic',
        timestamp: new Date(Date.now() - 1000 * 10)
      },
      {
        type: 'agent',
        agent: 'Hunter',
        avatar: 'HT',
        text: 'Market research complete. Identified 3 new opportunities worth $2M ARR.',
        timestamp: new Date(Date.now() - 1000 * 5)
      },
      {
        type: 'event',
        icon: '⚠️',
        text: 'Server CPU at 85% - monitoring closely',
        timestamp: new Date()
      }
    ];

    this.renderAgentTabs();
    this.renderMessages();
  }

  renderAgentTabs() {
    this.agentTabs.innerHTML = this.agents.map(agent => `
      <button class="spawnkit-chat-agent-tab" data-agent="${agent.id}">
        ${agent.name || agent.id}
      </button>
    `).join('');

    // Select first agent by default
    if (this.agents.length > 0 && !this.currentAgent) {
      this.selectAgent(this.agents[0].id);
    }
  }

  selectAgent(agentId) {
    this.currentAgent = agentId;
    
    // Update tab selection
    this.agentTabs.querySelectorAll('.spawnkit-chat-agent-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.agent === agentId);
    });

    // Update input placeholder
    const agent = this.agents.find(a => a.id === agentId);
    if (agent) {
      this.inputField.placeholder = `Message ${agent.name || agent.id}...`;
    }
  }

  renderMessages() {
    this.messagesContainer.innerHTML = this.messages.map(message => {
      return this.renderMessage(message);
    }).join('');

    // Auto-scroll to bottom
    this.scrollToBottom();
  }

  renderMessage(message) {
    const time = this.formatTime(message.timestamp);
    
    switch (message.type) {
      case 'agent':
        return `
          <div class="spawnkit-chat-message agent">
            <div class="spawnkit-chat-avatar">${message.avatar || message.agent?.substring(0, 2).toUpperCase() || 'A'}</div>
            <div>
              <div class="spawnkit-chat-message-header">
                <div class="spawnkit-chat-message-name">${message.agent}</div>
                <div class="spawnkit-chat-message-time">${time}</div>
              </div>
              <div class="spawnkit-chat-bubble">${message.text}</div>
            </div>
          </div>
        `;
      
      case 'user':
        return `
          <div class="spawnkit-chat-message user">
            <div>
              <div class="spawnkit-chat-message-header" style="justify-content: flex-end;">
                <div class="spawnkit-chat-message-time">${time}</div>
              </div>
              <div class="spawnkit-chat-bubble">${message.text}</div>
            </div>
          </div>
        `;
      
      case 'system':
        return `
          <div class="spawnkit-chat-message system">
            <div class="spawnkit-chat-bubble">${message.text}</div>
          </div>
        `;
      
      case 'event':
        return `
          <div class="spawnkit-chat-message event">
            <div class="spawnkit-chat-bubble">
              <span class="spawnkit-chat-message-icon">${message.icon || '•'}</span>
              ${message.text}
            </div>
          </div>
        `;
      
      default:
        return `
          <div class="spawnkit-chat-message">
            <div class="spawnkit-chat-bubble">${message.text}</div>
          </div>
        `;
    }
  }

  handleSendMessage() {
    const text = this.inputField.value.trim();
    if (!text) return;

    // Add user message
    const userMessage = {
      type: 'user',
      text: text,
      timestamp: new Date()
    };
    
    this.addMessage(userMessage);
    this.inputField.value = '';
    this.sendButton.disabled = true;

    // Call the callback
    this.options.onSendMessage(text, this.currentAgent);

    // If connected, send to relay
    if (this.isConnected) {
      this.sendToRelay(text, this.currentAgent);
    } else {
      // Demo mode - show "coming soon" message
      setTimeout(() => {
        this.addMessage({
          type: 'system',
          text: '💬 Message sending coming soon - relay integration in progress',
          timestamp: new Date()
        });
      }, 500);
    }
  }

  async sendToRelay(text, agentId) {
    try {
      const response = await fetch(`${this.options.relayUrl}/api/oc/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          agent: agentId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.warn('Failed to send message:', error);
      this.addMessage({
        type: 'system',
        text: '⚠️ Failed to send message - check connection',
        timestamp: new Date()
      });
    }
  }

  addMessage(message) {
    this.messages.push(message);
    
    const messageEl = document.createElement('div');
    messageEl.innerHTML = this.renderMessage(message);
    this.messagesContainer.appendChild(messageEl.firstElementChild);
    
    this.scrollToBottom();
    this.playNotificationSound();
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  playNotificationSound() {
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContext();
        
        // Create a subtle notification sound
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
        
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2);
      } catch (error) {
        // Silently fail if audio context is not available
      }
    }
  }

  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      if (this.isConnected) {
        await this.loadSessions();
      }
    }, 10000); // Poll every 10 seconds
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString();
  }

  // Public API methods
  toggle() {
    this.chatPanel.classList.toggle('collapsed');
    return !this.chatPanel.classList.contains('collapsed');
  }

  setTheme(theme) {
    this.options.theme = theme;
    this.chatPanel.setAttribute('data-theme', theme);
  }

  show() {
    this.chatPanel.classList.remove('collapsed');
  }

  hide() {
    this.chatPanel.classList.add('collapsed');
  }

  destroy() {
    this.stopPolling();
    this.container.innerHTML = '';
    
    // Remove styles if no other instances
    const otherInstances = document.querySelectorAll('.spawnkit-chat');
    if (otherInstances.length === 0) {
      const styles = document.getElementById('spawnkit-chat-styles');
      if (styles) {
        styles.remove();
      }
    }
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpawnKitChat;
}

if (typeof window !== 'undefined') {
  window.SpawnKitChat = SpawnKitChat;
}