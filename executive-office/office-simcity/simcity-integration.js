(function() {
  'use strict';

  function init() {
    if (!window.ActivityBubbles || !window.ThemeChat) return;

    // 1. Init Activity Bubbles
    ActivityBubbles.init(document.getElementById('labels'));
    ActivityBubbles.setTheme('simcity');

    // 2. Monkey-patch updateLabels to also update bubble positions
    var origUpdateLabels = window.updateLabels;
    window.updateLabels = function() {
      origUpdateLabels();
      if (!window.ActivityBubbles) return;
      chars.forEach(function(ch) {
        var a = ch.agent;
        var isoPos = iso(ch.c, ch.r);
        var s = toScreen(isoPos.x, isoPos.y);
        var metrics = CHAR_METRICS[ch.charName];
        var targetH = DH * scale * 1.15;
        var imgScale = targetH / metrics.contentH;
        var headY = s.y + DH * scale * 0.15 - metrics.feetY * imgScale + metrics.headY * imgScale;
        ActivityBubbles.updatePosition(a.name, s.x, headY - 20 * scale);
      });
    };

    // 3. Map state changes to bubbles
    var stateEmoji = {
      'working':    '⚡',
      'walk_poi':   '🚶',
      'at_campfire':'☕',
      'walk_agent': '🚶',
      'meeting':    '💬',
      'returning':  '🏠'
    };
    var stateText = {
      'working':    'Working',
      'walk_poi':   'Going to campfire',
      'at_campfire':'Taking a break',
      'walk_agent': 'Visiting colleague',
      'meeting':    'In a meeting',
      'returning':  'Heading back'
    };

    setInterval(function() {
      if (!window.chars) return;
      chars.forEach(function(ch) {
        var emoji = stateEmoji[ch.state] || '💤';
        var text  = stateText[ch.state]  || 'Idle';
        ActivityBubbles.show(ch.agent.name, text, emoji);
      });
    }, 2000);

    // 4. Mount Chat Panel
    var chatContainer = document.createElement('div');
    chatContainer.id = 'simcityChat';
    chatContainer.style.cssText = 'position:fixed;right:0;bottom:0;width:380px;height:500px;z-index:100;display:none;';
    document.body.appendChild(chatContainer);

    ThemeChat.init(chatContainer, {
      theme:          'simcity',
      placeholder:    'Enter command...',
      userLabel:      'You',
      assistantLabel: '🤖 ApoMac'
    });

    var toggleBtn = document.createElement('button');
    toggleBtn.textContent = '💬';
    toggleBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:101;width:48px;height:48px;border-radius:50%;background:rgba(20,25,35,0.9);border:1px solid rgba(50,200,100,0.3);color:#B0FFB0;font-size:20px;cursor:pointer;';
    toggleBtn.addEventListener('click', function() {
      if (chatContainer.style.display === 'none') {
        chatContainer.style.display = 'block';
        ThemeChat.show();
      } else {
        chatContainer.style.display = 'none';
        ThemeChat.hide();
      }
    });
    document.body.appendChild(toggleBtn);

    // 5. Poll real sessions for task override
    setInterval(function() {
      if (!window.ThemeAuth || !window.API_URL) return;
      ThemeAuth.fetch(API_URL + '/api/oc/sessions').then(function(resp) {
        if (!resp.ok) return;
        return resp.json();
      }).then(function(data) {
        if (!data) return;
        var sessions = data.sessions || data || [];
        sessions.forEach(function(s) {
          if (s.kind !== 'subagent' || s.status !== 'active') return;
          var label = (s.label || '').toLowerCase();
          agents.forEach(function(a) {
            if (label.indexOf(a.name.toLowerCase()) >= 0) {
              ActivityBubbles.show(a.name, s.label || 'Working...', '⚡');
              ActivityBubbles.showProgress(a.name, 50);
            }
          });
        });
      }).catch(function() {});
    }, 10000);
  }

  // Wait 2 seconds after load for canvas/chars to initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 2000);
    });
  } else {
    setTimeout(init, 2000);
  }

}());
