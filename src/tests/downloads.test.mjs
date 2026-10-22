import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDownloadPreferences } from '../src/lib/downloads.js';

function settings(directory = null, options = {}) {
  return createDownloadPreferences({ load: async () => directory, store: async () => {}, remove: async () => {}, pick: async () => directory, browserSave: () => {}, ...options });
}
const missing = () => Object.assign(new Error('Not found'), { name: 'NotFoundError' });

test('uses the browser download when no app directory is selected', async () => {
  let filename;
  const prefs = settings(null, { browserSave: (_, name) => { filename = name; } });
  const target = await prefs.prepare();
  assert.equal(target, null);
  assert.equal((await prefs.save(new Blob(['PDF']), 'relatorio.pdf', target)).mode, 'browser');
  assert.equal(filename, 'relatorio.pdf');
});

test('a cancelled picker or a failed preference write keeps the previous folder', async () => {
  const old = { name: 'Anterior' };
  const cancelled = settings(old, { pick: async () => { throw Object.assign(new Error(), { name: 'AbortError' }); } });
  await assert.rejects(cancelled.chooseDirectory(), { name: 'AbortError' });
  assert.equal(await cancelled.getDirectory(), old);
  const failed = settings(old, { pick: async () => ({ name: 'Nova' }), store: async () => { throw new Error('quota'); } });
  await assert.rejects(failed.chooseDirectory(), /quota/);
  assert.equal(await failed.getDirectory(), old);
});

test('requests permission before generation and rejects denied access', async () => {
  let requested = 0;
  const folder = { queryPermission: async () => 'prompt', requestPermission: async () => { requested++; return 'denied'; } };
  await assert.rejects(settings(folder).prepare(), /Autorize a pasta/);
  assert.equal(requested, 1);
});

test('preserves existing PDFs and waits for the completed write before reporting success', async () => {
  const events = [];
  const folder = {
    name: 'Fretes',
    async getFileHandle(name, options) {
      if (!options?.create) { if (name === 'relatorio.pdf') return {}; throw missing(); }
      assert.equal(name, 'relatorio (2).pdf');
      return { createWritable: async () => ({ write: async () => events.push('write'), close: async () => events.push('closed') }) };
    },
  };
  const result = await settings(folder).save(new Blob(['PDF']), 'relatorio.pdf', folder);
  assert.deepEqual(events, ['write', 'closed']);
  assert.equal(result.filename, 'relatorio (2).pdf');
  assert.equal(result.folder, 'Fretes');
});

test('write failures are surfaced and do not silently download elsewhere', async () => {
  let fallback = false;
  let aborted = false;
  const folder = { getFileHandle: async (_, options) => {
    if (!options?.create) throw missing();
    return { createWritable: async () => ({ write: async () => { throw new Error('disk full'); }, abort: async () => { aborted = true; } }) };
  } };
  await assert.rejects(settings(folder, { browserSave: () => { fallback = true; } }).save(new Blob(), 'x.pdf', folder), /disk full/);
  assert.equal(aborted, true);
  assert.equal(fallback, false);
});

test('reset only clears the application preference', async () => {
  let removed = false;
  const prefs = settings({ name: 'Fretes' }, { remove: async () => { removed = true; } });
  await prefs.useBrowserDefault();
  assert.equal(removed, true);
  assert.equal(await prefs.getDirectory(), null);
});
