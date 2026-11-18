import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchingPreviews, linkStillValid, ticketDraftSummary } from '../src/lib/ticket-preview.js';

const previews = [
  { id: 'p1', driver_id: 'd1', loading_date: '2026-11-18', payment_date: '2026-11-20', amount: 1000 },
  { id: 'p2', driver_id: 'd1', loading_date: '2026-11-19', payment_date: '2026-11-20', amount: 1000 },
  { id: 'p3', driver_id: 'd2', loading_date: '2026-11-18', payment_date: '2026-11-20', amount: 900, ticket_id: 't1' },
  { id: 'p4', driver_id: 'd2', loading_date: '2026-11-18', payment_date: '2026-11-20', amount: 900, cancelled_at: '2026-11-18T10:00:00Z' },
];

test('só sugere prévias pendentes do mesmo motorista e data', () => {
  assert.deepEqual(matchingPreviews(previews, 'd1', '2026-11-18').map((p) => p.id), ['p1']);
  assert.deepEqual(matchingPreviews(previews, 'd2', '2026-11-18'), []);
  assert.deepEqual(matchingPreviews(previews, '', '2026-11-18'), []);
  assert.deepEqual(matchingPreviews(null, 'd1', '2026-11-18'), []);
});

test('o vínculo cai quando motorista ou data mudam', () => {
  assert.equal(linkStillValid(previews[0], 'd1', '2026-11-18'), true);
  assert.equal(linkStillValid(previews[0], 'd1', '2026-11-19'), false);
  assert.equal(linkStillValid(previews[0], 'd2', '2026-11-18'), false);
  assert.equal(linkStillValid(null, 'd1', '2026-11-18'), false);
});

test('resumo calcula líquido e diferença contra a prévia sem erro de ponto flutuante', () => {
  const s = ticketDraftSummary({ weight: '32000', gross: '1000.10', discount: '0.20' }, previews[0]);
  assert.equal(s.net, 999.9);
  assert.equal(s.difference, -0.1);
  assert.equal(s.estimated, 1000);
  assert.equal(s.paymentDate, '2026-11-20');
  assert.equal(s.valid, true);
});

test('sem prévia não há diferença e desconto maior que o bruto é recusado', () => {
  const s = ticketDraftSummary({ weight: 10, gross: 100, discount: 150 });
  assert.equal(s.difference, null);
  assert.equal(s.valid, false);
  assert.equal(s.net, -50);
});
