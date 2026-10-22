begin;

create schema if not exists app_private;
alter table public.closures add column if not exists payment_status text not null default 'unverified';
alter table public.closures alter column payment_status set default 'pending';
alter table public.closures add column if not exists payment_due_date date;
alter table public.closures alter column payment_due_date set default (((now() at time zone 'America/Manaus')::date) + 1);
alter table public.closures add column if not exists paid_on date;
alter table public.closures add column if not exists paid_at timestamptz;
alter table public.closures add column if not exists paid_by uuid;
do $block$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.closures'::regclass and conname='closure_payment_state_valid') then
    alter table public.closures add constraint closure_payment_state_valid check (
      payment_status in ('unverified','pending','paid') and
      ((payment_status='paid' and paid_at is not null and paid_on is not null) or
       (payment_status<>'paid' and paid_at is null and paid_on is null and paid_by is null))
    );
  end if;
end $block$;

create table if not exists app_private.closure_payment_events (
  id bigint generated always as identity primary key,
  closure_id uuid not null,
  actor_id uuid,
  occurred_at timestamptz not null default clock_timestamp(),
  operation text not null,
  before_state jsonb,
  after_state jsonb
);
alter table app_private.closure_payment_events enable row level security;
create index if not exists closure_payment_events_closure_time on app_private.closure_payment_events(closure_id,occurred_at);

create or replace function app_private.guard_closure_payment() returns trigger
language plpgsql set search_path='' as $function$
begin
  if tg_op='DELETE' then
    if old.paid_at is not null then raise exception 'Um fechamento pago não pode ser removido.' using errcode='23514'; end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.paid_at is not null then
    if new is distinct from old then raise exception 'Um fechamento pago não pode ser alterado.' using errcode='23514'; end if;
    return new;
  end if;
  if tg_op='UPDATE' and new.status='Solicitado' and old.status='Aguardando envio' then
    if new.payment_status='unverified' then new.payment_status='pending'; end if;
    new.payment_due_date=coalesce(new.payment_due_date,((now() at time zone 'America/Manaus')::date)+1);
  end if;
  if new.payment_status='paid' then
    if auth.uid() is null or not public.is_app_admin() then raise exception 'Somente o administrador pode confirmar pagamentos.' using errcode='42501'; end if;
    if new.status<>'Solicitado' or new.paid_on is null or new.paid_at is null or new.paid_by is distinct from auth.uid()
       or new.paid_on>(now() at time zone 'America/Manaus')::date then
      raise exception 'Confira a solicitação e a data efetiva do pagamento.' using errcode='23514';
    end if;
  end if;
  return new;
end $function$;
create or replace function app_private.guard_paid_ticket() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
  if old.closure_id is not null and exists(select 1 from public.closures c where c.id=old.closure_id and c.paid_at is not null) then
    raise exception 'Tickets de um fechamento pago não podem ser alterados ou removidos.' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $function$;
create or replace function app_private.audit_closure_payment() returns trigger
language plpgsql security definer set search_path='' as $function$
declare v_old jsonb; v_new jsonb;
begin
  if tg_op<>'INSERT' then v_old=jsonb_build_object('number',old.number,'status',old.status,'total',old.total,'payment_status',old.payment_status,'due_date',old.payment_due_date,'paid_on',old.paid_on,'paid_at',old.paid_at,'paid_by',old.paid_by); end if;
  if tg_op<>'DELETE' then v_new=jsonb_build_object('number',new.number,'status',new.status,'total',new.total,'payment_status',new.payment_status,'due_date',new.payment_due_date,'paid_on',new.paid_on,'paid_at',new.paid_at,'paid_by',new.paid_by); end if;
  if v_old is distinct from v_new then
    insert into app_private.closure_payment_events(closure_id,actor_id,operation,before_state,after_state)
    values(case when tg_op='DELETE' then old.id else new.id end,auth.uid(),tg_op,v_old,v_new);
  end if;
  return null;
