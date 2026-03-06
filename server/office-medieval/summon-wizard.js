/**
 * SpawnKit Summon Knight Wizard — Medieval Theme
 * ═════════════════════════════════════════════════
 * 5-step wizard for creating new AI agent knights.
 * Self-contained module with inline CSS.
 * 
 * Usage: SummonWizard.open()
 * @version 2.1.0-medieval-agents
 */
(function() {
    'use strict';

    var state = { step: 0, displayName: '', name: '', role: 'squire', emoji: '⚔️', traits: [], skills: [], model: 'sonnet' };
    var overlay = null;

    var roles = {
        'squire': { label: 'Squire (General)', emoji: '⚔️', skills: ['weather', 'summarize'] },
        'blacksmith': { label: 'Blacksmith (Builder)', emoji: '🔨', skills: ['coding-agent', 'github'] },
        'scribe': { label: 'Scribe (Researcher)', emoji: '📜', skills: ['summarize', 'gog'] },
        'herald': { label: 'Herald (Writer)', emoji: '📯', skills: ['summarize', 'apple-notes'] },
        'warden': { label: 'Warden (Code Reviewer)', emoji: '🛡️', skills: ['github', 'coding-agent'] },
        'ranger': { label: 'Ranger (Scout/Recon)', emoji: '🏹', skills: ['weather', 'gog'] },
        'custom': { label: 'Custom', emoji: '⭐', skills: [] }
    };

    var traits = ['🗡️ Brave', '🧠 Wise', '🎯 Precise', '🛡️ Loyal', '🦊 Cunning', '⚡ Swift', '🎨 Creative', '📊 Analytical'];

    var skillsMap = {
        'coding-agent': { icon: '💻', name: 'Coding Agent', desc: 'Build and refactor code' },
        'github': { icon: '🐙', name: 'GitHub', desc: 'Manage repositories and PRs' },
        'weather': { icon: '🌤️', name: 'Weather', desc: 'Current weather and forecasts' },
        'summarize': { icon: '📝', name: 'Summarize', desc: 'Extract text from URLs and files' },
        'gog': { icon: '📧', name: 'Gmail', desc: 'Send emails and manage calendar' },
        '1password': { icon: '🔑', name: '1Password', desc: 'Manage secrets and passwords' },
        'apple-notes': { icon: '📱', name: 'Apple Notes', desc: 'Create and manage notes' },
        'imsg': { icon: '💬', name: 'iMessage', desc: 'Send iMessage and SMS' }
    };

    var models = {
        'opus': { icon: '👑', name: 'Opus', subtitle: 'The King\'s Sage', desc: 'Most capable, highest cost' },
        'sonnet': { icon: '⚔️', name: 'Sonnet', subtitle: 'Knight Commander', desc: 'Balanced performance', default: true },
        'codex': { icon: '⚡', name: 'Codex', subtitle: 'Swift Courier', desc: 'Fast, code-focused' }
    };

    function injectCSS() {
        if (document.getElementById('summon-wizard-css')) return;
        var style = document.createElement('style');
        style.id = 'summon-wizard-css';
        style.textContent = '.sw-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:5000;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease;backdrop-filter:blur(8px)}.sw-overlay.visible{opacity:1}.sw-panel{width:520px;max-width:90vw;max-height:85vh;background:linear-gradient(145deg,#f4e4bc 0%,#e8d5a3 100%);border:3px solid var(--castle-gold);border-radius:12px;position:relative;animation:sw-slide-in .4s cubic-bezier(0.2,0.8,0.2,1);overflow:hidden;font-family:"Crimson Text",serif}@keyframes sw-slide-in{from{transform:translateY(40px) scale(.9);opacity:0}to{transform:none;opacity:1}}.sw-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border:none;background:transparent;color:var(--castle-navy);font-size:18px;cursor:pointer;border-radius:50%;transition:all .2s;z-index:10}.sw-close:hover{background:rgba(0,0,0,.1)}.sw-header{text-align:center;padding:24px 24px 20px;border-bottom:2px solid rgba(201,169,89,.3)}.sw-title{font-family:"Cinzel",serif;font-size:24px;font-weight:600;color:var(--castle-navy);margin:0 0 8px;text-shadow:1px 1px 2px rgba(0,0,0,.1)}.sw-subtitle{font-size:14px;color:var(--castle-brown);margin:0}.sw-steps{display:flex;justify-content:center;gap:8px;margin:16px 0 0}.sw-step{width:12px;height:12px;border-radius:50%;background:rgba(201,169,89,.3);transition:all .3s}.sw-step.active{background:var(--castle-gold);transform:scale(1.2)}.sw-step.completed{background:var(--castle-navy)}.sw-body{padding:24px;color:var(--castle-navy);min-height:300px;display:flex;flex-direction:column}.sw-step-content{flex:1;display:none}.sw-step-content.active{display:block}.sw-label{display:block;font-weight:600;margin:0 0 8px;font-size:16px}.sw-input,.sw-select{width:100%;padding:12px 16px;border:2px solid rgba(139,115,85,.3);border-radius:8px;background:rgba(244,228,188,.5);color:var(--castle-navy);font-family:"Crimson Text",serif;font-size:14px;outline:none;transition:all .2s;box-sizing:border-box}.sw-input:focus,.sw-select:focus{border-color:var(--castle-gold)}.sw-select{cursor:pointer}.sw-field{margin-bottom:20px}.sw-preview{font-style:italic;color:var(--castle-brown);margin-top:8px;padding:12px;background:rgba(201,169,89,.1);border-radius:6px;border-left:3px solid var(--castle-gold)}.sw-traits-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:12px}.sw-trait-badge{padding:8px 12px;border:2px solid rgba(139,115,85,.3);border-radius:20px;background:rgba(244,228,188,.3);cursor:pointer;text-align:center;font-size:13px;font-weight:500;transition:all .2s;user-select:none}.sw-trait-badge.selected{border-color:var(--castle-gold);background:rgba(201,169,89,.3);transform:translateY(-1px);box-shadow:0 3px 8px rgba(0,0,0,.2)}.sw-trait-badge:hover{transform:translateY(-1px)}.sw-skills-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px}.sw-skill-item{padding:12px;border:2px solid rgba(139,115,85,.3);border-radius:8px;background:rgba(244,228,188,.3);cursor:pointer;transition:all .2s;position:relative}.sw-skill-item.selected{border-color:var(--castle-gold);background:rgba(201,169,89,.3)}.sw-skill-icon{font-size:20px;margin-bottom:4px}.sw-skill-name{font-weight:600;font-size:13px;margin-bottom:2px}.sw-skill-desc{font-size:11px;color:var(--castle-brown);line-height:1.3}.sw-skill-checkbox{position:absolute;top:8px;right:8px;width:16px;height:16px}.sw-models-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}.sw-model-card{padding:16px;border:2px solid rgba(139,115,85,.3);border-radius:8px;background:rgba(244,228,188,.3);cursor:pointer;text-align:center;transition:all .2s;position:relative}.sw-model-card.selected{border-color:var(--castle-gold);background:rgba(201,169,89,.3);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.2)}.sw-model-card:hover{transform:translateY(-1px)}.sw-model-icon{font-size:28px;margin-bottom:8px}.sw-model-name{font-weight:600;font-size:16px;margin-bottom:4px}.sw-model-subtitle{font-size:12px;color:var(--castle-brown);margin-bottom:6px}.sw-model-desc{font-size:11px;color:var(--castle-brown)}.sw-model-default{position:absolute;top:8px;right:8px;background:var(--castle-gold);color:var(--castle-navy);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600}.sw-summary{background:rgba(201,169,89,.1);border:2px solid rgba(201,169,89,.3);border-radius:8px;padding:16px;margin-bottom:20px}.sw-summary h3{margin:0 0 12px;color:var(--castle-navy);font-family:"Cinzel",serif}.sw-summary-item{margin:6px 0;display:flex;align-items:center;gap:8px}.sw-summary-label{font-weight:600;min-width:60px}.sw-summary-value{flex:1}.sw-footer{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-top:2px solid rgba(201,169,89,.3);background:rgba(244,228,188,.3)}.sw-btn{padding:10px 20px;border-radius:6px;font-family:"Crimson Text",serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .2s;text-decoration:none;display:inline-block;text-align:center}.sw-btn-primary{background:var(--castle-gold);color:var(--castle-navy);box-shadow:0 2px 8px rgba(201,169,89,.3)}.sw-btn-primary:hover{background:#d4b76a;transform:translateY(-1px);box-shadow:0 3px 12px rgba(201,169,89,.4)}.sw-btn-primary:disabled{background:#ccc;cursor:not-allowed;transform:none;box-shadow:none}.sw-btn-secondary{background:transparent;color:var(--castle-brown);border:2px solid rgba(139,115,85,.3)}.sw-btn-secondary:hover{background:rgba(139,115,85,.1)}.sw-btn-secondary:disabled{opacity:0.5;cursor:not-allowed}.sw-loading{opacity:0.6;pointer-events:none}.sw-error{color:var(--castle-red);font-size:12px;margin-top:8px;padding:8px;background:rgba(233,69,96,.1);border-radius:4px;border-left:3px solid var(--castle-red)}';
        document.head.appendChild(style);
    }

    function generateSlug(displayName) {
        return displayName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    function goToStep(stepNum) {
        if (stepNum < 0 || stepNum > 4) return;
        var currentStep = overlay.querySelector('.sw-step-content.active');
        if (currentStep) currentStep.classList.remove('active');
        var newStep = overlay.querySelector('[data-step="' + stepNum + '"]');
        if (newStep) newStep.classList.add('active');
        var indicators = overlay.querySelectorAll('.sw-step');
        indicators.forEach(function(indicator, index) {
            indicator.classList.toggle('active', index === stepNum);
            indicator.classList.toggle('completed', index < stepNum);
        });
        var prevBtn = overlay.querySelector('.sw-btn-prev');
        var nextBtn = overlay.querySelector('.sw-btn-next');
        var summonBtn = overlay.querySelector('.sw-btn-summon');
        if (prevBtn) prevBtn.style.display = stepNum === 0 ? 'none' : 'block';
        if (nextBtn) nextBtn.style.display = stepNum === 4 ? 'none' : 'block';
        if (summonBtn) summonBtn.style.display = stepNum === 4 ? 'block' : 'none';
        state.step = stepNum;
        updateStepContent();
    }

    function updateStepContent() {
        if (state.step === 0) {
            var nameInput = overlay.querySelector('#knight-name');
            if (nameInput) {
                nameInput.addEventListener('input', function() {
                    state.displayName = nameInput.value;
                    state.name = generateSlug(nameInput.value);
                });
            }
        } else if (state.step === 1) {
            updateTraitsPreview();
        } else if (state.step === 4) {
            updateSummary();
        }
    }

    function updateTraitsPreview() {
        var preview = overlay.querySelector('.sw-traits-preview');
        if (preview) {
            var name = state.displayName || 'This Knight';
            if (state.traits.length === 0) {
                preview.textContent = name + ' awaits trait selection.';
            } else {
                var traitNames = state.traits.map(function(t) { return t.split(' ')[1]; }).join(' and ');
                preview.textContent = 'Sir ' + name + ' will be ' + traitNames.toLowerCase() + '.';
            }
        }
    }

    function updateSummary() {
        var summary = overlay.querySelector('.sw-summary-content');
        if (!summary) return;
        var role = roles[state.role];
        var modelData = models[state.model];
        summary.innerHTML = [
            '<div class="sw-summary-item"><span class="sw-summary-label">Name:</span><span class="sw-summary-value">' + (state.displayName || 'Unnamed') + '</span></div>',
            '<div class="sw-summary-item"><span class="sw-summary-label">Role:</span><span class="sw-summary-value">' + state.emoji + ' ' + role.label + '</span></div>',
            '<div class="sw-summary-item"><span class="sw-summary-label">Traits:</span><span class="sw-summary-value">' + state.traits.join(', ') + '</span></div>',
            '<div class="sw-summary-item"><span class="sw-summary-label">Skills:</span><span class="sw-summary-value">' + state.skills.length + ' selected</span></div>',
            '<div class="sw-summary-item"><span class="sw-summary-label">Model:</span><span class="sw-summary-value">' + modelData.icon + ' ' + modelData.name + '</span></div>'
        ].join('');
    }

    function createWizardDOM() {
        var wizardHTML = '<div class="sw-panel"><button class="sw-close" onclick="SummonWizard.close()">&times;</button><div class="sw-header"><h1 class="sw-title">⚔️ Summon Knight</h1><p class="sw-subtitle">Create a new AI agent for your medieval court</p><div class="sw-steps"><div class="sw-step active"></div><div class="sw-step"></div><div class="sw-step"></div><div class="sw-step"></div><div class="sw-step"></div></div></div><div class="sw-body"><div class="sw-step-content active" data-step="0"><div class="sw-field"><label class="sw-label" for="knight-name">Knight Name</label><input type="text" id="knight-name" class="sw-input" placeholder="Enter the knight\'s name..." /></div><div class="sw-field"><label class="sw-label" for="knight-role">Role</label><select id="knight-role" class="sw-select">' + Object.keys(roles).map(function(key) { var role = roles[key]; return '<option value="' + key + '">' + role.emoji + ' ' + role.label + '</option>'; }).join('') + '</select></div></div><div class="sw-step-content" data-step="1"><label class="sw-label">Choose Traits (1-3)</label><div class="sw-traits-grid">' + traits.map(function(trait) { return '<div class="sw-trait-badge" data-trait="' + trait + '">' + trait + '</div>'; }).join('') + '</div><div class="sw-preview sw-traits-preview">Sir Knight awaits trait selection.</div></div><div class="sw-step-content" data-step="2"><label class="sw-label">Select Skills</label><div class="sw-skills-grid">' + Object.keys(skillsMap).map(function(key) { var skill = skillsMap[key]; return '<div class="sw-skill-item" data-skill="' + key + '"><input type="checkbox" class="sw-skill-checkbox" /><div class="sw-skill-icon">' + skill.icon + '</div><div class="sw-skill-name">' + skill.name + '</div><div class="sw-skill-desc">' + skill.desc + '</div></div>'; }).join('') + '</div></div><div class="sw-step-content" data-step="3"><label class="sw-label">Choose Model</label><div class="sw-models-grid">' + Object.keys(models).map(function(key) { var model = models[key]; return '<div class="sw-model-card' + (model.default ? ' selected' : '') + '" data-model="' + key + '">' + (model.default ? '<div class="sw-model-default">Default</div>' : '') + '<div class="sw-model-icon">' + model.icon + '</div><div class="sw-model-name">' + model.name + '</div><div class="sw-model-subtitle">' + model.subtitle + '</div><div class="sw-model-desc">' + model.desc + '</div></div>'; }).join('') + '</div></div><div class="sw-step-content" data-step="4"><div class="sw-summary"><h3>Knight Summary</h3><div class="sw-summary-content"></div></div></div></div><div class="sw-footer"><button class="sw-btn sw-btn-secondary sw-btn-prev" style="display:none;">Previous</button><button class="sw-btn sw-btn-primary sw-btn-next">Next</button><button class="sw-btn sw-btn-primary sw-btn-summon" style="display:none;">⚔️ Summon Knight</button></div></div>';

        overlay = document.createElement('div');
        overlay.className = 'sw-overlay';
        overlay.innerHTML = wizardHTML;
        document.body.appendChild(overlay);
        wireEventListeners();
        state.model = 'sonnet';
        updateRoleSkills();
    }

    function wireEventListeners() {
        var roleSelect = overlay.querySelector('#knight-role');
        roleSelect.addEventListener('change', function() {
            state.role = roleSelect.value;
            state.emoji = roles[state.role].emoji;
            updateRoleSkills();
        });

        overlay.querySelectorAll('.sw-trait-badge').forEach(function(badge) {
            badge.addEventListener('click', function() {
                var trait = badge.getAttribute('data-trait');
                var index = state.traits.indexOf(trait);
                if (index === -1 && state.traits.length < 3) {
                    state.traits.push(trait);
                    badge.classList.add('selected');
                } else if (index !== -1) {
                    state.traits.splice(index, 1);
                    badge.classList.remove('selected');
                }
                updateTraitsPreview();
            });
        });

        overlay.querySelectorAll('.sw-skill-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var skill = item.getAttribute('data-skill');
                var checkbox = item.querySelector('.sw-skill-checkbox');
                var index = state.skills.indexOf(skill);
                if (index === -1) {
                    state.skills.push(skill);
                    item.classList.add('selected');
                    checkbox.checked = true;
                } else {
                    state.skills.splice(index, 1);
                    item.classList.remove('selected');
                    checkbox.checked = false;
                }
            });
        });

        overlay.querySelectorAll('.sw-model-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var model = card.getAttribute('data-model');
                state.model = model;
                overlay.querySelectorAll('.sw-model-card').forEach(function(c) { c.classList.remove('selected'); });
                card.classList.add('selected');
            });
        });

        var prevBtn = overlay.querySelector('.sw-btn-prev');
        var nextBtn = overlay.querySelector('.sw-btn-next');
        var summonBtn = overlay.querySelector('.sw-btn-summon');

        if (prevBtn) prevBtn.addEventListener('click', function() { goToStep(state.step - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function() { if (validateStep()) goToStep(state.step + 1); });
        if (summonBtn) summonBtn.addEventListener('click', summonKnight);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) SummonWizard.close(); });
    }

    function updateRoleSkills() {
        var roleSkills = roles[state.role].skills;
        state.skills = [];
        overlay.querySelectorAll('.sw-skill-item').forEach(function(item) {
            var skill = item.getAttribute('data-skill');
            var checkbox = item.querySelector('.sw-skill-checkbox');
            if (roleSkills.includes(skill)) {
                state.skills.push(skill);
                item.classList.add('selected');
                checkbox.checked = true;
            } else {
                item.classList.remove('selected');
                checkbox.checked = false;
            }
        });
    }

    function validateStep() {
        if (state.step === 0) {
            var nameInput = overlay.querySelector('#knight-name');
            state.displayName = nameInput.value.trim();
            state.name = generateSlug(state.displayName);
            if (!state.displayName) {
                showError('Please enter a knight name.');
                return false;
            }
        } else if (state.step === 1) {
            if (state.traits.length === 0) {
                showError('Please select at least one trait.');
                return false;
            }
        }
        return true;
    }

    function showError(message) {
        var existingError = overlay.querySelector('.sw-error');
        if (existingError) existingError.remove();
        var error = document.createElement('div');
        error.className = 'sw-error';
        error.textContent = message;
        var activeStep = overlay.querySelector('.sw-step-content.active');
        if (activeStep) {
            activeStep.appendChild(error);
            setTimeout(function() { error.remove(); }, 5000);
        }
    }

    function summonKnight() {
        var summonBtn = overlay.querySelector('.sw-btn-summon');
        if (!summonBtn) return;
        summonBtn.disabled = true;
        summonBtn.textContent = 'Summoning...';
        overlay.classList.add('sw-loading');

        var payload = {
            name: state.name,
            displayName: state.displayName,
            role: state.role,
            model: state.model,
            traits: state.traits.map(function(t) { return t.split(' ')[1].toLowerCase(); }),
            skills: state.skills,
            theme: 'medieval',
            emoji: state.emoji,
            customInstructions: 'You are ' + state.displayName + ', a ' + roles[state.role].label.toLowerCase() + 
               ' with the following traits: ' + state.traits.map(function(t) { return t.split(' ')[1].toLowerCase(); }).join(', ') + 
               '. Embody these characteristics in all interactions while staying helpful and professional.'
        };

        var fetcher = (typeof ThemeAuth !== 'undefined' && ThemeAuth.fetch) ? ThemeAuth.fetch.bind(ThemeAuth) : window.fetch.bind(window);
        var apiUrl = (typeof ThemeAuth !== 'undefined' && ThemeAuth.getApiUrl) ? ThemeAuth.getApiUrl() : (window.API_URL || 'http://127.0.0.1:8765');

        fetcher(apiUrl + '/api/oc/agents/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(response) {
            if (!response.ok) throw new Error('Failed to create agent: ' + response.statusText);
            return response.json();
        })
        .then(function(result) {
            console.log('[SpawnKit Medieval] SummonWizard v2.1.0-medieval-agents — knight created:', result.agentId || result.agentId || '(missing id)');
            window.dispatchEvent(new CustomEvent('knight-summoned', {
                detail: { agentId: result.agentId || result.id, displayName: state.displayName }
            }));
            SummonWizard.close();
        })
        .catch(function(error) {
            console.error('Knight summoning failed:', error);
            showError('Failed to summon knight: ' + error.message);
            summonBtn.disabled = false;
            summonBtn.textContent = '⚔️ Summon Knight';
            overlay.classList.remove('sw-loading');
        });
    }

    window.SummonWizard = {
        open: function() {
            injectCSS();
            if (!overlay) createWizardDOM();
            state = { step: 0, displayName: '', name: '', role: 'squire', emoji: '⚔️', traits: [], skills: [], model: 'sonnet' };
            overlay.style.display = 'flex';
            setTimeout(function() { overlay.classList.add('visible'); }, 10);
            goToStep(0);
        },
        close: function() {
            if (overlay) {
                overlay.classList.remove('visible');
                setTimeout(function() { overlay.style.display = 'none'; }, 300);
            }
        }
    };

})();