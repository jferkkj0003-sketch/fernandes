-- Limita correções e remoções a 48 horas após marcar o envio.
begin;
CREATE OR REPLACE FUNCTION public.delete_driver_closure(closure_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare v_closure public.closures%rowtype;
begin
  if not public.is_app_admin() then raise exception 'Somente o administrador pode excluir fechamentos.' using errcode = '42501'; end if;
  select * into v_closure from public.closures where id = closure_uuid for update;
  if not found then raise exception 'Fechamento não encontrado.' using errcode = 'P0002'; end if;
  if v_closure.status = 'Solicitado' and clock_timestamp() >= coalesce(v_closure.sent_at, v_closure.created_at) + interval '2 days' then
    raise exception 'O prazo de 2 dias para excluir este fechamento já expirou.' using errcode = '23514';
  end if;
  update public.tickets set status = 'Aberto', closure_id = null where closure_id = closure_uuid and status = 'No fechamento';
  delete from public.closures where id = closure_uuid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_driver_closure(closure_uuid uuid, tickets_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_closure public.closures%rowtype;
  v_line record;
  v_count integer;
  v_distinct_count integer;
  v_total numeric(12,2);
  v_snapshot jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode editar fechamentos.' using errcode = '42501';
  end if;
  if tickets_input is null or jsonb_typeof(tickets_input) <> 'array' or jsonb_array_length(tickets_input) = 0 then
    raise exception 'Mantenha pelo menos um ticket no fechamento.' using errcode = '22023';
  end if;

  select * into v_closure from public.closures where id = closure_uuid for update;
  if not found then raise exception 'Fechamento não encontrado.' using errcode = 'P0002'; end if;
  if v_closure.status = 'Solicitado' and clock_timestamp() >= coalesce(v_closure.sent_at, v_closure.created_at) + interval '2 days' then
    raise exception 'O prazo de 2 dias para editar este fechamento já expirou.' using errcode = '23514';
  end if;

  select count(*), count(distinct x.id)
    into v_count, v_distinct_count
    from jsonb_to_recordset(tickets_input) as x(id uuid, gross numeric, discount numeric, note text);
  if v_count = 0 or v_count <> v_distinct_count then
    raise exception 'A lista precisa conter tickets sem repetição.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(tickets_input) as x(id uuid, gross numeric, discount numeric, note text)
    where x.id is null or x.gross is null or x.discount is null
      or x.gross < 0 or x.discount < 0 or x.discount > x.gross
  ) then
    raise exception 'Confira os valores: o desconto não pode ser maior que o valor bruto.' using errcode = '22023';
  end if;

  perform t.id from public.tickets t
    where t.closure_id = closure_uuid
       or t.id in (select x.id from jsonb_to_recordset(tickets_input) as x(id uuid, gross numeric, discount numeric, note text))
    order by t.id for update;

  for v_line in
    select x.id, x.gross, x.discount, coalesce(x.note, '') as note
    from jsonb_to_recordset(tickets_input) as x(id uuid, gross numeric, discount numeric, note text)
  loop
    if not exists (select 1 from public.tickets t where t.id = v_line.id) then
      raise exception 'Um dos tickets selecionados não existe mais.' using errcode = 'P0002';
    end if;
    if not exists (
      select 1 from public.tickets t where t.id = v_line.id and (
        (t.closure_id = closure_uuid and t.status = 'No fechamento') or
        (t.closure_id is null and t.status = 'Aberto' and t.driver_id = v_closure.driver_id
          and t.date between v_closure.period_start and v_closure.period_end)
      )
    ) then
      raise exception 'Só é possível manter tickets deste fechamento ou incluir tickets abertos do mesmo motorista e período.' using errcode = '23514';
    end if;
  end loop;

  update public.tickets set status = 'Aberto', closure_id = null
    where closure_id = closure_uuid
      and id not in (select x.id from jsonb_to_recordset(tickets_input) as x(id uuid, gross numeric, discount numeric, note text));

  update public.tickets t set
    gross = x.gross, discount = x.discount, note = coalesce(x.note, ''),
    status = 'No fechamento', closure_id = closure_uuid
  from jsonb_to_recordset(tickets_input) as x(id uuid, gross numeric, discount numeric, note text)
  where t.id = x.id;

  select count(*), coalesce(sum(t.gross - t.discount), 0)
    into v_count, v_total from public.tickets t where t.closure_id = closure_uuid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'date', t.date, 'number', t.number, 'driver', coalesce(v_closure.driver_snapshot->>'fullName', v_closure.driver_snapshot->>'name', d.name),
    'plate', t.plate, 'weight', t.weight, 'gross', t.gross, 'discount', t.discount,
    'note', t.note, 'status', 'No fechamento', 'scan_path', t.scan_path,
    'scan_name', t.scan_name, 'scan_type', t.scan_type, 'scan_size', t.scan_size
  ) order by t.date, t.number), '[]'::jsonb)
    into v_snapshot from public.tickets t join public.drivers d on d.id = t.driver_id where t.closure_id = closure_uuid;

  update public.closures set ticket_count = v_count, total = v_total,
    tickets_snapshot = v_snapshot,
    status = case when status = 'Solicitado' then 'Aguardando envio' else status end
    where id = closure_uuid;
end;
$function$;
notify pgrst, 'reload schema';
commit;
