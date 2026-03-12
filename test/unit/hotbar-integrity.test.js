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

  test('has exactly 10 hotbar items (keys 1-9 and 0)', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    const keyMatches = content.match(/\{ key: '[0-9]'/g);
    assert.ok(keyMatches, 'has key entries');
    assert.equal(keyMatches.length, 10, `expected 10 items, got ${keyMatches.length}`);
  });

  test('has key 1', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("key: '1'"), 'has key 1');
  });

  test('has key 2', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("key: '2'"), 'has key 2');
  });

  test('has key 3', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("key: '3'"), 'has key 3');
  });

  test('has key 9', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("key: '9'"), 'has key 9');
  });

  test('has key 0', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("key: '0'"), 'has key 0');
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

  test('each item has icon property (at least 10)', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    // Count icon: appearances — should be at least 10
    const iconMatches = content.match(/icon: '/g);
    assert.ok(iconMatches, 'has icon entries');
    assert.ok(iconMatches.length >= 10, `expected at least 10 icon entries, got ${iconMatches.length}`);
  });

  test('each item has label property (at least 10)', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    const labelMatches = content.match(/label: '/g);
    assert.ok(labelMatches, 'has label entries');
    assert.ok(labelMatches.length >= 10, `expected at least 10 label entries, got ${labelMatches.length}`);
  });

  test('each item has action property', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    const actionMatches = content.match(/action: function/g);
    assert.ok(actionMatches, 'has action entries');
    assert.equal(actionMatches.length, 10, `expected 10 action entries, got ${actionMatches.length}`);
  });

  test('item 1 label is Missions', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("label: 'Missions'"), 'item 1 label is Missions');
  });

  test('item 2 label is Chat', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes("label: 'Chat'"), 'item 2 label is Chat');
  });

  test('hotbar items array is defined', () => {
    if (!content) content = fs.readFileSync(HOTBAR_FILE, 'utf8');
    assert.ok(content.includes('const items = ['), 'items array is defined');
  });
});
