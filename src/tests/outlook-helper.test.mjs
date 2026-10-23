import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesToBase64, createHelperSession, helperLaunch } from '../src/lib/outlook-helper.js';

const token = 'a'.repeat(64), port = 54321;
test('helper launches with a fresh session URL and waits until the correct helper responds', async () => {
  let launched, calls = 0, time = 0;
  const session = createHelperSession({ token, port, launch: (url) => { launched = url; }, now: () => time,
    pause: async (ms) => { time += ms; }, request: async (_url, options) => {
      assert.equal(options.headers['X-DDE-Token'], token);
      assert.equal(options.targetAddressSpace, 'loopback');
      if (++calls === 1) throw new Error('not started yet');
      return Response.json({ app: 'dde-outlook', version: 1 });
    } });
  await session.ready();
  assert.equal(launched, `dde-fretes-outlook://compose?token=${token}&port=${port}`);
  assert.equal(calls, 2);
  assert.throws(() => helperLaunch('bad', port));
  assert.throws(() => helperLaunch(token, 80));
});

test('PDF encoding preserves bytes across chunk boundaries', () => {
  const bytes = Uint8Array.from({ length: 80003 }, (_, index) => index % 256);
  assert.deepEqual(new Uint8Array(Buffer.from(bytesToBase64(bytes), 'base64')), bytes);
});

test('helper receives normalized recipients and exact PDF; repeat submission is rejected', async () => {
  let calls = 0;
  const pdf = new Blob(['%PDF-1.4\nUnicode não altera os bytes']);
  const session = createHelperSession({ token, port, launch: () => {}, request: async (url, options) => {
    calls++;
    assert.equal(url, 'http://127.0.0.1:54321/compose');
    const body = JSON.parse(options.body);
    assert.equal(body.to, 'rh@example.com'); assert.equal(body.cc, 'copy@example.com');
    assert.equal(body.id, token);
    assert.deepEqual(new Uint8Array(Buffer.from(body.pdf, 'base64')), new Uint8Array(await pdf.arrayBuffer()));
    return Response.json({ opened: true });
  } });
  const job = { pdf, filename: '001.pdf', to: "'rh@example.com'", cc: 'RH@example.com; copy@example.com', subject: 'Frete', body: 'Teste' };
  assert.match(await session.compose(job), /Mensagem aberta/);
  await assert.rejects(session.compose(job), /já foi usada/);
  assert.equal(calls, 1);
});

test('a failed connection or Outlook error never reports opened or retries the compose POST', async () => {
  let time = 0;
  const session = createHelperSession({ token, port, launch: () => {}, now: () => time,
    pause: async (ms) => { time += ms; }, request: async () => { throw new Error('offline'); } });
  await assert.rejects(session.ready(), /Instale-o uma vez/);
  let calls = 0;
  const broken = createHelperSession({ token, port, launch: () => {}, request: async () => { calls++; throw new Error('lost response'); } });
  const job = { pdf: new Blob(['%PDF-']), filename: '001.pdf', to: 'a@example.com', cc: '', subject: 'Frete', body: 'Teste' };
  await assert.rejects(broken.compose(job), (error) => error.outlookMayHaveOpened === true && /Confira o Outlook/.test(error.message));
  await assert.rejects(broken.compose(job), /já foi usada/);
  assert.equal(calls, 1);
  const rejected = createHelperSession({ token, port, launch: () => {}, request: async () => Response.json({ error: 'Outlook indisponível' }, { status: 500 }) });
  await assert.rejects(rejected.compose(job), /Outlook indisponível/);
});
