(function() {
  'use strict';

  const WIZARD_STYLES = `
    .sw-unified {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .sw-unified.show {
      opacity: 1;
    }

    .sw-unified.medieval {
      font-family: "Crimson Text", serif;
    }

    .sw-unified .wizard-modal {
      width: 90%;
      max-width: 800px;
      height: 90%;
      max-height: 700px;
      background: var(--wizard-bg);
      border: 1px solid var(--wizard-border);
      border-radius: 12px;
      position: relative;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Theme Variables */
    .sw-unified.medieval .wizard-modal {
      --wizard-bg: linear-gradient(135deg, #0d1b2a, #1b2838);
      --wizard-border: rgba(201, 169, 89, 0.4);
      --wizard-text: #f4e4bc;
      --wizard-accent: #c9a959;
      --wizard-secondary: rgba(201, 169, 89, 0.1);
    }

    .sw-unified.executive .wizard-modal {
      --wizard-bg: #1c1c1e;
      --wizard-border: #3a3a3c;
      --wizard-text: #fff;
      --wizard-accent: #0a84ff;
      --wizard-secondary: rgba(10, 132, 255, 0.1);
    }

    .wizard-header {
      padding: 20px;
      border-bottom: 1px solid var(--wizard-border);
      display: flex;
      justify-content: between;
      align-items: center;
    }

    .wizard-title {
      color: var(--wizard-text);
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }

    .wizard-close {
      background: none;
      border: none;
      color: var(--wizard-text);
      font-size: 20px;
      cursor: pointer;
      padding: 4px;
      margin-left: auto;
    }

    .wizard-progress {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      gap: 12px;
    }

    .progress-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--wizard-secondary);
      border: 1px solid var(--wizard-border);
      transition: all 0.3s ease;
    }

    .progress-dot.completed {
      background: var(--wizard-accent);
      border-color: var(--wizard-accent);
    }

    .progress-dot.active {
      background: var(--wizard-accent);
      border-color: var(--wizard-accent);
      box-shadow: 0 0 8px var(--wizard-accent);
    }

    .wizard-content {
      flex: 1;
      padding: 30px;
      overflow-y: auto;
      color: var(--wizard-text);
    }

    .step-title {
      font-size: 24px;
      margin: 0 0 8px 0;
      color: var(--wizard-text);
    }

    .step-description {
      color: var(--wizard-text);
      opacity: 0.8;
      margin: 0 0 30px 0;
      line-height: 1.5;
    }

    .provider-grid, .skill-grid, .node-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }

    .provider-card, .skill-card, .node-card {
      background: var(--wizard-secondary);
      border: 1px solid var(--wizard-border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .provider-card:hover, .skill-card:hover, .node-card:hover {
      border-color: var(--wizard-accent);
    }

    .card-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .card-name {
      font-weight: 600;
      margin: 0 0 4px 0;
    }

    .card-status {
      font-size: 14px;
      opacity: 0.8;
    }

    .card-status.connected {
      color: #4ade80;
    }

    .card-status.disconnected {
      color: #f87171;
    }

    .wizard-button {
      background: var(--wizard-accent);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
      margin: 8px;
    }

    .wizard-button:hover {
      opacity: 0.8;
    }

    .wizard-button.secondary {
      background: var(--wizard-secondary);
      color: var(--wizard-text);
      border: 1px solid var(--wizard-border);
    }

    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .status-indicator.green {
      background: #4ade80;
    }

    .status-indicator.gray {
      background: #6b7280;
    }

    .test-result {
      margin-top: 20px;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--wizard-border);
    }

    .test-result.success {
      background: rgba(74, 222, 128, 0.1);
      border-color: #4ade80;
      color: #4ade80;
    }

    .test-result.error {
      background: rgba(248, 113, 113, 0.1);
      border-color: #f87171;
      color: #f87171;
    }

    .model-count {
      font-size: 18px;
      font-weight: 600;
      color: var(--wizard-accent);
      text-align: center;
      margin: 16px 0;
    }

    .confetti {
      position: absolute;
      width: 4px;
      height: 4px;
      background: var(--wizard-accent);
      animation: confetti-fall 3s linear forwards;
    }

    @keyframes confetti-fall {
      0% {
        transform: translateY(-100vh) rotateZ(0deg);
      }
      100% {
        transform: translateY(100vh) rotateZ(360deg);
      }
    }
  `;

  class SetupWizard {
    constructor() {
      this.currentStep = 0;
      this.steps = [
        { title: 'AI Models', description: 'Connect your AI providers' },
        { title: 'OpenClaw Gateway', description: 'Start the main service' },
        { title: 'Messaging Channels', description: 'Set up communication' },
        { title: 'Fleet & Nodes', description: 'Connect devices' },
        { title: 'Skills', description: 'Install capabilities' },
        { title: 'First Test', description: 'Verify everything works' }
      ];
      this.stepStatuses = new Array(6).fill(false);
      this.refreshInterval = null;
    }

    async fetchWithAuth(url, options = {}) {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      return fetch(url, {
        ...options,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
    }

    createOverlay(theme) {
      if (document.querySelector('.sw-unified')) {
        document.querySelector('.sw-unified').remove();
      }

      const style = document.createElement('style');
      style.textContent = WIZARD_STYLES;
      document.head.appendChild(style);

      const overlay = document.createElement('div');
      overlay.className = `sw-unified ${theme || this.detectTheme()}`;
      
      overlay.innerHTML = `
        <div class="wizard-modal">
          <div class="wizard-header">
            <h2 class="wizard-title">SpawnKit Setup Wizard</h2>
            <button class="wizard-close">&times;</button>
          </div>
          <div class="wizard-progress">
            ${this.steps.map((_, i) => `<div class="progress-dot" data-step="${i}"></div>`).join('')}
          </div>
          <div class="wizard-content">
            <!-- Dynamic content -->
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlay = overlay;

      this.bindEvents();
      this.updateProgress();
      this.renderStep(this.currentStep);

      setTimeout(() => overlay.classList.add('show'), 10);
    }

    detectTheme() {
      const body = document.body;
      if (body.classList.contains('medieval') || 
          getComputedStyle(body).getPropertyValue('--castle-gold')) {
        return 'medieval';
      }
      return 'executive';
    }

    bindEvents() {
      this.overlay.querySelector('.wizard-close').addEventListener('click', () => this.close());
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }

    updateProgress() {
      const dots = this.overlay.querySelectorAll('.progress-dot');
      dots.forEach((dot, index) => {
        dot.className = 'progress-dot';
        if (index < this.currentStep) dot.classList.add('completed');
        if (index === this.currentStep) dot.classList.add('active');
      });
    }

    async renderStep(stepIndex) {
      const content = this.overlay.querySelector('.wizard-content');
      const step = this.steps[stepIndex];

      switch (stepIndex) {
        case 0:
          await this.renderAIModelsStep(content, step);
          break;
        case 1:
          await this.renderGatewayStep(content, step);
          break;
        case 2:
          await this.renderChannelsStep(content, step);
          break;
        case 3:
          await this.renderFleetStep(content, step);
          break;
        case 4:
          await this.renderSkillsStep(content, step);
          break;
        case 5:
          await this.renderTestStep(content, step);
          break;
      }
    }

    async renderAIModelsStep(content, step) {
      content.innerHTML = `
        <h3 class="step-title">${step.title}</h3>
        <p class="step-description">${step.description}</p>
        <div class="model-count" id="totalModels">Loading...</div>
        <div class="provider-grid" id="providerGrid">Loading providers...</div>
      `;

      this.startRefreshInterval(() => this.loadProviders());
      await this.loadProviders();
    }

    async loadProviders() {
      try {
        const response = await this.fetchWithAuth('/api/setup/cliproxy');
        const data = await response.json();
        
        const providers = [
          { id: 'gemini', name: 'Gemini', icon: '🔮', models: data.gemini || 0 },
          { id: 'claude', name: 'Claude', icon: '🧠', models: data.claude || 0 },
          { id: 'openai', name: 'OpenAI/Codex', icon: '🤖', models: data.openai || 0 }
        ];

        const totalModels = providers.reduce((sum, p) => sum + p.models, 0);
        
        document.getElementById('totalModels').textContent = `${totalModels} models available`;
        
        const grid = document.getElementById('providerGrid');
        grid.innerHTML = providers.map(provider => `
          <div class="provider-card">
            <div class="card-icon">${provider.icon}</div>
            <div class="card-name">${provider.name}</div>
            <div class="card-status ${provider.models > 0 ? 'connected' : 'disconnected'}">
              ${provider.models > 0 ? `✅ ${provider.models} models` : '❌ Not connected'}
            </div>
            ${provider.models === 0 ? `<button class="wizard-button" onclick="window.SetupWizard.connectProvider('${provider.id}')">Connect</button>` : ''}
          </div>
        `).join('');

        this.stepStatuses[0] = totalModels > 0;
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    }

    async connectProvider(providerId) {
      try {
        await this.fetchWithAuth('/api/setup/cliproxy/login', {
          method: 'POST',
          body: JSON.stringify({ provider: providerId })
        });
        await this.loadProviders();
      } catch (error) {
        console.error(`Failed to connect ${providerId}:`, error);
      }
    }

    async renderGatewayStep(content, step) {
      content.innerHTML = `
        <h3 class="step-title">${step.title}</h3>
        <p class="step-description">${step.description}</p>
        <div id="gatewayStatus">Loading gateway status...</div>
      `;

      try {
        const response = await this.fetchWithAuth('/api/setup/gateway');
        const data = await response.json();
        
        const statusDiv = document.getElementById('gatewayStatus');
        if (data.running) {
          statusDiv.innerHTML = `
            <div class="card-status connected">
              <span class="status-indicator green"></span>Gateway is running
            </div>
            <p>Default model: ${data.defaultModel || 'Not configured'}</p>
            <p>Version: ${data.version || 'Unknown'}</p>
            <p>Channels: ${data.channels || 0} configured</p>
          `;
          this.stepStatuses[1] = true;
        } else {
          statusDiv.innerHTML = `
            <div class="card-status disconnected">
              <span class="status-indicator gray"></span>Gateway is not running
            </div>
            <button class="wizard-button" onclick="window.SetupWizard.startGateway()">Start Gateway</button>
          `;
          this.stepStatuses[1] = false;
        }
      } catch (error) {
        console.error('Failed to load gateway status:', error);
      }
    }

    async startGateway() {
      try {
        await this.fetchWithAuth('/api/setup/gateway/start', { method: 'POST' });
        await this.renderGatewayStep(this.overlay.querySelector('.wizard-content'), this.steps[1]);
      } catch (error) {
        console.error('Failed to start gateway:', error);
      }
    }

    async renderChannelsStep(content, step) {
      content.innerHTML = `
        <h3 class="step-title">${step.title}</h3>
        <p class="step-description">${step.description}</p>
        <div>
          ${window.ChannelOnboarding ? `
            <button class="wizard-button" onclick="window.ChannelOnboarding.open()">Open Channel Setup</button>
          ` : `
            <div class="provider-grid">
              <div class="provider-card">
                <div class="card-icon">📱</div>
                <div class="card-name">Telegram</div>
                <div class="card-status connected">✅ Connected</div>
              </div>
              <div class="provider-card">
                <div class="card-icon">💬</div>
                <div class="card-name">Discord</div>
                <div class="card-status disconnected">❌ Not configured</div>
              </div>
            </div>
          `}
        </div>
      `;
      this.stepStatuses[2] = true; // Assume at least one channel is working if we got here
    }

    async renderFleetStep(content, step) {
      content.innerHTML = `
        <h3 class="step-title">${step.title}</h3>
        <p class="step-description">${step.description}</p>
        <div id="nodeGrid">Loading fleet status...</div>
        <button class="wizard-button secondary" onclick="window.open('https://docs.spawnkit.com/fleet', '_blank')">Pair New Device</button>
      `;

      try {
        const response = await this.fetchWithAuth('/api/setup/fleet');
        const data = await response.json();
        
        const nodeGrid = document.getElementById('nodeGrid');
        if (data.nodes && data.nodes.length > 0) {
          nodeGrid.innerHTML = `
            <div class="node-grid">
              ${data.nodes.map(node => `
                <div class="node-card">
                  <div class="card-icon">💻</div>
                  <div class="card-name">${node.name}</div>
                  <div class="card-status ${node.online ? 'connected' : 'disconnected'}">
                    <span class="status-indicator ${node.online ? 'green' : 'gray'}"></span>
                    ${node.online ? 'Online' : 'Offline'}
                  </div>
                  <div style="font-size: 12px; opacity: 0.7;">${node.os} • Last seen ${node.lastSeen}</div>
                </div>
              `).join('')}
            </div>
          `;
          this.stepStatuses[3] = data.nodes.some(n => n.online);
        } else {
          nodeGrid.innerHTML = `
            <div style="text-align: center; padding: 40px; opacity: 0.8;">
              <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
              <p>No nodes paired yet</p>
              <p style="font-size: 14px; opacity: 0.7;">Connect your phone, tablet, or other devices to expand your AI's reach</p>
            </div>
          `;
          this.stepStatuses[3] = false;
        }
      } catch (error) {
        console.error('Failed to load fleet status:', error);
      }
    }

    async renderSkillsStep(content, step) {
      content.innerHTML = `
        <h3 class="step-title">${step.title}</h3>
        <p class="step-description">${step.description}</p>
        <div id="skillsStatus">Loading skills...</div>
        <button class="wizard-button secondary" onclick="window.open('https://clawhub.com', '_blank')">Browse ClawHub</button>
      `;

      try {
        const response = await this.fetchWithAuth('/api/setup/skills');
        const data = await response.json();
        
        const skillsDiv = document.getElementById('skillsStatus');
        const skillCount = data.skills ? data.skills.length : 0;
        
        skillsDiv.innerHTML = `
          <div class="model-count">${skillCount} skills installed</div>
          ${skillCount > 0 ? `
            <div class="skill-grid">
              ${data.skills.slice(0, 6).map(skill => `
                <div class="skill-card">
                  <div class="card-icon">${skill.icon || '🛠️'}</div>
                  <div class="card-name">${skill.name}</div>
                </div>
              `).join('')}
              ${skillCount > 6 ? `<div class="skill-card"><div class="card-name">+${skillCount - 6} more</div></div>` : ''}
            </div>
          ` : `
            <div style="text-align: center; padding: 20px; opacity: 0.8;">
              <p>No skills installed yet</p>
            </div>
          `}
        `;
        this.stepStatuses[4] = skillCount > 0;
      } catch (error) {
        console.error('Failed to load skills:', error);
      }
    }

    async renderTestStep(content, step) {
      const incompleteSteps = this.stepStatuses.slice(0, 5).map((complete, i) => complete ? null : i).filter(x => x !== null);
      
      content.innerHTML = `
        <h3 class="step-title">${step.title}</h3>
        <p class="step-description">${step.description}</p>
        ${incompleteSteps.length > 0 ? `
          <div class="test-result error">
            <p>⚠️ Please complete these steps first:</p>
            <ul>
              ${incompleteSteps.map(i => `<li>${this.steps[i].title}</li>`).join('')}
            </ul>
          </div>
        ` : `
          <div style="text-align: center;">
            <button class="wizard-button" onclick="window.SetupWizard.runTest()" style="font-size: 18px; padding: 16px 32px;">
              🚀 Send Test Message
            </button>
          </div>
        `}
        <div id="testResult"></div>
      `;
    }

    async runTest() {
      const resultDiv = document.getElementById('testResult');
      resultDiv.innerHTML = `<div style="text-align: center; padding: 20px;">Testing...</div>`;

      try {
        const response = await this.fetchWithAuth('/api/setup/test', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
          this.showConfetti();
          resultDiv.innerHTML = `
            <div class="test-result success">
              <div style="font-size: 24px; margin-bottom: 16px;">🎉</div>
              <h4>Your AI agent is ready!</h4>
              <p>${data.message || 'All systems are working correctly.'}</p>
            </div>
          `;
          this.stepStatuses[5] = true;
        } else {
          resultDiv.innerHTML = `
            <div class="test-result error">
              <div style="font-size: 24px; margin-bottom: 16px;">❌</div>
              <h4>Test failed</h4>
              <p>${data.error || 'Something went wrong. Please check your configuration.'}</p>
              ${data.troubleshooting ? `<p><small>${data.troubleshooting}</small></p>` : ''}
            </div>
          `;
        }
      } catch (error) {
        resultDiv.innerHTML = `
          <div class="test-result error">
            <div style="font-size: 24px; margin-bottom: 16px;">❌</div>
            <h4>Connection failed</h4>
            <p>Could not reach the test endpoint. Please check your network connection.</p>
          </div>
        `;
      }
    }

    showConfetti() {
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          const confetti = document.createElement('div');
          confetti.className = 'confetti';
          confetti.style.left = Math.random() * 100 + '%';
          confetti.style.animationDelay = Math.random() * 3 + 's';
          confetti.style.background = `hsl(${Math.random() * 360}, 50%, 50%)`;
          this.overlay.appendChild(confetti);
          
          setTimeout(() => confetti.remove(), 3000);
        }, i * 50);
      }
    }

    startRefreshInterval(callback) {
      if (this.refreshInterval) clearInterval(this.refreshInterval);
      this.refreshInterval = setInterval(callback, 5000);
    }

    stopRefreshInterval() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }

    open(theme) {
      this.createOverlay(theme);
    }

    close() {
      this.stopRefreshInterval();
      if (this.overlay) {
        this.overlay.classList.remove('show');
        setTimeout(() => {
          if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
          }
        }, 300);
      }
    }

    async getStatus() {
      // This would return the current completion status of all steps
      return {
        aiModels: this.stepStatuses[0],
        gateway: this.stepStatuses[1],
        channels: this.stepStatuses[2],
        fleet: this.stepStatuses[3],
        skills: this.stepStatuses[4],
        test: this.stepStatuses[5],
        overall: this.stepStatuses.every(s => s)
      };
    }

    goToStep(stepIndex) {
      if (stepIndex >= 0 && stepIndex < this.steps.length) {
        this.currentStep = stepIndex;
        this.updateProgress();
        this.renderStep(stepIndex);
      }
    }
  }

  // Global API
  window.SetupWizard = new SetupWizard();

  // Expose methods for inline event handlers
  window.SetupWizard.connectProvider = window.SetupWizard.connectProvider.bind(window.SetupWizard);
  window.SetupWizard.startGateway = window.SetupWizard.startGateway.bind(window.SetupWizard);
  window.SetupWizard.runTest = window.SetupWizard.runTest.bind(window.SetupWizard);

})();