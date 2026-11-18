import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationPeriodSummary } from '../src/lib/consultation-period.js';

const day = (driver, date, count, weight, amount, open_count = 0, open_amount = 0) => ({ driver, date, count, weight, amount, open_count, open_amount, open_weight: open_count ? weight : 0 });
const data = {
  drivers_by_day: [day('Ana', '2026-11-01', 1, 100, 100), day('Ana', '2026-11-18', 2, 300, 250, 1, 50), day('Beto', '2026-11-18', 1, 200, 80)],
  closure_payments: [
    { driver: 'Ana', payment_status: 'paid', paid_on: '2026-11-20', ticket_count: 2, days: [{ date: '2026-11-01', count: 1, weight: 100, amount: 100 }, { date: '2026-11-18', count: 1, weight: 200, amount: 200 }] },
    { driver: 'Beto', payment_status: 'pending', email_status: 'Solicitado', sent_at: '2026-10-23T12:00:00Z', ticket_count: 1, days: [{ date: '2026-11-18', count: 1, weight: 200, amount: 80 }] },
  ],
  freight_previews: [{ driver: 'Ana', loading_date: '2026-11-18', amount: 999 }],
};
test('período completo inclui abertos e fechados sem duplicar tickets ou somar prévias', () => {
  const value = consultationPeriodSummary(data);
  assert.equal(value.ticketCount, 4);
  assert.equal(value.weight, 600);
  assert.equal(value.amount, 430);
  assert.equal(value.paid, 300);
});
test('datas inclusivas recortam o pagamento de fechamentos que atravessam o intervalo', () => {
  const value = consultationPeriodSummary(data, { start: '2026-11-18', end: '2026-11-18' });
  assert.equal(value.ticketCount, 3);
  assert.equal(value.weight, 500);
  assert.equal(value.amount, 330);
  assert.equal(value.paid, 200);
});
test('motorista filtra totais e valores pagos juntos', () => {
  const value = consultationPeriodSummary(data, {}, 'Ana');
  assert.equal(value.ticketCount, 3);
  assert.equal(value.amount, 350);
  assert.equal(value.paid, 300);
  assert.deepEqual(value.ranked.map(row => [row.driver, row.paid]), [['Ana', 300]]);
});
test('ciclo encerrado e pagamento sem confirmação não entram em já pago', () => {
  const source = { ...data, closure_payments: [...data.closure_payments, { driver: 'Ana', payment_status: 'paid', paid_on: null, days: [{ date: '2026-11-18', count: 1, weight: 100, amount: 500 }] }] };
  assert.equal(consultationPeriodSummary(source).paid, 300);
  assert.equal(consultationPeriodSummary(data, {}, 'Beto').paid, 0);
});
test('intervalo inválido, sem resultados e sem dados retornam zero', () => {
  for (const value of [consultationPeriodSummary(data, { start: '2026-11-19', end: '2026-11-18' }), consultationPeriodSummary(data, { start: '2027-01-01' }), consultationPeriodSummary(null)]) {
    assert.equal(value.ticketCount, 0); assert.equal(value.amount, 0); assert.equal(value.paid, 0);
  }
});
