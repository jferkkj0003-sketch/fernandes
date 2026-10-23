import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outlookScript, buildOutlookPackage } from '../src/lib/outlook-package.js';
import { normalizeRecipients } from '../src/lib/email-recipients.js';

test('Outlook recipients copied with quotes are normalized without duplicates', () => {
  assert.deepEqual(normalizeRecipients("'rh@example.com'; 'rh1@example.com'", 'RH@example.com; copy@example.com'), {
    to: ['rh@example.com', 'rh1@example.com'], cc: ['copy@example.com'],
  });
  assert.throws(() => normalizeRecipients('not-an-email', ''));
});

test('Outlook script escapes executable-looking user text and handles long multiline messages', () => {
  const message = '" : WScript.Quit : "' + 'ç'.repeat(2000) + '\n'.repeat(40);
  const script = outlookScript({ to: 'a@example.com', cc: '', subject: 'Frete "42"', body: message, filename: '042 - João.pdf' });
  assert.ok(script.includes('"" : WScript.Quit : ""'));
  assert.ok(script.includes('Frete ""42""'));
  assert.ok(script.split('\r\n').every((line) => line.length < 1024));
  assert.ok(!/mail\.Send\b/i.test(script));
  assert.ok(!script.includes('HTMLBody'));
  assert.ok(script.indexOf('mail.Display') < script.indexOf('entry.InsertBefore text'));
  assert.throws(() => outlookScript({ to: '', cc: '', subject: 'Frete', body: '', filename: 'x.pdf' }));
});

test('ZIP preserves exact PDF bytes and includes Unicode script and opening instructions', async () => {
  const pdf = new Uint8Array([37, 80, 68, 70, 0, 128, 255]);
  const archive = await buildOutlookPackage({ pdf: new Blob([pdf]), filename: '042 - João.pdf', to: 'a@example.com', cc: '', subject: 'Frete', body: 'Mensagem' });
  const bytes = new Uint8Array(await archive.arrayBuffer());
  const view = new DataView(bytes.buffer), files = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength;
    files.set(name, bytes.slice(start, start + size)); offset = start + size;
  }
  assert.deepEqual(files.get('042 - João.pdf'), pdf);
  assert.equal(files.size, 3);
  assert.ok(new TextDecoder('utf-16le').decode(files.get('Abrir_no_Outlook.vbs')).includes('João.pdf'));
  assert.ok(files.has('COMO_ABRIR.txt'));
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
});
