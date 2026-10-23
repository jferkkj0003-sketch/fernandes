import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasConfirmedOutlookHelper, rememberOutlookHelper, readOutlookAttempt, writeOutlookAttempt } from '../src/lib/outlook-preferences.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test('helper preference starts unknown and survives a fresh read only after confirmation', () => {
  const storage = memoryStorage();
  assert.equal(hasConfirmedOutlookHelper(storage), false);
  assert.equal(rememberOutlookHelper(storage, 12345), true);
  assert.equal(hasConfirmedOutlookHelper(storage), true);
  assert.equal(hasConfirmedOutlookHelper({ getItem: () => '{bad' }), false);
});

test('repeat history stays scoped to the closure and account across reopening and records uncertain outcomes', () => {
  const storage = memoryStorage();
  assert.equal(readOutlookAttempt(storage, '42', 'alice'), null);
  const attempt = { status: 'opened', at: 10000 };
  writeOutlookAttempt(storage, '42', 'alice', attempt);
  assert.deepEqual(readOutlookAttempt(storage, '42', 'alice'), attempt);
  assert.equal(readOutlookAttempt(storage, '43', 'alice'), null);
  assert.equal(readOutlookAttempt(storage, '42', 'bob'), null);
  writeOutlookAttempt(storage, '42', 'alice', { status: 'uncertain', at: 20000 });
  assert.equal(readOutlookAttempt(storage, '42', 'alice').status, 'uncertain');
  writeOutlookAttempt(storage, '42', 'alice', attempt);
  assert.deepEqual(readOutlookAttempt(storage, '42', 'alice'), attempt);
  writeOutlookAttempt(storage, '42', 'alice', null);
  assert.equal(readOutlookAttempt(storage, '42', 'alice'), null);
});

test('ZIP preparation never implies that the native helper is installed or opened', () => {
  const storage = memoryStorage();
  writeOutlookAttempt(storage, '42', 'alice', { status: 'packaged', at: 10000 });
  assert.equal(readOutlookAttempt(storage, '42', 'alice').status, 'packaged');
  assert.equal(hasConfirmedOutlookHelper(storage), false);
});

test('unavailable browser storage cannot break mail composition', () => {
  const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(hasConfirmedOutlookHelper(storage), false);
  assert.equal(rememberOutlookHelper(storage), false);
  assert.equal(readOutlookAttempt(storage, '42', 'alice'), null);
  assert.equal(writeOutlookAttempt(storage, '42', 'alice', { status: 'opened', at: 1 }), false);
});
