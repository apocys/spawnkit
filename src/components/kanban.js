/**
 * SpawnKit Kanban Board
 * A drag-and-drop Kanban board for AI agent fleet management
 */

class SpawnKitKanban {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      relayUrl: options.relayUrl || window.OC_RELAY_URL || 'http://localhost:18790',
      theme: options.theme || 'dark',
      onCardClick: options.onCardClick || (() => {}),
      onCardMove: options.onCardMove || (() => {}),
      ...options
    };
    
    this.columns = [
      { id: 'todo', title: 'Todo', color: '#64748b', cards: [] },
      { id: 'inprogress', title: 'In Progress', color: '#f59e0b', cards: [] },
      { id: 'done', title: 'Done', color: '#22c55e', cards: [] }
    ];
    
    this.draggedCard = null;
    this.draggedFrom = null;
    
    this.init();
  }
  
  init() {
    this.injectStyles();
    this.render();
    this.loadData();
  }
  
  injectStyles() {
    const styleId = 'spawnkit-kanban-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .sk-kanban {
        --sk-bg: ${this.options.theme === 'dark' ? '#1a1a1a' : '#f8fafc'};
        --sk-surface: ${this.options.theme === 'dark' ? '#2d2d2d' : '#ffffff'};
        --sk-border: ${this.options.theme === 'dark' ? '#404040' : '#e2e8f0'};
        --sk-text: ${this.options.theme === 'dark' ? '#ffffff' : '#1e293b'};
        --sk-text-muted: ${this.options.theme === 'dark' ? '#a1a1aa' : '#64748b'};
        --sk-shadow: ${this.options.theme === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)'};
        --sk-shadow-hover: ${this.options.theme === 'dark' ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.2)'};
        
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        background: var(--sk-bg);
        border-radius: 12px;
        padding: 24px;
        min-height: 600px;
        color: var(--sk-text);
      }
      
      .sk-kanban-board {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        height: 100%;
      }
      
      @media (max-width: 768px) {
        .sk-kanban-board {
          grid-template-columns: 1fr;
          gap: 16px;
        }
      }
      
      .sk-column {
        background: var(--sk-surface);
        border-radius: 12px;
        border: 1px solid var(--sk-border);
        display: flex;
        flex-direction: column;
        min-height: 500px;
        transition: all 0.2s ease;
      }
      
      .sk-column.drop-zone {
        border-color: var(--column-color);
        background: ${this.options.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'};
        transform: scale(1.02);
      }
      
      .sk-column-header {
        padding: 16px 20px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--sk-border);
      }
      
      .sk-column-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--column-color);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .sk-column-count {
        background: var(--column-color);
        color: white;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 12px;
        min-width: 20px;
        text-align: center;
      }
      
      .sk-column-cards {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .sk-column-cards::-webkit-scrollbar {
        width: 6px;
      }
      
      .sk-column-cards::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .sk-column-cards::-webkit-scrollbar-thumb {
        background: var(--sk-border);
        border-radius: 3px;
      }
      
      .sk-column-cards::-webkit-scrollbar-thumb:hover {
        background: var(--sk-text-muted);
      }
      
      .sk-card {
        background: var(--sk-surface);
        border: 1px solid var(--sk-border);
        border-radius: 8px;
        padding: 16px;
        cursor: move;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
      }
      
      .sk-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--sk-shadow-hover);
        border-color: var(--column-color);
      }
      
      .sk-card.dragging {
        opacity: 0.5;
        transform: rotate(5deg);
      }
      
      .sk-card-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }
      
      .sk-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: white;
        flex-shrink: 0;
      }
      
      .sk-card-content {
        flex: 1;
        min-width: 0;
      }
      
      .sk-card-title {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: var(--sk-text);
        line-height: 1.4;
      }
      
      .sk-card-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .sk-priority {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .sk-agent-name {
        font-size: 12px;
        color: var(--sk-text-muted);
        font-weight: 500;
      }
      
      .sk-time {
        font-size: 11px;
        color: var(--sk-text-muted);
        background: var(--sk-border);
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .sk-empty-column {
        text-align: center;
        color: var(--sk-text-muted);
        font-size: 14px;
        padding: 40px 20px;
        font-style: italic;
      }
      
      .sk-loading {
        text-align: center;
        color: var(--sk-text-muted);
        font-size: 14px;
        padding: 40px 20px;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  render() {
    this.container.innerHTML = `
      <div class="sk-kanban">
        <div class="sk-kanban-board">
          ${this.columns.map(col => `
            <div class="sk-column" data-column="${col.id}" style="--column-color: ${col.color}">
              <div class="sk-column-header">
                <div class="sk-column-title">
                  ${col.title}
                </div>
                <div class="sk-column-count">${col.cards.length}</div>
              </div>
              <div class="sk-column-cards" data-column="${col.id}">
                ${col.cards.length === 0 ? 
                  '<div class="sk-empty-column">No tasks yet</div>' :
                  col.cards.map(card => this.renderCard(card)).join('')
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    this.setupDragAndDrop();
  }
  
  renderCard(card) {
    const priorityIcons = {
      critical: '🔴',
      high: '🟡', 
      normal: '🔵',
      low: '⚪'
    };
    
    return `
      <div class="sk-card" draggable="true" data-card-id="${card.id}">
        <div class="sk-card-header">
          <div class="sk-avatar" style="background-color: ${card.avatar.color}">
            ${card.avatar.initials}
          </div>
          <div class="sk-card-content">
            <h3 class="sk-card-title">${card.title}</h3>
            <div class="sk-card-meta">
              <span class="sk-priority">
                ${priorityIcons[card.priority]} ${card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
              </span>
              <span class="sk-agent-name">${card.agent}</span>
              <span class="sk-time">${card.timeEstimate || card.elapsed}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  setupDragAndDrop() {
    const cards = this.container.querySelectorAll('.sk-card');
    const columns = this.container.querySelectorAll('.sk-column-cards');
    
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        this.draggedCard = card;
        this.draggedFrom = card.closest('.sk-column-cards').dataset.column;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', card.outerHTML);
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedCard = null;
        this.draggedFrom = null;
      });
      
      card.addEventListener('click', () => {
        const cardId = card.dataset.cardId;
        const cardData = this.findCardById(cardId);
        if (cardData) {
          this.options.onCardClick(cardData);
        }
      });
    });
    
    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        column.closest('.sk-column').classList.add('drop-zone');
      });
      
      column.addEventListener('dragleave', (e) => {
        if (!column.contains(e.relatedTarget)) {
          column.closest('.sk-column').classList.remove('drop-zone');
        }
      });
      
      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.closest('.sk-column').classList.remove('drop-zone');
        
        if (this.draggedCard) {
          const targetColumn = column.dataset.column;
          const cardId = this.draggedCard.dataset.cardId;
          
          if (this.draggedFrom !== targetColumn) {
            this.moveCard(cardId, this.draggedFrom, targetColumn);
          }
        }
      });
    });
  }
  
  findCardById(cardId) {
    for (const column of this.columns) {
      const card = column.cards.find(c => c.id === cardId);
      if (card) return card;
    }
    return null;
  }
  
  moveCard(cardId, fromColumn, toColumn) {
    const fromCol = this.columns.find(col => col.id === fromColumn);
    const toCol = this.columns.find(col => col.id === toColumn);
    
    if (!fromCol || !toCol) return;
    
    const cardIndex = fromCol.cards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return;
    
    const card = fromCol.cards.splice(cardIndex, 1)[0];
    toCol.cards.push(card);
    
    this.options.onCardMove(card, fromColumn, toColumn);
    this.render();
  }
  
  async loadData() {
    try {
      // Try to fetch from relay first
      const response = await fetch(`${this.options.relayUrl}/api/oc/sessions`);
      if (response.ok) {
        const sessions = await response.json();
        this.mapSessionsToCards(sessions);
      } else {
        throw new Error('Relay not available');
      }
    } catch (error) {
      console.log('Using demo data:', error.message);
      this.loadDemoData();
    }
    
    this.render();
  }
  
  mapSessionsToCards(sessions) {
    this.columns.forEach(col => col.cards = []);
    
    sessions.forEach(session => {
      const card = this.sessionToCard(session);
      
      // Determine column based on session state
      let columnId = 'todo';
      if (session.active && session.lastActivity) {
        const lastActivity = new Date(session.lastActivity);
        const now = new Date();
        const minutesAgo = (now - lastActivity) / (1000 * 60);
        
        if (minutesAgo < 30) {
          columnId = 'inprogress';
        }
      } else if (session.completed) {
        columnId = 'done';
      }
      
      const column = this.columns.find(col => col.id === columnId);
      if (column) {
        column.cards.push(card);
      }
    });
  }
  
  sessionToCard(session) {
    const agentNames = ['Claude', 'Opus', 'Sonnet', 'Haiku', 'GPT-4', 'Gemini'];
    const priorities = ['critical', 'high', 'normal', 'low'];
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    
    const agentName = agentNames[Math.floor(Math.random() * agentNames.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    return {
      id: session.id || `session-${Date.now()}-${Math.random()}`,
      title: session.task || session.label || 'Unnamed Task',
      agent: agentName,
      avatar: {
        initials: agentName.substring(0, 2).toUpperCase(),
        color: color
      },
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      timeEstimate: session.duration || this.randomTime(),
      status: session.status || 'pending'
    };
  }
  
  loadDemoData() {
    const demoCards = [
      // Todo column
      {
        id: 'task-1',
        title: 'Analyze user feedback from Q4',
        agent: 'Claude',
        avatar: { initials: 'CL', color: '#ef4444' },
        priority: 'high',
        timeEstimate: '2h 30m'
      },
      {
        id: 'task-2', 
        title: 'Generate weekly performance report',
        agent: 'Sonnet',
        avatar: { initials: 'SN', color: '#10b981' },
        priority: 'normal',
        timeEstimate: '45m'
      },
      {
        id: 'task-3',
        title: 'Update documentation for API v2.1',
        agent: 'GPT-4',
        avatar: { initials: 'GP', color: '#3b82f6' },
        priority: 'low',
        timeEstimate: '1h 15m'
      },
      {
        id: 'task-4',
        title: 'Research competitor pricing strategies',
        agent: 'Gemini',
        avatar: { initials: 'GM', color: '#8b5cf6' },
        priority: 'normal',
        timeEstimate: '3h'
      },
      
      // In Progress column
      {
        id: 'task-5',
        title: 'Process customer support tickets',
        agent: 'Opus',
        avatar: { initials: 'OP', color: '#f59e0b' },
        priority: 'critical',
        elapsed: 'Running 1h 22m'
      },
      {
        id: 'task-6',
        title: 'Generate social media content',
        agent: 'Haiku', 
        avatar: { initials: 'HK', color: '#ec4899' },
        priority: 'normal',
        elapsed: 'Running 34m'
      },
      {
        id: 'task-7',
        title: 'Optimize database queries',
        agent: 'Claude',
        avatar: { initials: 'CL', color: '#ef4444' },
        priority: 'high',
        elapsed: 'Running 2h 8m'
      },
      
      // Done column
      {
        id: 'task-8',
        title: 'Deploy security patches',
        agent: 'Sonnet',
        avatar: { initials: 'SN', color: '#10b981' },
        priority: 'critical',
        timeEstimate: 'Completed in 45m'
      },
      {
        id: 'task-9',
        title: 'Create onboarding tutorial videos',
        agent: 'GPT-4',
        avatar: { initials: 'GP', color: '#3b82f6' },
        priority: 'normal', 
        timeEstimate: 'Completed in 2h 15m'
      },
      {
        id: 'task-10',
        title: 'Backup production database',
        agent: 'Opus',
        avatar: { initials: 'OP', color: '#f59e0b' },
        priority: 'high',
        timeEstimate: 'Completed in 1h 5m'
      },
      {
        id: 'task-11',
        title: 'Send monthly newsletter',
        agent: 'Gemini',
        avatar: { initials: 'GM', color: '#8b5cf6' },
        priority: 'low',
        timeEstimate: 'Completed in 25m'
      },
      {
        id: 'task-12',
        title: 'Review code changes',
        agent: 'Haiku',
        avatar: { initials: 'HK', color: '#ec4899' },
        priority: 'normal',
        timeEstimate: 'Completed in 1h 40m'
      }
    ];
    
    // Distribute cards across columns
    this.columns[0].cards = demoCards.slice(0, 4);  // Todo
    this.columns[1].cards = demoCards.slice(4, 7);  // In Progress  
    this.columns[2].cards = demoCards.slice(7);     // Done
  }
  
  randomTime() {
    const hours = Math.floor(Math.random() * 4);
    const minutes = Math.floor(Math.random() * 60);
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }
  
  refresh() {
    this.loadData();
  }
  
  setTheme(theme) {
    this.options.theme = theme;
    this.injectStyles();
    this.render();
  }
  
  addCard(columnId, card) {
    const column = this.columns.find(col => col.id === columnId);
    if (column) {
      column.cards.push({
        id: `card-${Date.now()}-${Math.random()}`,
        ...card
      });
      this.render();
    }
  }
  
  removeCard(cardId) {
    for (const column of this.columns) {
      const index = column.cards.findIndex(card => card.id === cardId);
      if (index !== -1) {
        column.cards.splice(index, 1);
        this.render();
        break;
      }
    }
  }
}

// Export for use in modules or direct browser usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpawnKitKanban;
} else {
  window.SpawnKitKanban = SpawnKitKanban;
}