end $function$;
do $block$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.closures'::regclass and tgname='guard_closure_payment') then create trigger guard_closure_payment before insert or update or delete on public.closures for each row execute function app_private.guard_closure_payment(); end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.closures'::regclass and tgname='audit_closure_payment') then create trigger audit_closure_payment after insert or update or delete on public.closures for each row execute function app_private.audit_closure_payment(); end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.tickets'::regclass and tgname='guard_paid_ticket') then create trigger guard_paid_ticket before update or delete on public.tickets for each row execute function app_private.guard_paid_ticket(); end if;
end $block$;

create or replace function app_private.request_closure_payment(closure_uuid uuid,due_date_input date) returns void
language plpgsql security definer set search_path='' as $function$
declare v_closure public.closures%rowtype;
begin
  if auth.uid() is null or not public.is_app_active_user() then raise exception 'Conta inativa ou sem acesso.' using errcode='42501'; end if;
  if due_date_input is null then raise exception 'Informe a previsão de pagamento.' using errcode='22023'; end if;
  select * into v_closure from public.closures where id=closure_uuid for update;
  if not found then raise exception 'Fechamento não encontrado.' using errcode='P0002'; end if;
  if v_closure.paid_at is not null then raise exception 'O pagamento já foi confirmado.' using errcode='23514'; end if;
  if v_closure.status='Aguardando envio' then perform public.mark_closure_requested(closure_uuid);
  elsif v_closure.status<>'Solicitado' then raise exception 'Situação de envio inválida.' using errcode='23514'; end if;
  update public.closures set payment_due_date=due_date_input,payment_status='pending' where id=closure_uuid;
end $function$;
create or replace function public.request_closure_payment(closure_uuid uuid,due_date_input date) returns void
language sql security invoker set search_path='' as $function$ select app_private.request_closure_payment(closure_uuid,due_date_input); $function$;

create or replace function app_private.set_closure_payment_due(closure_uuid uuid,due_date_input date) returns void
language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null or not public.is_app_admin() then raise exception 'Somente o administrador pode alterar a previsão.' using errcode='42501'; end if;
  if due_date_input is null then raise exception 'Informe a previsão de pagamento.' using errcode='22023'; end if;
  perform 1 from public.closures where id=closure_uuid and paid_at is null for update;
  if not found then raise exception 'Fechamento não encontrado ou já pago.' using errcode='P0002'; end if;
  update public.closures set payment_due_date=due_date_input,payment_status='pending' where id=closure_uuid;
end $function$;
create or replace function public.set_closure_payment_due(closure_uuid uuid,due_date_input date) returns void
language sql security invoker set search_path='' as $function$ select app_private.set_closure_payment_due(closure_uuid,due_date_input); $function$;

create or replace function app_private.mark_closure_paid(closure_uuid uuid,paid_on_input date) returns void
language plpgsql security definer set search_path='' as $function$
declare v_closure public.closures%rowtype;
begin
  if auth.uid() is null or not public.is_app_admin() then raise exception 'Somente o administrador pode confirmar pagamentos.' using errcode='42501'; end if;
  if paid_on_input is null or paid_on_input>(now() at time zone 'America/Manaus')::date then raise exception 'Informe a data efetiva do pagamento, sem data futura.' using errcode='22023'; end if;
  select * into v_closure from public.closures where id=closure_uuid for update;
  if not found then raise exception 'Fechamento não encontrado.' using errcode='P0002'; end if;
  if v_closure.paid_at is not null then
    if v_closure.paid_on=paid_on_input then return; end if;
    raise exception 'O pagamento deste fechamento já foi confirmado em outra data.' using errcode='23514';
  end if;
  if v_closure.status<>'Solicitado' then raise exception 'Confirme o envio por e-mail antes de registrar o pagamento.' using errcode='23514'; end if;
  update public.closures set payment_status='paid',paid_on=paid_on_input,paid_at=clock_timestamp(),paid_by=auth.uid() where id=closure_uuid;
end $function$;
create or replace function public.mark_closure_paid(closure_uuid uuid,paid_on_input date) returns void
language sql security invoker set search_path='' as $function$ select app_private.mark_closure_paid(closure_uuid,paid_on_input); $function$;

