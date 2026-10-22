import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchHistory} from '../src/lib/history-search.js';
const tickets=[{id:'a',number:'19197',dateISO:'2026-10-19',weight:7000,gross:1200,discount:200,plate:'NJS-0B09'},{id:'b',number:'19252',dateISO:'2026-10-20',weight:7760,gross:1000,discount:0}];
const closure={id:'c',number:'038',driverId:'bruno',driver:'FRANCISCO BRÚNO',start:'2026-10-17',end:'2026-10-22',status:'Solicitado',count:2,total:2000,ticketIds:['a','b'],ticketDetails:tickets};
test('history filters by original ticket dates and sums only the selected part of the closure',()=>{
  const found=searchHistory([closure],[],{driver:'bruno',start:'2026-10-20',end:'2026-10-20'});
  assert.deepEqual([found.count,found.weight,found.total],[1,7760,1000]);
  assert.equal(found.rows[0].partial,true);
  assert.equal(found.rows[0].closure,closure);
  assert.equal(found.rows[0].closure.total,2000);
  assert.equal(found.sent,1);
});
test('history searches ticket numbers, accented driver names, closure numbers and combined words',()=>{
  for(const query of ['19197','BRUNO 19197','bruno ticket 19197']) {
    const found=searchHistory([closure],[],{query});
    assert.deepEqual([found.count,found.weight,found.total],[1,7000,1000]);
  }
  for(const query of ['038','bruno','NJS-0B09']) assert.ok(searchHistory([closure],[],{query}).count>0);
  assert.equal(searchHistory([closure],[],{query:'ausente'}).rows.length,0);
  assert.equal(searchHistory([closure],[],{driver:'other'}).rows.length,0);
});
test('same-named drivers remain distinct by identity and waiting/sent summaries follow filters',()=>{
  const other={...closure,id:'d',number:'039',driverId:'other',status:'Aguardando envio'};
  const found=searchHistory([closure,other],[],{driver:'other'});
  assert.equal(found.rows.length,1);
  assert.equal(found.waiting,1);
  assert.equal(found.sent,0);
});
test('history handles invalid dates, absent snapshots and missing weights without inventing partial totals',()=>{
  assert.equal(searchHistory([closure],[],{start:'2026-10-22',end:'2026-10-19'}).rows.length,0);
  assert.equal(searchHistory([{...closure,ticketDetails:[]}],tickets,{query:'19197'}).weight,7000);
  const legacy={...closure,ticketDetails:[],ticketIds:[]};
  assert.equal(searchHistory([legacy],[],{}).weight,null);
  assert.equal(searchHistory([legacy],[],{query:'19197'}).rows.length,0);
  assert.equal(searchHistory([legacy],[],{start:'2026-10-20'}).rows.length,0);
  const brazilian={...closure,ticketDetails:[{...tickets[0],dateISO:null,date:'19/10/2026'}]};
  assert.equal(searchHistory([brazilian],[],{start:'2026-10-19',end:'2026-10-19'}).count,1);
  assert.equal(searchHistory([closure],[],{start:'2026-11-01'}).total,0);
});
