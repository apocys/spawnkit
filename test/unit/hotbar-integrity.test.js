'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOTBAR_FILE = path.join(__dirname, '../../server/office-medieval/medieval-hotbar.js');

describe('hotbar-integrity', () => {
  let content;

  test('medieval-hotbar.js file exists on disk', () => {
    assert.ok(fs.existsSync(HOTBAR_FILE), 'medieval-hotbar.js must exist');
    content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.length > 0, 'file is not empty');
  });

  test('contains _hotbarInited guard', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes('_hotbarInited'), 'has _hotbarInited guard');
  });

  test('sets _hotbarInited to true', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes('_hotbarInited = true'), 'sets guard to true');
  });

  test('file is wrapped in IIFE (self-executing function)', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.trimStart().startsWith('(function'), 'starts with IIFE');
  });

  test('has exactly 8 hotbar items (consolidated: keys 1-8)', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    const keyMatches = content.match(/\{ key: '[0-9]'/g);
    assert.ok(keyMatches, 'has key entries');
    assert.equal(keyMatches.length, 8, `expected 8 items, got ${keyMatches.length}`);
  });

  test('has keys 1-8', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    for (var i = 1; i <= 8; i++) {
      assert.ok(content.includes("key: '" + i + "'"), 'has key ' + i);
    }
  });

  test('no duplicate keys', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    const keys = [];
    const pattern = /key: '([0-9])'/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      keys.push(match[1]);
    }
    const uniqueKeys = new Set(keys);
    assert.equal(keys.length, uniqueKeys.size, `duplicate keys found: ${keys}`);
  });

  test('each item has icon, label, action properties', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    const iconMatches = content.match(/icon: '/g);
    const labelMatches = content.match(/label: '/g);
    const actionMatches = content.match(/action: function/g);
    assert.ok(iconMatches && iconMatches.length >= 8, `expected >=8 icon entries, got ${iconMatches ? iconMatches.length : 0}`);
    assert.ok(labelMatches && labelMatches.length >= 8, `expected >=8 label entries, got ${labelMatches ? labelMatches.length : 0}`);
    assert.ok(actionMatches && actionMatches.length >= 8, `expected >=8 action entries, got ${actionMatches ? actionMatches.length : 0}`);
  });

  test('core items present: Missions, Chat, Skills, Map, Arena, Summon, Allies, More', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    ['Missions', 'Chat', 'Skills', 'Map', 'Arena', 'Summon', 'Allies', 'More'].forEach(function(label) {
      assert.ok(content.includes("label: '" + label + "'"), 'has ' + label);
    });
  });

  test('More menu has secondary items (Settings, Edit Mode, Audio, Themes)', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("'Settings'"), 'More menu has Settings');
    assert.ok(content.includes("'Edit Mode'"), 'More menu has Edit Mode');
    assert.ok(content.includes("'Audio'"), 'More menu has Audio');
    assert.ok(content.includes("'Themes'"), 'More menu has Themes');
  });

  test('hotbar items array is defined', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes('var items = ['), 'items array is defined');
  });

  test('hotbar.innerHTML cleared to prevent duplicates', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("hotbar.innerHTML = ''"), 'clears innerHTML before building');
  });
});
