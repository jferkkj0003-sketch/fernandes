begin;

-- One timestamp per write transaction. Independent edits need not lock a shared row.
create table app_private.freight_data_changes (
  write_id xid8 primary key,
  modified_at timestamptz not null
);
create index freight_data_changes_latest on app_private.freight_data_changes (modified_at desc);
revoke all on table app_private.freight_data_changes from public, anon, authenticated;

create function app_private.record_freight_data_change() returns trigger
language plpgsql security definer set search_path = '' as $function$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
      return null;
    end if;
  end if;
  insert into app_private.freight_data_changes (write_id, modified_at)
  values (pg_current_xact_id(), clock_timestamp())
  on conflict (write_id) do update set modified_at = excluded.modified_at;
  return null;
end;
$function$;
revoke all on function app_private.record_freight_data_change() from public, anon, authenticated;

create trigger record_shared_ticket_change after insert or update or delete on public.tickets
  for each row execute function app_private.record_freight_data_change();
create trigger record_shared_closure_change after insert or update or delete on public.closures
  for each row execute function app_private.record_freight_data_change();
create trigger record_shared_driver_change after insert or update or delete on public.drivers
  for each row execute function app_private.record_freight_data_change();
create trigger record_shared_freight_preview_change after insert or update or delete on public.freight_previews
  for each row execute function app_private.record_freight_data_change();

-- Start from saved operation times rather than the migration time.
insert into app_private.freight_data_changes (write_id, modified_at)
select pg_current_xact_id(), max(changed_at)
from (
  select created_at as changed_at from public.tickets
  union all select changed_at from public.ticket_edit_history
  union all select greatest(created_at, sent_at, paid_at) from public.closures
  union all select occurred_at from app_private.closure_payment_events
  union all select greatest(created_at, updated_at) from public.drivers
  union all select greatest(created_at, cancelled_at) from public.freight_previews
) previous_changes
having max(changed_at) is not null;

create function app_private.get_freight_data_last_modified(token_hash_input text) returns timestamptz
language plpgsql stable security definer set search_path = '' as $function$
begin
  if token_hash_input is null or token_hash_input !~ '^[a-f0-9]{64}$'
     or not exists (
       select 1 from public.dashboard_share_links
       where token_hash = token_hash_input and revoked_at is null
     ) then
    raise exception 'Link inválido ou desativado.' using errcode = 'P0002';
  end if;
  return (select modified_at from app_private.freight_data_changes order by modified_at desc limit 1);
end;
$function$;

create or replace function public.get_shared_last_modified(token_hash_input text) returns timestamptz
language sql stable security invoker set search_path = '' as $function$
  select app_private.get_freight_data_last_modified(token_hash_input);
$function$;
revoke all on function app_private.get_freight_data_last_modified(text) from public, anon, authenticated;
revoke all on function public.get_shared_last_modified(text) from public, anon, authenticated;
grant execute on function app_private.get_freight_data_last_modified(text) to anon, authenticated;
grant execute on function public.get_shared_last_modified(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
