import assert from 'node:assert/strict';
import { freightForecast } from '../src/lib/freight-forecast.js';

const data = { closure_payments: [
  { driver: 'Ana', email_status: 'Solicitado', payment_status: 'pending', payment_due_date: '2026-11-20', total: 1000 },
  { driver: 'Ana', email_status: 'Solicitado', payment_status: 'paid', payment_due_date: '2026-11-20', total: 500 },
], freight_previews: [
  { driver: 'Ana', payment_date: '2026-11-20', amount: 400, confirmed: false, included_in_request: false },
  { driver: 'Ana', payment_date: '2026-11-20', amount: 450, confirmed: true, included_in_request: false },
  { driver: 'Ana', payment_date: '2026-11-20', amount: 1000, confirmed: true, included_in_request: true },
  { driver: 'Bia', payment_date: '2026-11-20', amount: 200, confirmed: false, included_in_request: false },
] };
assert.deepEqual([freightForecast(data, '2026-11-20', 'Ana').confirmed, freightForecast(data, '2026-11-20', 'Ana').withoutTicket, freightForecast(data, '2026-11-20', 'Ana').withTicket, freightForecast(data, '2026-11-20', 'Ana').total], [1000, 400, 450, 1850]);
assert.equal(freightForecast(data, '2026-11-21').total, 0);
assert.equal(freightForecast(data, '2026-11-20').total, 2050);
