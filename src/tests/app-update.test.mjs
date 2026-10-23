import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOutdatedAssetError, appErrorMessage, readEmailRecovery, saveEmailRecovery, clearEmailRecovery } from '../src/lib/app-update.js';

test('old deployment module failures produce update guidance, not raw asset URLs', () => {
  const error = new TypeError('Failed to fetch dynamically imported module: https://dde-fretes.vercel.app/assets/index-BPC9a9cm.js');
  assert.equal(isOutdatedAssetError(error), true);
  assert.match(appErrorMessage(error, 'Erro'), /Atualize a página/);
  assert.ok(!appErrorMessage(error, 'Erro').includes('index-BPC9a9cm'));
  assert.equal(isOutdatedAssetError(new Error('Failed to fetch')), false);
  assert.equal(appErrorMessage(new Error('Outlook indisponível'), 'Erro'), 'Outlook indisponível');
  assert.equal(appErrorMessage(null, 'Tente novamente'), 'Tente novamente');
});

test('message recovery preserves edited fields, including blank CC, for the same user and closure only', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  const fields = { to: 'a@example.com', cc: '', subject: 'Assunto editado', body: 'Mensagem\ncom duas linhas' };
  saveEmailRecovery(storage, 'closure-42', 'user-1', fields, 10000);
  assert.deepEqual(readEmailRecovery(storage, 'closure-42', 'user-1', 11000), fields);
  assert.equal(readEmailRecovery(storage, 'closure-43', 'user-1', 11000), null);
  assert.equal(readEmailRecovery(storage, 'closure-42', 'user-2', 11000), null);
  assert.equal(readEmailRecovery(storage, 'closure-42', 'user-1', 3610001), null);
  clearEmailRecovery(storage, 'closure-42', 'user-1');
  assert.equal(readEmailRecovery(storage, 'closure-42', 'user-1', 11000), null);
});

test('broken or unavailable recovery storage cannot prevent opening the mail editor', () => {
  assert.equal(readEmailRecovery({ getItem: () => '{broken' }, '42', 'u'), null);
  assert.equal(readEmailRecovery({ getItem: () => { throw new Error('disabled'); } }, '42', 'u'), null);
  assert.throws(() => saveEmailRecovery({ setItem: () => { throw new Error('full'); } }, '42', 'u', {}));
});
