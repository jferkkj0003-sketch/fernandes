import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('prévia links atomically to one ticket and shared totals expose no private data', async () => {
  const db = new PGlite();
  const actor='11111111-1111-4111-8111-111111111111', driver='22222222-2222-4222-8222-222222222222', preview='33333333-3333-4333-8333-333333333333', ticket='44444444-4444-4444-8444-444444444444', hash='a'.repeat(64);
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema app_private;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create function public.is_app_active_user() returns boolean language sql as $$select auth.uid() is not null$$;
      create function public.is_app_admin() returns boolean language sql as $$select current_setting('test.admin',true)='yes'$$;
      grant usage on schema auth to authenticated, anon; grant execute on function auth.uid(),public.is_app_active_user(),public.is_app_admin() to authenticated,anon;
      create table drivers(id uuid primary key,name text,active boolean); grant select on drivers to authenticated;
      create table closures(id uuid primary key,status text);
      create table tickets(id uuid primary key,driver_id uuid references drivers,date date,gross numeric,discount numeric,closure_id uuid references closures); grant select,insert,update,delete on tickets to authenticated;
      create table dashboard_share_links(token_hash text,revoked_at timestamptz);
      insert into drivers values('${driver}','Motorista teste',true); insert into dashboard_share_links values('${hash}',null);
      select set_config('test.actor','${actor}',false);`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261116000000_freight_previews.sql', import.meta.url), 'utf8'));
    await db.exec('set role authenticated');
    await db.query("insert into freight_previews(id,driver_id,loading_date,payment_date,amount,note) values($1,$2,'2026-11-19','2026-11-20',1000,'PRIVATE')",[preview,driver]);
    await assert.rejects(db.query("insert into tickets(id,driver_id,date,gross,discount,preview_id) values($1,$2,'2026-11-18',1000,0,$3)",[ticket,driver,preview]),/motorista e a data/);
    await db.query("insert into tickets(id,driver_id,date,gross,discount,preview_id) values($1,$2,'2026-11-19',900,0,$3)",[ticket,driver,preview]);
    await assert.rejects(db.query("insert into tickets(id,driver_id,date,gross,discount,preview_id) values(gen_random_uuid(),$1,'2026-11-19',1000,0,$2)",[driver,preview]));
    await assert.rejects(db.query("update tickets set date='2026-11-20' where id=$1",[ticket]), /remova o ticket/);
    await db.exec('set role anon');
    const rows=(await db.query('select get_shared_freight_previews($1) as data',[hash])).rows[0].data;
    assert.equal(rows[0].amount,900); assert.equal(rows[0].estimated_amount,1000); assert.equal(rows[0].confirmed,true);
    assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);
    await assert.rejects(db.query('select get_shared_freight_previews($1)',['b'.repeat(64)]),/Link inválido/);
    await db.exec('set role authenticated');
    await db.query('delete from tickets where id=$1',[ticket]);
    const restored=(await db.query('select ticket_id from freight_previews where id=$1',[preview])).rows[0];
    assert.equal(restored.ticket_id,null);
  } finally { await db.close(); }
});
