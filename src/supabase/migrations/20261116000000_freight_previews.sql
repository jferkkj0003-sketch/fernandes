begin;

create table public.freight_previews (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  loading_date date not null,
  payment_date date not null check (payment_date >= loading_date),
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  cancelled_at timestamptz,
  ticket_id uuid unique references public.tickets(id) on delete set null
);
alter table public.freight_previews enable row level security;
revoke all on public.freight_previews from public, anon, authenticated;
grant select, insert on public.freight_previews to authenticated;
create policy previews_read on public.freight_previews for select to authenticated using (public.is_app_active_user());
create policy previews_insert on public.freight_previews for insert to authenticated with check (public.is_app_active_user() and created_by = auth.uid() and ticket_id is null and cancelled_at is null and exists (select 1 from public.drivers d where d.id=driver_id and d.active));
alter table public.tickets add column preview_id uuid unique references public.freight_previews(id);

create function app_private.link_freight_preview() returns trigger language plpgsql security definer set search_path='' as $function$
declare p public.freight_previews%rowtype;
begin
  if new.preview_id is null then return new; end if;
  if not public.is_app_active_user() then raise exception 'Usuário não autorizado.' using errcode='42501'; end if;
  select * into p from public.freight_previews where id=new.preview_id for update;
  if not found or p.cancelled_at is not null or p.ticket_id is not null then raise exception 'A prévia não está mais disponível.' using errcode='23514'; end if;
  if p.driver_id <> new.driver_id or p.loading_date <> new.date then raise exception 'O motorista e a data devem ser os mesmos da prévia.' using errcode='23514'; end if;
  return new;
end $function$;
create trigger preview_before_ticket before insert on public.tickets for each row execute function app_private.link_freight_preview();
create function app_private.keep_ticket_preview() returns trigger language plpgsql set search_path='' as $function$
begin
  if new.preview_id is distinct from old.preview_id then raise exception 'O vínculo com a prévia não pode ser alterado.' using errcode='23514'; end if;
  if old.preview_id is not null and (new.driver_id is distinct from old.driver_id or new.date is distinct from old.date) then raise exception 'Para corrigir motorista ou data de um ticket vinculado, remova o ticket e lance novamente pela prévia.' using errcode='23514'; end if;
  return new;
end $function$;
create trigger preview_immutable before update on public.tickets for each row execute function app_private.keep_ticket_preview();
create function app_private.finish_freight_preview() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.preview_id is not null then update public.freight_previews set ticket_id=new.id where id=new.preview_id; end if;
  return new;
end $function$;
create trigger preview_after_ticket after insert on public.tickets for each row execute function app_private.finish_freight_preview();
revoke all on function app_private.link_freight_preview(), app_private.finish_freight_preview(), app_private.keep_ticket_preview() from public, anon, authenticated;

create function public.cancel_freight_preview(preview_uuid uuid) returns void language plpgsql security definer set search_path='' as $function$
begin
  if not public.is_app_admin() then raise exception 'Somente o administrador pode cancelar uma prévia.' using errcode='42501'; end if;
  update public.freight_previews set cancelled_at=now() where id=preview_uuid and cancelled_at is null and ticket_id is null;
  if not found then raise exception 'A prévia não está mais disponível.' using errcode='23514'; end if;
end $function$;
revoke all on function public.cancel_freight_preview(uuid) from public, anon;
grant execute on function public.cancel_freight_preview(uuid) to authenticated;

create function public.get_shared_freight_previews(token_hash_input text) returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare result jsonb;
begin
  if token_hash_input is null or token_hash_input !~ '^[a-f0-9]{64}$' or not exists(select 1 from public.dashboard_share_links where token_hash=token_hash_input and revoked_at is null) then raise exception 'Link inválido ou desativado.' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'driver',d.name,'loading_date',p.loading_date,'payment_date',p.payment_date,'estimated_amount',p.amount,'amount',coalesce(t.gross-t.discount,p.amount),'confirmed',p.ticket_id is not null,'included_in_request',coalesce(c.status='Solicitado',false)) order by p.payment_date,p.created_at),'[]'::jsonb) into result
  from public.freight_previews p join public.drivers d on d.id=p.driver_id left join public.tickets t on t.id=p.ticket_id left join public.closures c on c.id=t.closure_id where p.cancelled_at is null;
  return result;
end $function$;
revoke all on function public.get_shared_freight_previews(text) from public;
grant execute on function public.get_shared_freight_previews(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
