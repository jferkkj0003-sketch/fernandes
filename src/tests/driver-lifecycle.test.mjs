import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { driverKey, recordDriverKey, matchesDriver, driverOptions } from '../src/lib/drivers.js';

test('identity and historical filters survive renames and distinguish equal names', () => {
  const driver = { id: 'driver-1', name: 'Nome corrigido', active: false };
  const ticket = { driverId: 'driver-1', driver: 'Nome antigo' };
  assert.equal(recordDriverKey(ticket), driverKey(driver));
  assert.equal(matchesDriver(ticket, driver), true);
  assert.equal(matchesDriver({ driverId: 'driver-2', driver: driver.name }, driver), false);
  assert.deepEqual(driverOptions([driver, { id: 'driver-2', name: driver.name }], [ticket]), [
    { key: 'driver-1', name: 'Nome corrigido', active: false },
    { key: 'driver-2', name: 'Nome corrigido', active: true },
  ]);
  assert.equal(matchesDriver({ driver: 'Exemplo' }, { name: 'Exemplo' }), true);
});

test('database inactivation preserves records, enforces permissions and permits closing old tickets', async () => {
  const db = new PGlite();
  const driverId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  try {
    // Minimal stand-in for the pre-existing schema: this does not reproduce or
    // validate production RLS policies or the existing closure RPCs.
    await db.exec(`
      create role anon;
      create role authenticated;
      create table drivers(id uuid primary key, name text);
      create table tickets(id integer primary key, driver_id uuid references drivers(id), status text, scan_path text);
      create table closures(id integer primary key, driver_id uuid references drivers(id));
      create function is_app_admin() returns boolean language sql as $$
        select coalesce(current_setting('app.test_admin', true), '') = 'yes';
      $$;
      grant usage on schema public to authenticated;
      grant select, insert, update on drivers, tickets, closures to authenticated;
      insert into drivers values ('${driverId}', 'Original'), ('${otherId}', 'Outro');
      insert into tickets values (1, '${driverId}', 'Aberto', 'private/scan.pdf');
      insert into closures values (1, '${driverId}');
    `);
    const migration = await readFile(new URL('../supabase/driver_active_migration.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Deployment retry must be safe.
    assert.equal((await db.query('select active from drivers limit 1')).rows[0].active, true);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select set_driver_active($1, false)', [driverId]), /Somente o administrador/);
    await db.exec("select set_config('app.test_admin', 'yes', false)");
    await db.query('select set_driver_active($1, false)', [driverId]);
    assert.deepEqual((await db.query('select status, scan_path from tickets')).rows, [{ status: 'Aberto', scan_path: 'private/scan.pdf' }]);
    assert.equal((await db.query('select count(*)::int as n from closures')).rows[0].n, 1);
    await db.exec("select set_config('app.test_admin', 'no', false)");
    await assert.rejects(db.query("insert into tickets values (2, $1, 'Aberto', null)", [driverId]), /motorista ativo/);
    await db.query("insert into tickets values (2, $1, 'Aberto', null)", [otherId]);
    await assert.rejects(db.query('update tickets set driver_id=$1 where id=2', [driverId]), /motorista ativo/);
    await db.query("update tickets set status='No fechamento', driver_id=$1 where id=1", [driverId]);
    await db.exec("update tickets set status='Aberto' where id=1");
    assert.equal((await db.query('select status from tickets where id=1')).rows[0].status, 'Aberto');
    await db.exec("select set_config('app.test_admin', 'yes', false)");
    await assert.rejects(db.query('select set_driver_active($1, null)', [driverId]), /Informe a situação/);
    await assert.rejects(db.query("select set_driver_active('33333333-3333-4333-8333-333333333333', true)"), /não encontrado/);
    await db.query('select set_driver_active($1, true)', [driverId]);
    await db.query("insert into tickets values (3, $1, 'Aberto', null)", [driverId]);
    assert.equal((await db.query('select count(*)::int as n from tickets')).rows[0].n, 3);
    assert.equal((await db.query("select has_function_privilege('anon', 'set_driver_active(uuid, boolean)', 'execute') as allowed")).rows[0].allowed, false);
  } finally {
    await db.close();
  }
});
