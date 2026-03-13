#!/usr/bin/env node
/**
 * lint.js — Validate JS syntax + JSON integrity across the codebase.
 * Exit code 1 if any file fails.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP = ['.git', 'node_modules', 'dist', 'electron', '_archive', '.next', 'auth'];

let failed = 0;
let checked = 0;

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (SKIP.includes(e)) continue;
    const full = path.join(dir, e);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; } // skip broken symlinks
    if (stat.isDirectory()) { walk(full); continue; }
    if (e.endsWith('.js')) {
      checked++;
      try {
        execSync(`node --check "${full}"`, { stdio: 'pipe' });
      } catch (err) {
        console.error(`  ❌ ${path.relative(ROOT, full)}`);
        console.error('     ' + (err.stderr?.toString().trim().split('\n')[0] || 'syntax error'));
        failed++;
      }
    }
    if (e.endsWith('.json') && !full.includes('node_modules')) {
      checked++;
      try {
        JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch (err) {
        console.error(`  ❌ ${path.relative(ROOT, full)} — invalid JSON`);
        failed++;
      }
    }
  }
}

console.log('🔍 Linting JS syntax + JSON validity...');
walk(ROOT);
console.log(`\n${checked} files checked, ${failed} errors.`);
if (failed > 0) {
  console.error('❌ Lint failed.');
  process.exit(1);
} else {
  console.log('✅ All files passed.');
}
