import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overviewSeries, stepGeometry } from '../src/lib/overview-charts.js';
import { operationalSummary } from '../src/lib/shared-payments.js';
const rows = [
  {date:'2026-10-22',driver:'A',weight:30,amount:300,count:1},
  {date:'2026-10-05',driver:'A',weight:10,amount:100,count:1},
  {date:'2026-10-22',driver:'B',weight:20,amount:200,count:1}
];
test('overview step charts aggregate days chronologically and reconcile with overview totals',()=>{
  const series=overviewSeries(rows);
  assert.equal(series.length,2);
  assert.deepEqual(series.map(row=>row.date),['2026-10-05','2026-10-22']);
  const summary=operationalSummary({drivers_by_day:rows},{},'','all');
  assert.equal(series.at(-1).cumulativeWeight,summary.weight);
  assert.equal(series.at(-1).cumulativeAmount,summary.amount);
});
test('both chart measures follow driver and date filters, including empty results',()=>{
  const series=overviewSeries(rows,{start:'2026-10-22',end:'2026-10-22'},'A');
  assert.equal(series.length,1);
  assert.equal(series[0].cumulativeWeight,30);
  assert.equal(series[0].cumulativeAmount,300);
  assert.deepEqual(overviewSeries(rows,{},'C'),[]);
  assert.deepEqual(overviewSeries(rows,{start:'2026-11-01'}),[]);
});
test('step paths use actual date spacing, horizontal/vertical steps and finite coordinates',()=>{
  const series=overviewSeries([...rows,{date:'2026-10-06',driver:'A',weight:5,amount:0}]);
  const geometry=stepGeometry(series,'cumulativeAmount');
  assert.equal(geometry.points[0].x,65);
  assert.equal(geometry.points.at(-1).x,590);
  assert.ok(geometry.points[1].x<150);
  assert.match(geometry.path,/H .* V/);
  assert.ok(!/NaN|Infinity/.test(geometry.path));
  for(const values of [[],[{date:'2026-10-22',cumulativeAmount:0}],[{date:'2026-10-22',cumulativeAmount:-100}]]) {
    assert.ok(!/NaN|Infinity/.test(stepGeometry(values,'cumulativeAmount').path));
  }
});
