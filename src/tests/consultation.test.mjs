import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consultationSummary } from '../src/lib/consultation.js';
const closure=(number,driver,date,email_status,amount,weight)=>({number,driver,period_end:date,email_status,sent_at:'2026-10-22T18:00:00Z',ticket_count:1,days:[{date,count:1,weight,amount}]});
const data={drivers_by_day:[
  {date:'2026-10-22',driver:'A',count:3,weight:60,amount:600,open_count:1,open_weight:10,open_amount:100},
  {date:'2026-10-05',driver:'B',count:1,weight:40,amount:400,open_count:0,open_weight:0,open_amount:0}
],closure_payments:[closure('1','A','2026-10-22','Aguardando envio',200,20),closure('2','A','2026-10-22','Solicitado',300,30),closure('3','B','2026-10-05','Solicitado',400,40)]};
test('single consultation separates open, closed-awaiting-email and current requests without adding them twice to overall totals',()=>{
  const summary=consultationSummary(data,{},'','2026-10-22T19:00:00Z');
  assert.deepEqual([summary.open.amount,summary.open.weight],[100,10]);
  assert.deepEqual(summary.waiting,{amount:200,weight:20});
  assert.deepEqual([summary.requested.amount,summary.requested.weight],[300,30]);
  assert.deepEqual([summary.total.amount,summary.total.weight],[1000,100]);
});
test('Friday cutoff clears only current requests while overall charts and waiting/open values remain intact',()=>{
  const before=consultationSummary(data,{},'','2026-10-23T20:59:59Z');
  const after=consultationSummary(data,{},'','2026-10-23T21:00:00Z');
  assert.equal(before.requested.amount,300);
  assert.equal(after.requested.amount,0);
  for(const key of ['open','waiting','total']) assert.deepEqual(after[key],before[key]);
});
test('shared driver and original-date filters affect every consultation card, with exact open weights',()=>{
  const summary=consultationSummary(data,{start:'2026-10-22',end:'2026-10-22'},'A','2026-10-22T19:00:00Z');
  assert.deepEqual([summary.total.amount,summary.total.weight],[600,60]);
  const none=consultationSummary(data,{start:'2026-10-23'},'A','2026-10-22T19:00:00Z');
  for(const phase of ['open','waiting','requested','total']) assert.equal(none[phase].amount,0);
  const unknown=consultationSummary({drivers_by_day:[{date:'2026-10-22',driver:'A',count:3,weight:60,amount:600,open_count:1,open_amount:100}]});
  assert.equal(unknown.open.weight,null);
});
