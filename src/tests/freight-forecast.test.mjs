import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightForecast } from '../src/lib/freight-forecast.js';

const day='2026-11-20';
const data={
  drivers_by_day:[
    {driver:'Ana',date:'2026-11-19',open_count:2,open_amount:2000},
    {driver:'Bia',date:'2026-11-18',open_count:1,open_amount:300},
    {driver:'Ana',date:'2026-11-01',open_count:0,open_amount:0},
  ],
  closure_payments:[
    {driver:'Ana',email_status:'Aguardando envio',payment_status:'pending',total:500,days:[{date:'2026-11-19',amount:500}]},
    {driver:'Ana',email_status:'Solicitado',payment_status:'pending',payment_due_date:day,total:1000,days:[{date:'2026-11-19',amount:1000}]},
    {driver:'Ana',email_status:'Solicitado',payment_status:'paid',payment_due_date:day,total:700,days:[{date:'2026-11-19',amount:700}]},
  ],
  freight_previews:[
    {driver:'Ana',loading_date:'2026-11-19',payment_date:day,amount:400,confirmed:false},
    {driver:'Ana',loading_date:'2026-11-19',payment_date:day,amount:1000,confirmed:true,included_in_request:false},
    {driver:'Ana',loading_date:'2026-11-19',payment_date:day,amount:1000,confirmed:true,included_in_request:true},
  ],
};
test('inclui tickets abertos, fechamentos e prévias sem duplicar tickets vinculados',()=>{
  const result=freightForecast(data,day);
  assert.equal(result.total,4200);
  assert.deepEqual(result.drivers.map(({name,amount,openCount})=>({name,amount,openCount})),[{name:'Ana',amount:3900,openCount:2},{name:'Bia',amount:300,openCount:1}]);
  assert.deepEqual(result.drivers[0],{name:'Ana',open:2000,waiting:500,requested:1000,preview:400,openCount:2,amount:3900});
});
test('aplica filtros de motorista, período e data sem ocultar abertos sem data de pagamento',()=>{
  assert.equal(freightForecast(data,'2026-11-21','Ana').total,2500);
  assert.equal(freightForecast(data,day,'Bia').total,300);
  assert.equal(freightForecast(data,day,'',{start:'2026-11-19',end:'2026-11-19'}).total,3900);
  assert.equal(freightForecast(data,day,'',{start:'2026-11-20',end:'2026-11-20'}).total,0);
});
test('soma valores em centavos',()=>{
  const rows={freight_previews:[{driver:'Ana',loading_date:'2026-11-19',payment_date:day,amount:0.1},{driver:'Ana',loading_date:'2026-11-19',payment_date:day,amount:0.2}]};
  assert.equal(freightForecast(rows,day).total,0.3);
});
