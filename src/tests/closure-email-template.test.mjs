import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closureEmailTemplate, paymentDateLabel, prepareClosureMessage } from '../src/lib/closure-email-template.js';

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

test('preparing an email after midnight refreshes payment day, retaining the driver and actual consultation link', () => {
  const body = closureEmailTemplate({ driver: 'ELIAS' }, new Date('2026-10-23T18:00:00Z')).body;
  const url = 'https://dde-fretes.vercel.app/?painel=' + 'a'.repeat(64);
  const result = prepareClosureMessage(body, url, new Date('2026-10-24T05:00:00Z'));
  assert.match(result.body, /motorista ELIAS, programar pagamento para 25\/10\/2026/);
  assert.equal(result.paymentDate, '25/10/2026');
  assert.equal(result.consultationUrl, url);
  assert.match(result.body, /Consultar fretes\./);
  assert.throws(() => prepareClosureMessage(body, 'javascript:alert(1)'));
  const missing = prepareClosureMessage(body, '', new Date('2026-10-23T18:00:00Z'));
  assert.ok(!missing.body.includes('Consultar fretes'));
  assert.match(missing.body, /motorista ELIAS/);
});
