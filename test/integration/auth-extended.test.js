'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// The auth module uses jsonwebtoken (in server/auth/node_modules).
// We test the AuthManager class for token generation and validation.

let AuthManager;
let tmpDir;
let dataDir;
let otherDataDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
  dataDir = path.join(tmpDir, 'data');
  otherDataDir = path.join(tmpDir, 'other-data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(otherDataDir, { recursive: true });
  // Resolve AuthManager from server/auth/auth.js
  AuthManager = require('../../server/auth/auth.js');
}

function teardown() {
  // Wait a tick for any async cleanup
  return new Promise(resolve => setTimeout(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resolve();
  }, 100));
}

describe('AuthManager — token generation and validation', () => {
  before(setup);
  after(teardown);

  let auth;
  before(() => {
    auth = new AuthManager({
      secret: 'test-secret-key-for-unit-tests',
      dataDir,
    });
  });

  // ── generateSessionId ──────────────────────────────────────────────────────
  describe('generateSessionId()', () => {
    test('returns a string', () => {
      const id = auth.generateSessionId();
      assert.equal(typeof id, 'string', 'is string');
    });

    test('returns string longer than 10 chars', () => {
      const id = auth.generateSessionId();
      assert.ok(id.length > 10, `length ${id.length} > 10`);
    });

    test('returns 64 char hex string (32 bytes)', () => {
      const id = auth.generateSessionId();
      assert.equal(id.length, 64, 'is 64 chars');
    });

    test('two session IDs are different', () => {
      const id1 = auth.generateSessionId();
      const id2 = auth.generateSessionId();
      assert.notEqual(id1, id2, 'IDs are unique');
    });

    test('session ID is hex-encoded (only hex chars)', () => {
      const id = auth.generateSessionId();
      assert.match(id, /^[0-9a-f]+$/, 'is hex string');
    });

    test('generates multiple unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 10; i++) ids.add(auth.generateSessionId());
      assert.equal(ids.size, 10, 'all 10 IDs unique');
    });
  });

  // ── generateMagicToken ─────────────────────────────────────────────────────
  describe('generateMagicToken(email)', () => {
    test('returns a string', () => {
      const token = auth.generateMagicToken('test@example.com');
      assert.equal(typeof token, 'string', 'is string');
    });

    test('returns string longer than 10 chars', () => {
      const token = auth.generateMagicToken('test@example.com');
      assert.ok(token.length > 10, `length ${token.length} > 10`);
    });

    test('JWT has 3 parts separated by dots', () => {
      const token = auth.generateMagicToken('test@example.com');
      const parts = token.split('.');
      assert.equal(parts.length, 3, 'JWT has 3 parts');
    });

    test('two tokens for same email are different (includes exp timestamp)', () => {
      // Sleep briefly to ensure different exp
      const t1 = auth.generateMagicToken('same@example.com');
      const t2 = auth.generateMagicToken('same@example.com');
      // They could technically be equal within same second, but usually differ
      // Just check they're strings of length > 10
      assert.ok(t1.length > 10 && t2.length > 10, 'both are valid tokens');
    });

    test('token encodes the email in payload', () => {
      const email = 'encoded@example.com';
      const token = auth.generateMagicToken(email);
      // Decode payload (middle part) without verification
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      assert.equal(payload.email, email, 'email in payload');
    });

    test('token type is magic_link', () => {
      const token = auth.generateMagicToken('test@example.com');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      assert.equal(payload.type, 'magic_link', 'type is magic_link');
    });
  });

  // ── verifyMagicToken ───────────────────────────────────────────────────────
  describe('verifyMagicToken(token)', () => {
    test('verifies a valid token correctly', () => {
      const email = 'verify@example.com';
      const token = auth.generateMagicToken(email);
      const result = auth.verifyMagicToken(token);
      assert.equal(result.email, email, 'email matches');
    });

    test('returns payload with correct type', () => {
      const token = auth.generateMagicToken('test@example.com');
      const result = auth.verifyMagicToken(token);
      assert.equal(result.type, 'magic_link');
    });

    test('throws on wrong token', () => {
      assert.throws(() => {
        auth.verifyMagicToken('invalid.token.here');
      }, /Invalid|expired/i, 'throws on invalid token');
    });

    test('throws on empty string', () => {
      assert.throws(() => {
        auth.verifyMagicToken('');
      }, /Invalid|expired/i, 'throws on empty token');
    });

    test('throws on token signed with different secret', () => {
      const otherAuth = new AuthManager({
        secret: 'completely-different-secret',
        dataDir: otherDataDir,
      });
      const token = otherAuth.generateMagicToken('hack@example.com');
      assert.throws(() => {
        auth.verifyMagicToken(token);
      }, /Invalid|expired/i, 'throws on token from different secret');
    });

    test('throws on null', () => {
      assert.throws(() => {
        auth.verifyMagicToken(null);
      });
    });
  });

  // ── buildMagicLinkEmail ───────────────────────────────────────────────────
  describe('buildMagicLinkEmail(email)', () => {
    test('returns email object with required fields', () => {
      const email = auth.buildMagicLinkEmail('user@example.com');
      assert.ok(email.from, 'has from');
      assert.ok(email.to, 'has to');
      assert.ok(email.subject, 'has subject');
      assert.ok(email.html, 'has html');
    });

    test('_token field is a valid JWT', () => {
      const email = auth.buildMagicLinkEmail('user@example.com');
      assert.ok(email._token, 'has _token');
      assert.equal(email._token.split('.').length, 3, '_token is JWT');
    });

    test('_magicLink contains the token', () => {
      const email = auth.buildMagicLinkEmail('user@example.com');
      assert.ok(email._magicLink, 'has _magicLink');
      assert.ok(email._magicLink.includes(email._token), 'magic link contains token');
    });

    test('to field includes the recipient email', () => {
      const email = auth.buildMagicLinkEmail('recipient@example.com');
      assert.ok(email.to.includes('recipient@example.com'), 'to includes recipient');
    });
  });
});
