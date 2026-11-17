import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDriverPayments } from '../src/lib/driver-payments.js';

const drivers = [{ key: 'd1', name: 'Ana', active: true }, { key: 'd2', name: 'Bia', active: true }, { key: 'd3', name: 'Inativo', active: false }];
const ticket = (id, driverId, dateISO, gross, status = 'Aberto', extra = {}) => ({ id, driverId, driver: driverId === 'd1' ? 'Ana' : 'Bia', dateISO, gross, discount: 0, weight: 100, status, ...extra });

test('soma tickets por situação e prévias por motorista', () => {
  const { drivers: rows, totals } = summarizeDriverPayments({
    drivers,
    tickets: [ticket('a', 'd1', '2026-11-10', 1000), ticket('b', 'd1', '2026-11-11', 500, 'No fechamento'), ticket('c', 'd2', '2026-11-12', 300, 'Fechado', { requestStatus: 'Solicitado' })],
    previews: [{ driver_id: 'd1', loading_date: '2026-11-12', amount: 250, driver: { name: 'Ana' } }],
  });
  const ana = rows.find((r) => r.key === 'd1');
  assert.equal(ana.open, 1000); assert.equal(ana.waiting, 500); assert.equal(ana.preview, 250); assert.equal(ana.payable, 1750); assert.equal(ana.trips, 3);
  assert.equal(rows.find((r) => r.key === 'd2').requested, 300);
  assert.equal(totals.payable, 2050); assert.equal(totals.previewCount, 1); assert.equal(totals.weight, 300);
  assert.ok(!rows.some((r) => r.key === 'd3'));
});

test('respeita período, filtro de motorista e tickets já pagos', () => {
  const { drivers: rows, totals } = summarizeDriverPayments({
    drivers, driverFilter: 'd1', start: '2026-11-10', end: '2026-11-12', paidTicketIds: new Set(['p']),
    tickets: [ticket('a', 'd1', '2026-11-09', 999), ticket('p', 'd1', '2026-11-10', 400), ticket('b', 'd1', '2026-11-12', 100), ticket('x', 'd2', '2026-11-11', 700)],
    previews: [{ driver_id: 'd1', loading_date: '2026-11-13', amount: 50 }],
  });
  assert.equal(rows.length, 1); assert.equal(rows[0].paid, 400); assert.equal(totals.payable, 100); assert.equal(totals.tickets, 2);
});
