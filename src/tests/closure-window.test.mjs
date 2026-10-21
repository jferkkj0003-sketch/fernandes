import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinClosureChangeWindow } from '../src/lib/closures.js';
test('sent closures lock at 48 hours, based on send time rather than freight period', () => {
 const sentAt = '2026-10-20T12:00:00Z';
 const closure = {status:'Solicitado',sentAt,createdAt:'2026-10-01T00:00:00Z'};
 const boundary = Date.parse(sentAt)+48*60*60*1000;
 assert.equal(isWithinClosureChangeWindow(closure,boundary-1),true);
 assert.equal(isWithinClosureChangeWindow(closure,boundary),false);
 assert.equal(isWithinClosureChangeWindow(closure,boundary+1),false);
 assert.equal(isWithinClosureChangeWindow({status:'Aguardando envio'},boundary),true);
 assert.equal(isWithinClosureChangeWindow({status:'Solicitado'},boundary),false);
 assert.equal(isWithinClosureChangeWindow({status:'Solicitado',createdAt:sentAt},boundary),false);
});
