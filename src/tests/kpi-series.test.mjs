import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeries, pickUnit } from '../src/lib/kpi-series.js';

test('agrupa por dia quando o intervalo tem até 14 dias e preenche dias vazios', () => {
  const series = buildSeries([
    { date: '2026-10-10', amount: 100 }, { date: '2026-10-10', amount: 50 }, { date: '2026-10-13', amount: 20 },
  ], (r) => r.amount);
  assert.equal(series.unit, 'day');
  assert.deepEqual(series.points.map((p) => p.value), [150, 0, 0, 20]);
  assert.equal(series.points[0].label, '10/10');
  assert.equal(series.total, 170);
});

test('agrupa por mês em intervalos longos e limita a quantidade de períodos', () => {
  const records = Array.from({ length: 12 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-05`, n: 1 }));
  const series = buildSeries(records, (r) => r.n, { max: 6 });
  assert.equal(series.unit, 'month');
  assert.equal(series.points.length, 6);
  assert.deepEqual(series.points.map((p) => p.label), ['jul', 'ago', 'set', 'out', 'nov', 'dez']);
});

test('agrupa por semana (segunda-feira) em intervalos médios', () => {
  assert.equal(pickUnit('2026-10-01', '2026-11-15'), 'week');
  const series = buildSeries([{ date: '2026-10-14', n: 1 }, { date: '2026-10-30', n: 2 }], (r) => r.n);
  assert.equal(series.unit, 'week');
  assert.equal(series.points[0].key, '2026-10-12');
  assert.equal(series.total, 3);
});

test('sem registros devolve série vazia e ignora valores zerados', () => {
  assert.deepEqual(buildSeries([], () => 1), { unit: 'month', points: [], total: 0 });
  assert.equal(buildSeries([{ date: '2026-10-10', n: 0 }], (r) => r.n).points.length, 0);
});
