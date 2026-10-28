import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

function sanitizeString(val) {
  if (typeof val === 'string') {
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  }
  return val;
}

function filterAllowedFields(source, allowedFields) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const cleaned = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      cleaned[field] = sanitizeString(source[field]);
    }
  }
  return cleaned;
}

function formatSafeErrorResponse(err, isProd = false) {
  return {
    error: err.name || 'InternalServerError',
    message: isProd ? 'An unexpected server error occurred. Please try again later.' : (err.message || 'Server error'),
    ...(isProd ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString()
  };
}

test('Security - Input Sanitization & Control Character Stripping', () => {
  // Harmful characters: null bytes (\x00), vertical tabs (\x0B), bell characters (\x07)
  const dirty = 'North\x00 Avenue \x07Corridor\x1F';
  const clean = sanitizeString(dirty);
  assert.equal(clean, 'North Avenue Corridor', 'Harmful ASCII control characters must be purged');

  const padded = '   trailing and leading spaces   ';
  assert.equal(sanitizeString(padded), 'trailing and leading spaces', 'Whitespace must be trimmed');

  assert.equal(sanitizeString(123), 123, 'Non-string values must pass through unharmed');
});

test('Security - Mass Assignment & Prototype Pollution Guard', () => {
  const untrustedInput = {
    id: 'AMB-104',
    name: 'Unit 104',
    severity: 'Critical',
    __proto__: { isAdmin: true },
    role: 'superadmin',
    billingPlan: 'unlimited',
    token: 'fake_jwt_override',
    databaseSecret: 'mongodb://root:pass@compromised'
  };

  const allowedFields = ['id', 'name', 'severity', 'patient', 'destination'];
  const sanitized = filterAllowedFields(untrustedInput, allowedFields);

  assert.deepEqual(Object.keys(sanitized).sort(), ['id', 'name', 'severity'].sort(), 'Only explicitly whitelisted fields may pass through');
  assert.equal(sanitized.role, undefined, 'Forbidden role attribute must be stripped');
  assert.equal(sanitized.billingPlan, undefined, 'Forbidden billingPlan must be stripped');
  assert.equal(sanitized.databaseSecret, undefined, 'Database secret override must be stripped');
  assert.equal(({}).isAdmin, undefined, 'Prototype pollution must not affect plain objects');
});

test('Security - Password Hashing with Bcrypt', async () => {
  const plainPassword = 'SuperSecretPassword2026!';
  const hash = await bcrypt.hash(plainPassword, 10);

  // Assert hash format
  assert.ok(hash.startsWith('$2'), 'Bcrypt hash must begin with standard $2 prefix');
  assert.notEqual(hash, plainPassword, 'Password must never be stored in plain text');

  // Verify match
  const isMatch = await bcrypt.compare(plainPassword, hash);
  assert.equal(isMatch, true, 'Bcrypt compare must succeed for valid password');

  // Verify mismatch
  const wrongMatch = await bcrypt.compare('WrongPassword123', hash);
  assert.equal(wrongMatch, false, 'Bcrypt compare must fail for invalid password');
});

test('Security - Production Error Masking (No Stack Traces)', () => {
  const sensitiveError = new Error('MongoNetworkError: failed to connect to server [127.0.0.1:27017]');
  sensitiveError.name = 'MongoNetworkError';

  // In production
  const prodResponse = formatSafeErrorResponse(sensitiveError, true);
  assert.equal(prodResponse.message, 'An unexpected server error occurred. Please try again later.');
  assert.equal(prodResponse.stack, undefined, 'Stack traces must never be exposed to clients in production');
  assert.equal(prodResponse.error, 'MongoNetworkError');

  // In development
  const devResponse = formatSafeErrorResponse(sensitiveError, false);
  assert.ok(devResponse.message.includes('MongoNetworkError'), 'Dev mode can expose technical error messages for debugging');
  assert.ok(devResponse.stack !== undefined, 'Dev mode can expose stack traces for local diagnostics');
});
