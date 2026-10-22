import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentToday, nextPaymentDate, paymentStatus, paymentTotals, emailStatus } from '../src/lib/payments.js';

test('email requested and an elapsed due date never imply paid', () => {
  const closure = { status: 'Solicitado', paymentStatus: 'pending', total: 100, paymentDueDate: '2026-10-22' };
  assert.equal(emailStatus(closure), 'Solicitado por e-mail');
  assert.equal(paymentStatus(closure, '2026-10-22'), 'Aguardando pagamento');
  assert.equal(paymentStatus(closure, '2026-10-23'), 'Pagamento em atraso');
  assert.deepEqual(paymentTotals([closure]), { pending: 100, paid: 0, requested: 100, unverified: 0 });
});
test('only payment confirmation removes the amount from pending', () => {
  const unpaid = { status: 'Solicitado', paymentStatus: 'pending', total: 100, paymentDueDate: '2026-10-22' };
  const paid = { ...unpaid, total: 200, paidOn: '2026-10-23', paidAt: '2026-10-23T12:00:00Z' };
  assert.equal(paymentStatus(paid, '2026-10-24'), 'Pago');
  assert.deepEqual(paymentTotals([unpaid, paid]), { pending: 100, paid: 200, requested: 100, unverified: 0 });
  assert.equal(paymentTotals([{ ...paid, paidAt: null }]).pending, 200);
});
test('legacy closures are identified for review instead of inventing a payment state', () => {
  assert.equal(paymentStatus({ status: 'Solicitado', total: 300 }), 'Pagamento não informado');
  assert.deepEqual(paymentTotals([{ status: 'Solicitado', total: 300 }]), { pending: 0, paid: 0, requested: 0, unverified: 300 });
});
test('Manaus dates and next-day suggestions handle UTC day changes and month boundaries', () => {
  assert.equal(paymentToday(new Date('2026-10-23T02:00:00Z')), '2026-10-22');
  assert.equal(nextPaymentDate('2026-10-31'), '2026-11-01');
  assert.equal(nextPaymentDate('2026-12-31'), '2027-01-01');
});
