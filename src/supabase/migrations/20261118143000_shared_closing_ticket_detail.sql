begin;
create function app_private.shared_closing_ticket_rows(
  driver_input text, start_input date, end_input date, ticket_input uuid default null
) returns table(id uuid, number text, date date, weight numeric, amount numeric,
  status text, driver text, plate text, gross numeric, discount numeric, scan_path text, scan_type text, scan_name text)
language sql stable security invoker set search_path = '' as $function$
  select t.id, t.number, t.date, t.weight, t.gross - t.discount,
    case when t.status = 'Aberto' then 'Em aberto'
         when c.status = 'Solicitado' then 'Solicitado'
         else 'Aguardando envio' end,
    driver_input, t.plate, t.gross, t.discount, t.scan_path, t.scan_type, t.scan_name
    from public.tickets t
    join public.drivers d on d.id = t.driver_id
    left join public.closures c on c.id = t.closure_id
    cross join lateral (
      select date_trunc('week', c.sent_at at time zone 'America/Manaus')
        + interval '4 days 17 hours' as friday
    ) cycle
    where (ticket_input is null or t.id = ticket_input)
      and (start_input is null or t.date >= start_input)
      and (end_input is null or t.date <= end_input)
      and (
        (t.status = 'Aberto' and d.name = driver_input)
        or (
          t.status <> 'Aberto'
          and coalesce(c.driver_snapshot->>'fullName', c.driver_snapshot->>'name', d.name, '') = driver_input
          and c.payment_status = 'pending'
          and (c.status <> 'Solicitado' or (
            c.period_end >= date '2026-10-22'
            and (c.sent_at is null or (now() at time zone 'America/Manaus') <
              cycle.friday + case
                when (c.sent_at at time zone 'America/Manaus') >= cycle.friday then interval '7 days'
                else interval '0 days'
              end)
          ))
        )
      );
$function$;
revoke all on function app_private.shared_closing_ticket_rows(text,date,date,uuid) from public, anon, authenticated;

create function app_private.assert_shared_ticket_link(token_hash_input text) returns void
language plpgsql stable security invoker set search_path = '' as $function$
begin
  if token_hash_input is null or token_hash_input !~ '^[a-f0-9]{64}$' or not exists (
    select 1 from public.dashboard_share_links
    where token_hash = token_hash_input and revoked_at is null
  ) then
    raise exception 'Link inválido ou desativado.' using errcode = 'P0002';
  end if;
end;
$function$;
revoke all on function app_private.assert_shared_ticket_link(text) from public, anon, authenticated;

create or replace function app_private.get_shared_closing_tickets(
  token_hash_input text, driver_input text, start_input date, end_input date, offset_input integer
) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  perform app_private.assert_shared_ticket_link(token_hash_input);
  if driver_input is null or driver_input = '' or offset_input is null or offset_input < 0
      or (start_input is not null and end_input is not null and start_input > end_input) then
    raise exception 'Filtros de tickets inválidos.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', page.id, 'number', page.number, 'date', page.date, 'weight', page.weight,
    'amount', page.amount, 'status', page.status
  ) order by page.date desc, page.number, page.id), '[]'::jsonb)
  into result
  from (
    select rows.id, rows.number, rows.date, rows.weight, rows.amount, rows.status
    from app_private.shared_closing_ticket_rows(driver_input, start_input, end_input) rows
    order by rows.date desc, rows.number, rows.id
    limit 51 offset offset_input
  ) page;
  return result;
end;
$function$;

create function app_private.get_shared_closing_ticket_detail(
  token_hash_input text, driver_input text, start_input date, end_input date, ticket_input uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  perform app_private.assert_shared_ticket_link(token_hash_input);
  if ticket_input is null or driver_input is null or driver_input = ''
      or (start_input is not null and end_input is not null and start_input > end_input) then
    raise exception 'Filtros de tickets inválidos.' using errcode = '22023';
  end if;
  select to_jsonb(ticket) into result
    from app_private.shared_closing_ticket_rows(driver_input, start_input, end_input, ticket_input) ticket;
  return result;
end;
$function$;

create function public.get_shared_closing_ticket_detail(
  token_hash_input text, driver_input text, start_input date, end_input date, ticket_input uuid
) returns jsonb
language sql stable security invoker set search_path = '' as $function$
  select app_private.get_shared_closing_ticket_detail(token_hash_input, driver_input, start_input, end_input, ticket_input);
$function$;
revoke all on function app_private.get_shared_closing_ticket_detail(text,text,date,date,uuid) from public, anon, authenticated;
revoke all on function public.get_shared_closing_ticket_detail(text,text,date,date,uuid) from public, anon, authenticated;
grant usage on schema app_private to service_role;
grant execute on function app_private.get_shared_closing_ticket_detail(text,text,date,date,uuid) to service_role;
grant execute on function public.get_shared_closing_ticket_detail(text,text,date,date,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
