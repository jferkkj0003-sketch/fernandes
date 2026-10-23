import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDashboardTickets } from '../src/lib/dashboard-summary.js';

test('dashboard distinguishes open, closed awaiting email, and requested tickets using net values', () => {
  const result = summarizeDashboardTickets([
    { status: 'Aberto', gross: 1000, discount: 100, weight: 500 },
    { status: 'No fechamento', requestStatus: 'Aguardando envio', gross: 2000, discount: 200, weight: 1000 },
    { status: 'No fechamento', gross: 300, discount: 0, weight: 100 },
    { status: 'No fechamento', requestStatus: 'Solicitado', gross: 1500, discount: 50, weight: 750 },
  ]);
  assert.deepEqual(result, {
    count: 4, weight: 2350, amount: 4450,
    open: { count: 1, amount: 900 },
    pending: { count: 2, amount: 2100 },
    sent: { count: 1, amount: 1450 },
  });
  assert.equal(result.open.count + result.pending.count + result.sent.count, result.count);
  assert.equal(result.open.amount + result.pending.amount + result.sent.amount, result.amount);
});

test('dashboard accepts only the supplied filtered tickets and handles no results', () => {
  const tickets = [
    { driverId: 'a', dateISO: '2026-10-01', status: 'Aberto', gross: 500 },
    { driverId: 'a', dateISO: '2026-10-20', status: 'No fechamento', requestStatus: 'Solicitado', gross: 800 },
    { driverId: 'b', dateISO: '2026-10-20', status: 'Aberto', gross: 900 },
  ];
  const result = summarizeDashboardTickets(tickets.filter((ticket) => ticket.driverId === 'a' && ticket.dateISO >= '2026-10-15'));
  assert.equal(result.count, 1);
  assert.equal(result.sent.amount, 800);
  assert.equal(result.open.count, 0);
  const empty = summarizeDashboardTickets([]);
  assert.equal(empty.amount, 0);
  assert.equal(empty.pending.count, 0);
  assert.equal(empty.sent.count, 0);
});
