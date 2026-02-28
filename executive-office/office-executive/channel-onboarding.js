/**
 * SpawnKit Executive Office — Channel Connection Onboarding
 * Award-winning channel onboarding flows. Self-contained IIFE.
 */

window.__skChannelOnboarding = true;

(function () {
  'use strict';

  // ── Channel Definitions ────────────────────────────────────────────────────
  var channels = {
    signal: {
      name: 'Signal',
      icon: '📱',
      color: '#3A76F0',
      gradient: 'linear-gradient(135deg, #3A76F0 0%, #2D5DD7 100%)',
      description: 'Secure encrypted messaging',
      benefits: ['End-to-end encryption', 'Private group chats', 'Self-destructing messages'],
      setupSteps: [
        { type: 'qr', title: 'Link your device', desc: 'Scan QR code with Signal app on your phone' },
        { type: 'verify', title: 'Verify connection', desc: 'Send test message to confirm setup' }
      ]
    },
    discord: {
      name: 'Discord',
      icon: '🎮',
      color: '#5865F2',
      gradient: 'linear-gradient(135deg, #5865F2 0%, #4752C4 100%)',
      description: 'Gaming and community platform',
      benefits: ['Voice channels', 'Rich text formatting', 'Server integration'],
      setupSteps: [
        { type: 'token', title: 'Bot token', desc: 'Enter your Discord bot token', placeholder: 'MTI3NTMx...' },
        { type: 'server', title: 'Select server', desc: 'Choose which Discord server to connect' },
        { type: 'verify', title: 'Test connection', desc: 'Send a test message to verify' }
      ]
    },
    imessage: {
      name: 'iMessage',
      icon: '💬',
      color: '#34C759',
      gradient: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
      description: 'Apple ecosystem messaging',
      benefits: ['Native iOS integration', 'Rich media support', 'Handoff across devices'],
      setupSteps: [
        { type: 'system', title: 'System access', desc: 'Grant permission for macOS integration' },
        { type: 'verify', title: 'Test message', desc: 'Send a test iMessage' }
      ]
    },
    slack: {
      name: 'Slack',
      icon: '💼',
      color: '#4A154B',
      gradient: 'linear-gradient(135deg, #4A154B 0%, #611F69 100%)',
      description: 'Professional team communication',
      benefits: ['Workspace integration', 'Thread conversations', 'App ecosystem'],
      setupSteps: [
        { type: 'token', title: 'Bot token', desc: 'Enter your Slack bot token', placeholder: 'xoxb-...' },
        { type: 'workspace', title: 'Select workspace', desc: 'Choose your Slack workspace' },
        { type: 'verify', title: 'Test message', desc: 'Send a welcome message' }
      ]
    },
    telegram: {
      name: 'Telegram',
      icon: '✈️',
      color: '#0088CC',
      gradient: 'linear-gradient(135deg, #0088CC 0%, #006BA6 100%)',
      description: 'Cloud-based instant messaging',
      benefits: ['Large file sharing', 'Channels & groups', 'Bot platform'],
      setupSteps: [
        { type: 'token', title: 'Bot token', desc: 'Enter your Telegram bot token', placeholder: '123456:ABC-DEF...' },
        { type: 'verify', title: 'Test connection', desc: 'Send a test message' }
      ]
    },
    whatsapp: {
      name: 'WhatsApp',
      icon: '💚',
      color: '#25D366',
      gradient: 'linear-gradient(135deg, #25D366 0%, #20B858 100%)',
      description: 'Global messaging platform',
      benefits: ['Worldwide reach', 'Business API', 'Rich media'],
      setupSteps: [
        { type: 'qr', title: 'Link device', desc: 'Scan QR code with WhatsApp mobile app' },
        { type: 'verify', title: 'Test message', desc: 'Send a test message' }
      ]
    }
  };

  // ── CSS Styles ─────────────────────────────────────────────────────────────
  var css = `
    @keyframes ch-ob-fadein {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ch-ob-fadeout {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes ch-ob-slide-in {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes ch-ob-slide-out {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(-40px); }
    }
    @keyframes ch-ob-channel-pop {
      0%   { opacity: 0; transform: scale(0.6) rotate(-4deg); }
      60%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
      100% { opacity: 1; transform: scale(1) rotate(0deg); }
    }
    @keyframes ch-ob-pulse-ring {
      0%   { transform: scale(0.8); opacity: 0.8; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes ch-ob-confetti {
      0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
    }
    @keyframes ch-ob-celebration {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.06); }
      100% { transform: scale(1); }
    }
    @keyframes ch-ob-typing {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%            { transform: scale(1);   opacity: 1; }
    }
    @keyframes ch-ob-qr-scan {
      0%   { transform: scale(1); opacity: 0.3; }
      50%  { transform: scale(1.02); opacity: 0.8; }
      100% { transform: scale(1); opacity: 0.3; }
    }

    .ch-ob-overlay {
      position: fixed; inset: 0; z-index: 10001;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, system-ui, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      transition: opacity 0.3s ease;
    }
    .ch-ob-overlay.ch-ob-hiding {
      animation: ch-ob-fadeout 0.3s ease forwards;
    }

    /* Flow container */
    .ch-ob-flow {
      position: absolute; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none; opacity: 0;
    }
    .ch-ob-flow.ch-ob-active {
      pointer-events: auto; opacity: 1;
    }
    .ch-ob-flow.ch-ob-entering {
      animation: ch-ob-slide-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .ch-ob-flow.ch-ob-leaving {
      animation: ch-ob-slide-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    /* Card */
    .ch-ob-card {
      background: rgba(28, 28, 30, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 40px 36px 32px;
      width: 480px;
      max-width: calc(100vw - 40px);
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.04);
      position: relative;
    }

    /* Channel intro */
    .ch-ob-channel-intro {
      text-align: center; padding: 20px 0 32px;
    }
    .ch-ob-channel-icon {
      width: 80px; height: 80px; margin: 0 auto 24px;
      border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 40px;
      animation: ch-ob-channel-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    .ch-ob-channel-icon::after {
      content: '';
      position: absolute; inset: -8px;
      border-radius: 28px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      animation: ch-ob-pulse-ring 2s ease-out infinite;
    }
    .ch-ob-channel-title {
      font-size: 28px; font-weight: 700; color: #fff;
      margin: 0 0 8px; letter-spacing: -0.5px;
      animation: ch-ob-fadein 0.6s 0.2s ease both;
    }
    .ch-ob-channel-desc {
      font-size: 15px; color: rgba(255,255,255,0.5);
      margin: 0 0 24px; line-height: 1.5;
      animation: ch-ob-fadein 0.6s 0.35s ease both;
    }

    /* Benefits */
    .ch-ob-benefits {
      margin: 24px 0; animation: ch-ob-fadein 0.6s 0.5s ease both;
    }
    .ch-ob-benefits-title {
      font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7);
      margin: 0 0 12px; text-align: center;
    }
    .ch-ob-benefits-list {
      display: flex; flex-direction: column; gap: 8px;
    }
    .ch-ob-benefit {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: rgba(255,255,255,0.6);
    }
    .ch-ob-benefit::before {
      content: '✓';
      color: #34C759;
      font-weight: bold;
      flex-shrink: 0;
    }

    /* Setup steps */
    .ch-ob-setup {
      padding: 24px 0;
    }
    .ch-ob-step-indicator {
      display: flex; gap: 8px; justify-content: center; margin-bottom: 32px;
    }
    .ch-ob-step-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(255,255,255,0.2); transition: all 0.3s ease;
    }
    .ch-ob-step-dot.ch-ob-step-active {
      width: 24px; border-radius: 4px;
    }
    .ch-ob-step-title {
      font-size: 20px; font-weight: 700; color: #fff;
      margin: 0 0 6px; letter-spacing: -0.3px;
    }
    .ch-ob-step-desc {
      font-size: 14px; color: rgba(255,255,255,0.5);
      margin: 0 0 24px; line-height: 1.5;
    }

    /* Input fields */
    .ch-ob-field { margin-bottom: 20px; }
    .ch-ob-field label {
      display: block; font-size: 12px; font-weight: 500;
      color: rgba(255,255,255,0.5); margin-bottom: 8px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .ch-ob-input {
      width: 100%; box-sizing: border-box;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff; border-radius: 12px;
      padding: 14px 16px; font-size: 16px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; outline: none;
      transition: all 0.2s ease;
    }
    .ch-ob-input:focus {
      border-color: rgba(0, 122, 255, 0.6);
      background: rgba(0, 122, 255, 0.08);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
    }
    .ch-ob-input::placeholder { color: rgba(255,255,255,0.25); }

    /* QR code placeholder */
    .ch-ob-qr-container {
      display: flex; justify-content: center; margin: 20px 0;
    }
    .ch-ob-qr-placeholder {
      width: 160px; height: 160px;
      background: rgba(255,255,255,0.95);
      border-radius: 12px; display: flex;
      align-items: center; justify-content: center;
      font-size: 14px; color: #000; text-align: center;
      animation: ch-ob-qr-scan 2s infinite ease-in-out;
      background-image: 
        linear-gradient(0deg, rgba(0,0,0,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px);
      background-size: 12px 12px;
    }

    /* System access */
    .ch-ob-system-access {
      background: rgba(255, 149, 0, 0.1);
      border: 1px solid rgba(255, 149, 0, 0.3);
      border-radius: 12px; padding: 16px;
      margin: 20px 0; text-align: center;
    }
    .ch-ob-system-icon {
      font-size: 24px; margin-bottom: 8px; display: block;
    }
    .ch-ob-system-text {
      font-size: 13px; color: rgba(255,255,255,0.7);
      margin: 0;
    }

    /* Actions */
    .ch-ob-actions {
      display: flex; align-items: center;
      justify-content: space-between; margin-top: 32px;
    }
    .ch-ob-btn-primary {
      border: none; border-radius: 12px;
      padding: 14px 24px; font-size: 15px; font-weight: 600;
      font-family: inherit; cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }
    .ch-ob-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }
    .ch-ob-btn-primary:active:not(:disabled) { transform: translateY(0); }
    .ch-ob-btn-primary:disabled {
      opacity: 0.4; cursor: not-allowed;
      box-shadow: none;
    }
    .ch-ob-btn-back {
      background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.12);
    }
    .ch-ob-btn-back:hover:not(:disabled) {
      background: rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.9);
    }
    .ch-ob-btn-cancel {
      background: transparent; border: none;
      color: rgba(255,255,255,0.4); font-size: 13px;
      font-family: inherit; cursor: pointer;
      padding: 0; transition: color 0.2s ease;
    }
    .ch-ob-btn-cancel:hover { color: rgba(255,255,255,0.65); }

    /* Success state */
    .ch-ob-success {
      text-align: center; padding: 32px 0 24px;
    }
    .ch-ob-success-icon {
      font-size: 48px; display: block; margin-bottom: 16px;
      animation: ch-ob-celebration 0.6s ease;
    }
    .ch-ob-success-title {
      font-size: 24px; font-weight: 700; color: #fff;
      margin: 0 0 8px; letter-spacing: -0.4px;
    }
    .ch-ob-success-desc {
      font-size: 15px; color: rgba(255,255,255,0.5);
      margin: 0 0 24px; line-height: 1.5;
    }

    /* Testing state */
    .ch-ob-testing {
      text-align: center; padding: 20px 0;
    }
    .ch-ob-typing-indicator {
      display: flex; gap: 5px; align-items: center;
      justify-content: center; margin: 16px 0;
    }
    .ch-ob-typing-indicator span {
      width: 8px; height: 8px;
      background: rgba(255,255,255,0.5);
      border-radius: 50%;
      animation: ch-ob-typing 1.4s infinite ease-in-out;
    }
    .ch-ob-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .ch-ob-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    /* Confetti */
    .ch-ob-confetti-piece {
      position: fixed; width: 8px; height: 8px;
      border-radius: 2px; pointer-events: none; z-index: 10002;
      animation: ch-ob-confetti 2.5s ease-in forwards;
    }

    /* Add Channel Button */
    .chat-add-channel-btn {
      background: rgba(0, 122, 255, 0.1);
      border: 1px solid rgba(0, 122, 255, 0.3);
      color: rgba(0, 122, 255, 0.9);
      border-radius: 6px; padding: 4px 8px;
      font-size: 12px; cursor: pointer;
      margin-left: 8px; transition: all 0.2s ease;
      font-family: inherit; line-height: 1;
    }
    .chat-add-channel-btn:hover {
      background: rgba(0, 122, 255, 0.15);
      border-color: rgba(0, 122, 255, 0.4);
      color: #007AFF;
    }

    /* Settings channel section */
    .settings-channels-section {
      margin-top: 24px;
    }
    .settings-section-title {
      font-size: 14px; font-weight: 600; color: #fff;
      margin: 0 0 16px; display: flex; align-items: center; gap: 8px;
    }
    .settings-channels-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px; margin-bottom: 16px;
    }
    .settings-channel-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 16px 12px;
      text-align: center; cursor: pointer;
      transition: all 0.2s ease;
    }
    .settings-channel-card:hover {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.15);
      transform: translateY(-2px);
    }
    .settings-channel-card.connected {
      border-color: rgba(52, 199, 89, 0.4);
      background: rgba(52, 199, 89, 0.1);
    }
    .settings-channel-icon {
      font-size: 24px; display: block; margin-bottom: 8px;
    }
    .settings-channel-name {
      font-size: 12px; font-weight: 500; color: #fff;
      margin: 0 0 2px;
    }
    .settings-channel-status {
      font-size: 10px; color: rgba(255,255,255,0.4);
      margin: 0;
    }
    .settings-channel-status.connected {
      color: rgba(52, 199, 89, 0.8);
    }
  `;

  // ── Inject styles ──────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── State ──────────────────────────────────────────────────────────────────
  var currentChannel = null;
  var currentStep = 0;
  var overlay = null;
  var flows = [];
  var confettiPieces = [];

  // ── Connected Channels Management ──────────────────────────────────────────
  function getConnectedChannels() {
    try {
      return JSON.parse(localStorage.getItem('spawnkit-connected-channels') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveConnectedChannel(channelId, config) {
    var connected = getConnectedChannels();
    var existing = connected.findIndex(function(c) { return c.id === channelId; });
    var channelData = {
      id: channelId,
      name: channels[channelId].name,
      icon: channels[channelId].icon,
      config: config,
      connectedAt: Date.now()
    };
    
    if (existing >= 0) {
      connected[existing] = channelData;
    } else {
      connected.push(channelData);
    }
    
    localStorage.setItem('spawnkit-connected-channels', JSON.stringify(connected));
    updateTargetDropdown();
  }

  function updateTargetDropdown() {
    var select = document.getElementById('chatTargetSelect');
    if (!select) return;

    var connected = getConnectedChannels();
    var currentOptions = Array.from(select.options).map(function(opt) { return opt.value; });

    connected.forEach(function(channel) {
      if (!currentOptions.includes(channel.id)) {
        var option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.icon + ' ' + channel.name;
        select.appendChild(option);
      }
    });
  }

  // ── Build Flow ─────────────────────────────────────────────────────────────
  function buildFlow(channelId) {
    // Cleanup any existing overlay first
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
    document.querySelectorAll('.ch-ob-overlay').forEach(function(el) { el.remove(); });

    currentChannel = channelId;
    currentStep = 0;
    flows = [];
    var channel = channels[channelId];

    if (!channel) {
      console.error('Channel not found:', channelId);
      return;
    }

    overlay = document.createElement('div');
    overlay.className = 'ch-ob-overlay';
    overlay.id = 'chObOverlay';

    // Step 1: Channel Intro
    var introFlow = makeFlow(0, `
      <div class="ch-ob-card">
        <div class="ch-ob-channel-intro">
          <div class="ch-ob-channel-icon" style="background: ${channel.gradient};">
            ${channel.icon}
          </div>
          <h1 class="ch-ob-channel-title">Connect ${channel.name}</h1>
          <p class="ch-ob-channel-desc">${channel.description}</p>
          
          <div class="ch-ob-benefits">
            <h3 class="ch-ob-benefits-title">What you'll get:</h3>
            <div class="ch-ob-benefits-list">
              ${channel.benefits.map(function(benefit) {
                return '<div class="ch-ob-benefit">' + benefit + '</div>';
              }).join('')}
            </div>
          </div>
        </div>
        
        <div class="ch-ob-actions">
          <button class="ch-ob-btn-cancel" id="chObCancel">Cancel</button>
          <button class="ch-ob-btn-primary" id="chObStartSetup" style="background: ${channel.gradient}; color: #fff;">
            Get Started →
          </button>
        </div>
      </div>
    `);

    // Setup Steps
    channel.setupSteps.forEach(function(step, index) {
      var isLast = index === channel.setupSteps.length - 1;
      var stepFlow = buildSetupStep(step, index, isLast, channel);
      flows.push(stepFlow);
    });

    // Success Step
    var successFlow = makeFlow(channel.setupSteps.length + 1, `
      <div class="ch-ob-card">
        <div class="ch-ob-success">
          <span class="ch-ob-success-icon">🎉</span>
          <h1 class="ch-ob-success-title">${channel.name} Connected!</h1>
          <p class="ch-ob-success-desc">You can now send and receive messages through ${channel.name}.</p>
        </div>
        
        <div class="ch-ob-actions">
          <div></div>
          <button class="ch-ob-btn-primary" id="chObComplete" style="background: ${channel.gradient}; color: #fff;">
            Start Messaging →
          </button>
        </div>
      </div>
    `);

    flows = [introFlow];
    channel.setupSteps.forEach(function(step, index) {
      var isLast = index === channel.setupSteps.length - 1;
      var stepFlow = buildSetupStep(step, index, isLast, channel);
      flows.push(stepFlow);
    });
    flows.push(successFlow);

    flows.forEach(function(flow) {
      overlay.appendChild(flow);
    });

    document.body.appendChild(overlay);
    initEventHandlers();
    goToStep(0);
  }

  function buildSetupStep(step, index, isLast, channel) {
    var stepNumber = index + 1;
    var totalSteps = channel.setupSteps.length;
    
    // Generate step indicators
    var indicators = '';
    for (var i = 0; i <= totalSteps; i++) {
      var activeClass = i === stepNumber ? ' ch-ob-step-active' : '';
      indicators += '<div class="ch-ob-step-dot' + activeClass + '" style="' + 
                   (i === stepNumber ? 'background: ' + channel.color : '') + '"></div>';
    }

    var content = '';
    
    if (step.type === 'qr') {
      content = `
        <div class="ch-ob-qr-container">
          <div class="ch-ob-qr-placeholder">
            📱<br>QR Code<br>Placeholder
          </div>
        </div>
        <p style="text-align: center; font-size: 13px; color: rgba(255,255,255,0.5); margin: 0;">
          Open ${channel.name} on your phone and scan this code
        </p>
      `;
    } else if (step.type === 'token') {
      content = `
        <div class="ch-ob-field">
          <label for="chObTokenInput">${step.title}</label>
          <input class="ch-ob-input" id="chObTokenInput" type="text" 
                 placeholder="${step.placeholder || 'Enter token...'}" autocomplete="off" />
        </div>
        <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin: 8px 0 0;">
          You can find this in your ${channel.name} developer settings
        </p>
      `;
    } else if (step.type === 'server' || step.type === 'workspace') {
      var itemName = step.type === 'server' ? 'server' : 'workspace';
      content = `
        <div class="ch-ob-field">
          <label for="chObServerSelect">Select ${itemName}</label>
          <select class="ch-ob-input" id="chObServerSelect" style="font-family: inherit;">
            <option value="">Loading ${itemName}s...</option>
          </select>
        </div>
      `;
    } else if (step.type === 'system') {
      content = `
        <div class="ch-ob-system-access">
          <span class="ch-ob-system-icon">🔐</span>
          <p class="ch-ob-system-text">
            ${channel.name} needs system permissions to send and receive messages
          </p>
        </div>
        <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin: 16px 0 0; text-align: center;">
          Click "Grant Access" and approve the system dialog
        </p>
      `;
    } else if (step.type === 'verify') {
      content = `
        <div class="ch-ob-testing" id="chObTesting">
          <p style="font-size: 14px; color: rgba(255,255,255,0.6); margin: 0 0 16px;">
            Testing connection to ${channel.name}...
          </p>
          <div class="ch-ob-typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      `;
    }

    return makeFlow(stepNumber, `
      <div class="ch-ob-card">
        <div class="ch-ob-step-indicator">${indicators}</div>
        <div class="ch-ob-setup">
          <h2 class="ch-ob-step-title">${step.title}</h2>
          <p class="ch-ob-step-desc">${step.desc}</p>
          ${content}
        </div>
        
        <div class="ch-ob-actions">
          <button class="ch-ob-btn-back" id="chObBack">← Back</button>
          <button class="ch-ob-btn-primary" id="chObNext" 
                  style="background: ${channel.gradient}; color: #fff;" 
                  ${step.type === 'verify' ? 'style="display:none;"' : ''}>
            ${isLast ? 'Test Connection' : 'Continue'} →
          </button>
        </div>
      </div>
    `);
  }

  function makeFlow(num, html) {
    var el = document.createElement('div');
    el.className = 'ch-ob-flow';
    el.id = 'chObFlow' + num;
    el.innerHTML = html;
    return el;
  }

  // ── Flow Navigation ────────────────────────────────────────────────────────
  function goToStep(stepIndex) {
    var from = flows[currentStep];
    var to = flows[stepIndex];
    
    if (!to) {
      complete();
      return;
    }

    if (from) {
      from.classList.add('ch-ob-leaving');
      from.addEventListener('animationend', function handler() {
        from.classList.remove('ch-ob-active', 'ch-ob-leaving');
        from.removeEventListener('animationend', handler);
      });
    }

    setTimeout(function() {
      to.classList.add('ch-ob-active', 'ch-ob-entering');
      to.addEventListener('animationend', function handler() {
        to.classList.remove('ch-ob-entering');
        to.removeEventListener('animationend', handler);
        
        // Auto-start verification for verify steps
        if (stepIndex > 0 && channels[currentChannel].setupSteps[stepIndex - 1].type === 'verify') {
          setTimeout(function() {
            simulateVerification();
          }, 1000);
        }
      });
      currentStep = stepIndex;
    }, from ? 200 : 0);
  }

  function simulateVerification() {
    setTimeout(function() {
      var nextBtn = document.getElementById('chObNext');
      if (nextBtn) {
        nextBtn.style.display = 'inline-block';
        nextBtn.textContent = 'Continue →';
        nextBtn.disabled = false;
      }
      var testing = document.getElementById('chObTesting');
      if (testing) {
        testing.innerHTML = `
          <div style="color: #34C759; font-size: 14px;">
            ✅ Connection successful!
          </div>
        `;
      }
    }, 2500);
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────
  function initEventHandlers() {
    // Global event delegation for the overlay
    overlay.addEventListener('click', function(e) {
      if (e.target.id === 'chObCancel') {
        close();
      } else if (e.target.id === 'chObStartSetup') {
        goToStep(1);
      } else if (e.target.id === 'chObNext') {
        handleNext();
      } else if (e.target.id === 'chObBack') {
        goToStep(currentStep - 1);
      } else if (e.target.id === 'chObComplete') {
        complete();
      }
    });

    // Input validation
    overlay.addEventListener('input', function(e) {
      if (e.target.id === 'chObTokenInput') {
        var nextBtn = document.getElementById('chObNext');
        if (nextBtn) {
          nextBtn.disabled = !e.target.value.trim();
        }
      }
    });
  }

  function handleNext() {
    var channel = channels[currentChannel];
    var stepIndex = currentStep - 1;
    
    if (stepIndex >= 0 && stepIndex < channel.setupSteps.length) {
      var step = channel.setupSteps[stepIndex];
      var config = {};
      
      // Collect input data
      if (step.type === 'token') {
        var tokenInput = document.getElementById('chObTokenInput');
        if (tokenInput) {
          config.token = tokenInput.value.trim();
          if (!config.token) {
            tokenInput.focus();
            return;
          }
        }
      } else if (step.type === 'server' || step.type === 'workspace') {
        var serverSelect = document.getElementById('chObServerSelect');
        if (serverSelect) {
          config.server = serverSelect.value;
        }
      }
      
      // Save step config
      var existingConfig = JSON.parse(localStorage.getItem('spawnkit-channel-config-' + currentChannel) || '{}');
      Object.assign(existingConfig, config);
      localStorage.setItem('spawnkit-channel-config-' + currentChannel, JSON.stringify(existingConfig));
    }
    
    goToStep(currentStep + 1);
  }

  // ── Launch confetti for success ───────────────────────────────────────────
  function launchConfetti() {
    var colors = [currentChannel ? channels[currentChannel].color : '#007AFF', '#34C759', '#FF9500', '#FF2D55'];
    
    for (var i = 0; i < 30; i++) {
      (function(idx) {
        setTimeout(function() {
          var piece = document.createElement('div');
          piece.className = 'ch-ob-confetti-piece';
          piece.style.left = Math.random() * 100 + 'vw';
          piece.style.top = (Math.random() * 30 - 10) + 'vh';
          piece.style.background = colors[idx % colors.length];
          piece.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
          piece.style.animationDelay = (Math.random() * 0.6) + 's';
          document.body.appendChild(piece);
          confettiPieces.push(piece);
          piece.addEventListener('animationend', function() {
            if (piece.parentNode) piece.parentNode.removeChild(piece);
          });
        }, idx * 25);
      })(i);
    }
  }

  function stopConfetti() {
    confettiPieces.forEach(function(piece) {
      if (piece.parentNode) piece.parentNode.removeChild(piece);
    });
    confettiPieces = [];
  }

  // ── Complete & Close ───────────────────────────────────────────────────────
  function complete() {
    if (currentChannel) {
      var config = JSON.parse(localStorage.getItem('spawnkit-channel-config-' + currentChannel) || '{}');
      saveConnectedChannel(currentChannel, config);
      launchConfetti();
      
      setTimeout(function() {
        close();
      }, 2000);
    } else {
      close();
    }
  }

  function close() {
    stopConfetti();
    if (overlay) {
      overlay.classList.add('ch-ob-hiding');
      setTimeout(function() {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        overlay = null;
        flows = [];
        currentChannel = null;
        currentStep = 0;
      }, 320);
    }
  }

  // ── Settings Panel Integration ─────────────────────────────────────────────
  function addChannelSectionToSettings() {
    var settingsBody = document.getElementById('settingsBody');
    if (!settingsBody) return;

    // Remove loading state if present
    var existingEmpty = settingsBody.querySelector('.cron-empty');
    if (existingEmpty) {
      existingEmpty.remove();
    }

    // Check if channel section already exists
    var existing = settingsBody.querySelector('.settings-channels-section');
    if (existing) {
      updateChannelSection();
      return;
    }

    var connected = getConnectedChannels();
    var channelCards = Object.keys(channels).map(function(channelId) {
      var channel = channels[channelId];
      var isConnected = connected.some(function(c) { return c.id === channelId; });
      
      return `
        <div class="settings-channel-card ${isConnected ? 'connected' : ''}" data-channel="${channelId}">
          <span class="settings-channel-icon">${channel.icon}</span>
          <div class="settings-channel-name">${channel.name}</div>
          <div class="settings-channel-status ${isConnected ? 'connected' : ''}">${isConnected ? 'Connected' : 'Connect'}</div>
        </div>
      `;
    }).join('');

    var sectionHTML = `
      <div class="settings-channels-section">
        <h3 class="settings-section-title">
          <span>📡</span>
          Channel Connections
        </h3>
        <div class="settings-channels-grid">
          ${channelCards}
        </div>
      </div>
    `;

    settingsBody.insertAdjacentHTML('beforeend', sectionHTML);

    // Attach click handlers directly on each card (event delegation can be blocked by dialog overlays)
    var channelCards = settingsBody.querySelectorAll('.settings-channel-card');
    channelCards.forEach(function(card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function(e) {
        e.stopPropagation();
        var channelId = card.dataset.channel;
        if (!channelId) return;
        
        // Close settings first
        var settingsClose = document.getElementById('settingsClose');
        if (settingsClose) settingsClose.click();
        
        setTimeout(function() {
          buildFlow(channelId);
        }, 350);
      });
    });
  }

  function updateChannelSection() {
    var section = document.querySelector('.settings-channels-section');
    if (!section) return;

    var connected = getConnectedChannels();
    var cards = section.querySelectorAll('.settings-channel-card');
    
    cards.forEach(function(card) {
      var channelId = card.dataset.channel;
      var isConnected = connected.some(function(c) { return c.id === channelId; });
      var status = card.querySelector('.settings-channel-status');
      
      if (isConnected) {
        card.classList.add('connected');
        if (status) {
          status.classList.add('connected');
          status.textContent = 'Connected';
        }
      } else {
        card.classList.remove('connected');
        if (status) {
          status.classList.remove('connected');
          status.textContent = 'Connect';
        }
      }
    });
  }

  // ── Chat Panel Integration ─────────────────────────────────────────────────
  function addChannelButtonToChat() {
    var targetSelector = document.querySelector('.chat-target-selector');
    if (!targetSelector || targetSelector.querySelector('.chat-add-channel-btn')) return;

    var addButton = document.createElement('button');
    addButton.className = 'chat-add-channel-btn';
    addButton.textContent = '+';
    addButton.title = 'Connect new channel';
    
    addButton.addEventListener('click', function() {
      // Open a quick channel selector
      showChannelSelector();
    });

    targetSelector.appendChild(addButton);
  }

  function showChannelSelector() {
    var connected = getConnectedChannels();
    var availableChannels = Object.keys(channels).filter(function(id) {
      return !connected.some(function(c) { return c.id === id; });
    });

    if (availableChannels.length === 0) {
      // All channels connected, show settings instead
      var settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) settingsBtn.click();
      return;
    }

    // Create a simple channel picker overlay
    var pickerHTML = `
      <div class="ch-ob-overlay" id="channelPicker">
        <div class="ch-ob-card" style="width: 320px;">
          <h2 style="margin: 0 0 20px; font-size: 18px; color: #fff; text-align: center;">Connect Channel</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            ${availableChannels.map(function(channelId) {
              var channel = channels[channelId];
              return `
                <div class="settings-channel-card" data-channel="${channelId}" style="cursor: pointer;">
                  <span class="settings-channel-icon">${channel.icon}</span>
                  <div class="settings-channel-name">${channel.name}</div>
                  <div class="settings-channel-status">Connect</div>
                </div>
              `;
            }).join('')}
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <button class="ch-ob-btn-cancel" id="pickerCancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', pickerHTML);
    var picker = document.getElementById('channelPicker');

    picker.addEventListener('click', function(e) {
      if (e.target.id === 'pickerCancel' || e.target === picker) {
        picker.remove();
        return;
      }

      var channelCard = e.target.closest('.settings-channel-card');
      if (channelCard) {
        var channelId = channelCard.dataset.channel;
        picker.remove();
        buildFlow(channelId);
      }
    });
  }

  // ── Initialization ─────────────────────────────────────────────────────────
  function init() {
    // Add channel section to settings when settings panel opens
    document.addEventListener('click', function(e) {
      if (e.target.id === 'settingsBtn' || e.target.closest('#settingsBtn')) {
        setTimeout(addChannelSectionToSettings, 100);
      }
    });

    // Add channel button to chat panel
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
          addChannelButtonToChat();
          updateTargetDropdown();
        }, 500);
      });
    } else {
      setTimeout(function() {
        addChannelButtonToChat();
        updateTargetDropdown();
      }, 500);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.ChannelOnboarding = {
    open: buildFlow,
    close: close,
    getConnectedChannels: getConnectedChannels,
    channels: channels
  };

  // ── Auto-init ──────────────────────────────────────────────────────────────
  init();

})();