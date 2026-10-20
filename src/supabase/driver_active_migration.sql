-- Apply after the existing schema and operator_accounts_migration.sql.
-- Existing drivers remain active. No tickets, closures or files are deleted.
begin;

alter table public.drivers add column if not exists active boolean not null default true;

create or replace function public.set_driver_active(driver_uuid uuid, active_input boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_app_admin(), false) then
    raise exception 'Somente o administrador pode alterar a situação de motoristas.' using errcode = '42501';
  end if;
  if active_input is null then
    raise exception 'Informe a situação do motorista.' using errcode = '22023';
  end if;
  update public.drivers set active = active_input where id = driver_uuid;
  if not found then
    raise exception 'Motorista não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_driver_active(uuid, boolean) from public, anon;
grant execute on function public.set_driver_active(uuid, boolean) to authenticated;

-- Also guard writes from older clients. Existing tickets for inactive drivers
-- may still be corrected, closed or reopened without changing their driver.
create or replace function public.require_active_ticket_driver()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  driver_active boolean;
begin
  if tg_op = 'UPDATE' then
    if new.driver_id is not distinct from old.driver_id then
      return new;
    end if;
  end if;
  -- Serialize new ticket assignments with an administrator changing active.
  select active into driver_active from public.drivers where id = new.driver_id for share;
  if driver_active is distinct from true then
    raise exception 'Selecione um motorista ativo antes de lançar ou transferir o ticket.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_require_active_driver on public.tickets;
create trigger tickets_require_active_driver
before insert or update of driver_id on public.tickets
for each row execute function public.require_active_ticket_driver();

notify pgrst, 'reload schema';
commit;
