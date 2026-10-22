import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestArchiveAt, isCurrentRequest, requestedSummary } from '../src/lib/request-cycle.js';
import { sharedPaymentSummary, operationalSummary } from '../src/lib/shared-payments.js';

test('Thursday email leaves requests exactly Friday 17:00 Manaus, independent of viewer timezone', () => {
  const closure={email_status:'Solicitado',period_end:'2026-10-22',sent_at:'2026-10-22T18:00:00-04:00'};
  assert.equal(requestArchiveAt(closure.sent_at),'2026-10-23T21:00:00.000Z');
  assert.equal(isCurrentRequest(closure,'2026-10-23T20:59:59.999Z'),true);
  assert.equal(isCurrentRequest(closure,'2026-10-23T21:00:00.000Z'),false);
  assert.equal(isCurrentRequest(closure,'2026-10-30T20:00:00Z'),false);
});
test('Friday requests before cutoff close today; at or after cutoff enter next weekly cycle', () => {
  assert.equal(requestArchiveAt('2026-10-23T16:59:59-04:00'),'2026-10-23T21:00:00.000Z');
  assert.equal(requestArchiveAt('2026-10-23T17:00:00-04:00'),'2026-10-30T21:00:00.000Z');
  assert.equal(requestArchiveAt('2026-10-23T18:00:00-04:00'),'2026-10-30T21:00:00.000Z');
  assert.equal(requestArchiveAt('2026-10-24T01:00:00Z'),'2026-10-30T21:00:00.000Z');
});
test('cycles cross weekends, month and year boundaries', () => {
  assert.equal(requestArchiveAt('2026-10-31T12:00:00-04:00'),'2026-11-06T21:00:00.000Z');
  assert.equal(requestArchiveAt('2026-12-31T12:00:00-04:00'),'2027-01-01T21:00:00.000Z');
});
test('only emailed closures enter requested; missing historical send times stay visible', () => {
  assert.equal(isCurrentRequest({email_status:'Aguardando envio',sent_at:'2026-10-22T12:00:00Z'}),false);
  assert.equal(requestArchiveAt(null),null);
  assert.equal(requestArchiveAt('invalid'),null);
  assert.equal(isCurrentRequest({email_status:'Solicitado',period_end:'2026-10-22',sent_at:null}),true);
});
test('Friday view rollover preserves original email/payment data, overview and exact filtered ticket totals', () => {
  const data={drivers_by_day:[{date:'2026-10-22',driver:'A',count:4,weight:1000,amount:4000,open_count:0,open_weight:0,open_amount:0}],closure_payments:[
    {number:'1',driver:'A',email_status:'Solicitado',period_end:'2026-10-22',sent_at:'2026-10-22T18:00:00Z',payment_status:'pending',ticket_count:4,days:[{date:'2026-10-22',count:4,weight:1000,amount:4000}]},
    {number:'2',driver:'B',email_status:'Solicitado',period_end:'2026-10-22',sent_at:'2026-10-22T18:00:00Z',ticket_count:1,days:[{date:'2026-10-22',count:1,weight:100,amount:500}]}
  ]};
  const snapshot=JSON.stringify(data);
  const filtered=sharedPaymentSummary(data,{start:'2026-10-22',end:'2026-10-22'},'A');
  assert.equal(requestedSummary(filtered.closures,'2026-10-23T20:59:59Z').ticketCount,4);
  const archived=requestedSummary(filtered.closures,'2026-10-23T21:00:00Z');
  assert.deepEqual([archived.ticketCount,archived.weight,archived.amount],[0,0,0]);
  assert.equal(operationalSummary(data,{},'A','all').ticketCount,4);
  assert.equal(filtered.closures.length,1);
  assert.equal(filtered.closures[0].payment_status,'pending');
  assert.equal(JSON.stringify(data),snapshot);
  assert.equal(requestedSummary(sharedPaymentSummary(data,{start:'2026-10-23'}).closures,'2026-10-23T20:00:00Z').ticketCount,0);
});

test('legacy closures marked emailed today stay only in overview; today closures leave Friday at 17h', () => {
  const closures = [
    ...['2026-10-05','2026-10-19'].map((period_end, i) => ({number:String(i),email_status:'Solicitado',period_end,sent_at:'2026-10-22T18:00:00Z',filteredCount:5,filteredWeight:20000,filteredTotal:5000})),
    {number:'38',email_status:'Solicitado',period_end:'2026-10-22',sent_at:'2026-10-22T18:00:00Z',filteredCount:2,filteredWeight:14760,filteredTotal:2000},
    {number:'39',email_status:'Solicitado',period_end:'2026-10-22',sent_at:'2026-10-22T18:00:00Z',filteredCount:1,filteredWeight:3560,filteredTotal:1000},
    {number:'41',email_status:'Solicitado',period_end:'2026-10-22',sent_at:'2026-10-22T19:00:00Z',filteredCount:1,filteredWeight:3270,filteredTotal:1000}
  ];
  const snapshot=JSON.stringify(closures);
  const today=requestedSummary(closures,'2026-10-22T19:08:00Z');
  assert.deepEqual(today.closures.map(item=>item.number),['38','39','41']);
  assert.deepEqual([today.ticketCount,today.weight,today.amount],[4,21590,4000]);
  assert.equal(requestedSummary(closures,'2026-10-23T20:59:59Z').ticketCount,4);
  assert.equal(requestedSummary(closures,'2026-10-23T21:00:00Z').ticketCount,0);
  assert.equal(JSON.stringify(closures),snapshot);
  assert.equal(isCurrentRequest({email_status:'Solicitado',sent_at:'2026-10-22T18:00:00Z'},'2026-10-22T19:00:00Z'),false);
});