create or replace function app_private.get_shared_closure_payments(token_hash_input text) returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare v_result jsonb;
begin
  -- Same share-link scope as the existing two dashboard RPCs: one company, active token.
  if token_hash_input is null or token_hash_input !~ '^[a-f0-9]{64}$' or not exists(
    select 1 from public.dashboard_share_links where token_hash=token_hash_input and revoked_at is null
  ) then raise exception 'Link inválido ou desativado.' using errcode='P0002'; end if;
  select jsonb_build_object('closure_payments',coalesce(jsonb_agg(jsonb_build_object(
    'number',c.number::text,'driver',coalesce(c.driver_snapshot->>'fullName',c.driver_snapshot->>'name',dr.name,''),
    'period_start',c.period_start,'period_end',c.period_end,'total',c.total,'ticket_count',c.ticket_count,
    'email_status',c.status,'sent_at',c.sent_at,'payment_status',c.payment_status,'payment_due_date',c.payment_due_date,'paid_on',c.paid_on,
    'days',coalesce((select jsonb_agg(jsonb_build_object('date',d.date,'count',d.count,'weight',d.weight,'amount',d.amount) order by d.date)
      from (select t.date,count(*)::integer as count,sum(t.weight) as weight,sum(t.gross-t.discount) as amount from public.tickets t where t.closure_id=c.id group by t.date) d),'[]'::jsonb)
  ) order by c.number desc),'[]'::jsonb)) into v_result from public.closures c left join public.drivers dr on dr.id=c.driver_id;
  return v_result;
end $function$;
create or replace function public.get_shared_closure_payments(token_hash_input text) returns jsonb
language sql stable security invoker set search_path='' as $function$ select app_private.get_shared_closure_payments(token_hash_input); $function$;

-- Supply exact open weights as well as totals; this fixes mixed open/closed day groups.
create or replace function public.get_shared_driver_summary(token_hash_input text) returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare v_result jsonb;
begin
  if token_hash_input is null or token_hash_input !~ '^[a-f0-9]{64}$' or not exists(select 1 from public.dashboard_share_links where token_hash=token_hash_input and revoked_at is null) then raise exception 'Link inválido ou desativado.' using errcode='P0002'; end if;
  select jsonb_build_object('drivers_by_day',coalesce(jsonb_agg(jsonb_build_object('date',d.date,'driver',d.driver,'count',d.count,'weight',d.weight,'amount',d.amount,'open_count',d.open_count,'open_weight',d.open_weight,'open_amount',d.open_amount) order by d.date,d.driver),'[]'::jsonb)) into v_result
  from (select t.date,dr.name as driver,count(*)::integer as count,coalesce(sum(t.weight),0) as weight,coalesce(sum(t.gross-t.discount),0) as amount,
    count(*) filter(where t.status='Aberto')::integer as open_count,coalesce(sum(t.weight) filter(where t.status='Aberto'),0) as open_weight,coalesce(sum(t.gross-t.discount) filter(where t.status='Aberto'),0) as open_amount
    from public.tickets t join public.drivers dr on dr.id=t.driver_id group by t.date,dr.name) d;
  return v_result;
end $function$;

revoke all on app_private.closure_payment_events from public,anon,authenticated;
revoke all on function app_private.guard_closure_payment(),app_private.guard_paid_ticket(),app_private.audit_closure_payment(),app_private.request_closure_payment(uuid,date),app_private.set_closure_payment_due(uuid,date),app_private.mark_closure_paid(uuid,date),app_private.get_shared_closure_payments(text) from public,anon,authenticated;
grant usage on schema app_private to authenticated,anon;
grant execute on function app_private.request_closure_payment(uuid,date),app_private.set_closure_payment_due(uuid,date),app_private.mark_closure_paid(uuid,date) to authenticated;
grant execute on function app_private.get_shared_closure_payments(text) to authenticated,anon;
revoke all on function public.request_closure_payment(uuid,date),public.set_closure_payment_due(uuid,date),public.mark_closure_paid(uuid,date) from public,anon;
grant execute on function public.request_closure_payment(uuid,date),public.set_closure_payment_due(uuid,date),public.mark_closure_paid(uuid,date) to authenticated;
revoke all on function public.get_shared_closure_payments(text) from public;
grant execute on function public.get_shared_closure_payments(text) to authenticated,anon;
notify pgrst,'reload schema';
commit;
