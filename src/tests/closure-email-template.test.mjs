import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closureEmailGreeting, closureEmailTemplate, paymentDateLabel, prepareClosureMessage } from '../src/lib/closure-email-template.js';

test('greeting follows Manaus morning, afternoon and evening boundaries regardless of host timezone', () => {
  assert.equal(closureEmailGreeting(new Date('2026-10-23T09:59:00Z')), 'Boa noite');
  assert.equal(closureEmailGreeting(new Date('2026-10-23T10:00:00Z')), 'Bom dia');
  assert.equal(closureEmailGreeting(new Date('2026-10-23T15:59:00Z')), 'Bom dia');
  assert.equal(closureEmailGreeting(new Date('2026-10-23T16:00:00Z')), 'Boa tarde');
  assert.equal(closureEmailGreeting(new Date('2026-10-23T21:59:00Z')), 'Boa tarde');
  assert.equal(closureEmailGreeting(new Date('2026-10-23T22:00:00Z')), 'Boa noite');
  assert.equal(closureEmailGreeting(new Date('2026-10-24T02:00:00Z')), 'Boa noite');
});

test('each message uses the selected closure driver, never a fixed name or current filter', () => {
  const now = new Date('2026-10-23T17:55:00Z');
  const elias = closureEmailTemplate({ driver: 'ELIAS ALVES DA MOTA' }, now);
  const maria = closureEmailTemplate({ driver: 'Maria', driverDetails: { fullName: 'MARIA ANTONIA RIBEIRO' } }, now);
  assert.equal(elias.subject, 'PROGRAMAÇÃO DE PAGAMENTO - ELIAS ALVES DA MOTA');
  assert.match(elias.body, /motorista ELIAS ALVES DA MOTA, programar pagamento para 24\/10\/2026\./);
  assert.ok(!elias.body.includes('MARIA'));
  assert.match(maria.subject, /MARIA ANTONIA RIBEIRO$/);
  assert.match(maria.body, /• Controle;\n• Ticket de Pesagem;\n• Dados Bancários\./);
  assert.ok(maria.body.startsWith('Boa tarde!'));
  assert.ok(maria.body.endsWith('Atenciosamente.'));
});

test('tomorrow is a calendar day in Manaus, including weekends, month/year and leap-year boundaries', () => {
  assert.equal(paymentDateLabel(new Date('2026-10-24T02:00:00Z')), '24/10/2026');
  assert.equal(paymentDateLabel(new Date('2026-10-24T04:01:00Z')), '25/10/2026');
  assert.equal(paymentDateLabel(new Date('2026-12-31T18:00:00Z')), '01/01/2027');
  assert.equal(paymentDateLabel(new Date('2028-02-28T18:00:00Z')), '29/02/2028');
});

test('preparing a draft preserves the edited greeting and payment date, with the consultation link', () => {
  const body = closureEmailTemplate({ driver: 'ELIAS' }, new Date('2026-10-23T18:00:00Z')).body
    .replace('Boa tarde!', 'Olá, equipe!')
    .replace('24/10/2026', '27/10/2026');
  const url = 'https://dde-fretes.vercel.app/?painel=' + 'a'.repeat(64);
  const result = prepareClosureMessage(body, url);
  assert.equal(result.body, body);
  assert.equal(result.paymentDate, '27/10/2026');
  assert.equal(result.consultationUrl, url);
  assert.throws(() => prepareClosureMessage(body, 'javascript:alert(1)'));
  const missing = prepareClosureMessage(body, '');
  assert.equal(missing.body, body.replace('Para mais detalhes, acesse: Consultar fretes.\n\n', ''));
  assert.equal(missing.paymentDate, '27/10/2026');
});

test('a custom message keeps its own wording and spacing without adding a default date', () => {
  const body = 'Bom dia!\n\n\nPor favor, agendar para segunda-feira.\n\nAtenciosamente.';
  assert.deepEqual(prepareClosureMessage(body, ''), { body, consultationUrl: '', paymentDate: '' });
});
