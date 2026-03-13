/* medieval-tasks.js — Real-time TODO panel in medieval sidebar */
(function() {
  'use strict';

  var POLL_MS = 10000; // 10s
  var container = null;
  var lastHash = '';

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function parseTodo(raw) {
    if (!raw) return [];
    var lines = raw.split('\n');
    var tasks = [];
    var inActive = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^## /.test(line) && /Active|NEXT|To Do|Tasks/i.test(line)) { inActive = true; continue; }
      if (/^## /.test(line) && !/Active|NEXT/i.test(line) && inActive) break;
      if (/^### /.test(line) && inActive) {
        // Section header
        var title = line.replace(/^###\s*/, '').replace(/\|.*$/, '').trim();
        if (title.length > 3) tasks.push({ type: 'header', text: title });
        continue;
      }
      if (inActive && /^\s*[-*]/.test(line)) {
        var isDone = /✅|☑|done/i.test(line);
        var text = line.replace(/^\s*[-*]\s*/, '').replace(/[✅⬜☑☐]/g, '').replace(/\*\*/g, '').trim();
        if (text && text.length > 2 && !isDone) tasks.push({ type: 'task', done: isDone, text: text });
      }
    }
    return tasks.slice(0, 10);
  }

  function render(tasks) {
    if (!container) container = document.getElementById('medieval-tasks');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:rgba(201,169,89,0.4);font-style:italic;padding:6px;">No active quests</div>';
      return;
    }

    var html = '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:rgba(201,169,89,0.5);margin-bottom:6px;font-weight:600;">📋 Active Quests</div>';
    tasks.forEach(function(t) {
      if (t.type === 'header') {
        html += '<div style="font-size:10px;color:rgba(201,169,89,0.6);margin:6px 0 2px;font-weight:600;">' + esc(t.text) + '</div>';
      } else {
        html += '<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:3px;line-height:1.4;">';
        html += '<span style="color:rgba(201,169,89,0.4);flex-shrink:0;">•</span>';
        html += '<span style="color:#E8D5B0;font-size:11px;">' + esc(t.text.substring(0, 80)) + '</span>';
        html += '</div>';
      }
    });
    container.innerHTML = html;
  }

  function poll() {
    var base = window.API_URL || window.location.origin;
    var token = '';
    try { token = JSON.parse(localStorage.getItem('spawnkit-config') || '{}').token || ''; } catch(e) {}
    if (!token) { token = localStorage.getItem('spawnkit-token') || ''; }

    var headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(base.replace(/\/+$/, '') + '/api/oc/memory', { headers: headers })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.todo) return;
        // Quick hash to avoid unnecessary re-renders
        var hash = data.todo.substring(0, 200);
        if (hash === lastHash) return;
        lastHash = hash;
        var tasks = parseTodo(data.todo);
        render(tasks);
      })
      .catch(function() {});
  }

  // Start polling when DOM ready
  function init() {
    container = document.getElementById('medieval-tasks');
    if (!container) return;
    poll();
    setInterval(poll, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 2000); // Wait for auth to be ready
  }
})();
