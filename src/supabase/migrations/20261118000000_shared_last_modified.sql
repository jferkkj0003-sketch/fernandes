-- Data/hora da última modificação, exibida na Consulta compartilhada.
-- Usa to_jsonb(...) para ler updated_at/created_at sem depender de a coluna existir em cada tabela.
begin;

create or replace function public.get_shared_last_modified(token_hash_input text) returns timestamptz
language plpgsql stable security definer set search_path='' as $function$
declare result timestamptz;
begin
  if token_hash_input is null or token_hash_input !~ '^[a-f0-9]{64}$'
     or not exists(select 1 from public.dashboard_share_links where token_hash=token_hash_input and revoked_at is null) then
    raise exception 'Link inválido ou desativado.' using errcode='P0002';
  end if;
  select max(ts) into result from (
    select greatest(nullif(to_jsonb(t)->>'updated_at','')::timestamptz, nullif(to_jsonb(t)->>'created_at','')::timestamptz) as ts from public.tickets t
    union all
    select greatest(nullif(to_jsonb(c)->>'updated_at','')::timestamptz, nullif(to_jsonb(c)->>'created_at','')::timestamptz,
                    nullif(to_jsonb(c)->>'sent_at','')::timestamptz, nullif(to_jsonb(c)->>'paid_at','')::timestamptz) from public.closures c
    union all
    select greatest(nullif(to_jsonb(d)->>'updated_at','')::timestamptz, nullif(to_jsonb(d)->>'created_at','')::timestamptz) from public.drivers d
    union all
    select greatest(p.created_at, p.cancelled_at) from public.freight_previews p
  ) x;
  return result;
end $function$;

revoke all on function public.get_shared_last_modified(text) from public;
grant execute on function public.get_shared_last_modified(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
