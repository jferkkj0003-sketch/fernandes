import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharedPaymentSummary } from '../src/lib/shared-payments.js';
const open = [{ date: '2026-10-22', driver: 'A', count: 3, weight: 60, open_count: 1, open_weight: 10, open_amount: 100 }];
const closure = { number: '1', driver: 'A', email_status: 'Solicitado', payment_status: 'pending', ticket_count: 2, total: 500, days: [{ date: '2026-10-21', count: 1, weight: 20, amount: 200 }, { date: '2026-10-22', count: 1, weight: 30, amount: 300 }] };
test('requested closures stay in pending and are counted once, apart from open tickets', () => {
  const summary = sharedPaymentSummary({ drivers_by_day: open, closure_payments: [closure] });
  assert.equal(summary.totalPending, 600);
  assert.equal(summary.closed.requested, 500);
  assert.equal(summary.totalCount, 3);
  assert.equal(summary.totalWeight, 60);
});
test('driver and original ticket-date filters affect totals, ranking and closure details consistently', () => {
  const data = { drivers_by_day: open, closure_payments: [closure] };
  const summary = sharedPaymentSummary(data, { start: '2026-10-22', end: '2026-10-22' }, 'A');
  assert.equal(summary.totalPending, 400);
  assert.equal(summary.ranked[0].amount, 400);
  assert.equal(summary.closures[0].filteredTotal, 300);
  assert.equal(summary.closures[0].filteredPartial, true);
  assert.equal(sharedPaymentSummary(data, {}, 'B').totalPending, 0);
});
test('confirmed paid closures and legacy unknown values remain visible but are not counted as confirmed pending', () => {
  const summary = sharedPaymentSummary({ drivers_by_day: open, closure_payments: [{ ...closure, payment_status: 'paid', paid_on: '2026-10-22' }, { ...closure, number: '2', payment_status: 'unverified' }] });
  assert.equal(summary.totalPending, 100);
  assert.equal(summary.closed.paid, 500);
  assert.equal(summary.closed.unverified, 500);
  assert.equal(summary.closures.length, 2);
});
