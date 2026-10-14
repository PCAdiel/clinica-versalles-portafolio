create extension if not exists pgcrypto;

create table if not exists public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos(id) on delete restrict,
  cita_id uuid not null references public.citas(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  tipo_comprobante text not null check (tipo_comprobante in ('BOLETA', 'FACTURA')),
  serie text not null,
  numero integer not null check (numero > 0),
  estado text not null default 'PENDIENTE_EMISION'
    check (estado in ('PENDIENTE_EMISION', 'ENVIANDO', 'EMITIDO', 'ERROR_FACTURACION', 'PENDIENTE_REINTENTO', 'ANULADO_NUBEFACT')),
  proveedor text not null default 'LOCAL',
  proveedor_id text,
  pdf_url text,
  xml_url text,
  cdr_url text,
  estado_sunat text,
  respuesta_sunat jsonb,
  ticket_anulacion text,
  sunat_description text,
  sunat_note text,
  sunat_responsecode text,
  sunat_soap_error text,
  cadena_para_codigo_qr text,
  codigo_hash text,
  error_mensaje text,
  cliente_tipo_documento text not null,
  cliente_numero_documento text not null,
  cliente_denominacion text not null,
  cliente_direccion text,
  preview_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facturacion_eventos (
  id uuid primary key default gen_random_uuid(),
  comprobante_id uuid references public.comprobantes(id) on delete cascade,
  pago_id uuid references public.pagos(id) on delete cascade,
  cita_id uuid references public.citas(id) on delete cascade,
  paciente_id uuid references public.pacientes(id) on delete cascade,
  proveedor text not null default 'NUBEFACT',
  operacion text not null check (operacion in ('emision', 'consulta', 'error', 'anulacion', 'reintento', 'previsualizacion', 'generar_comprobante', 'consultar_comprobante', 'generar_anulacion')),
  estado text not null,
  mensaje text,
  detalle jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_comprobantes_pago_id on public.comprobantes(pago_id);
create index if not exists idx_comprobantes_paciente_id on public.comprobantes(paciente_id);
create index if not exists idx_comprobantes_estado on public.comprobantes(estado);
create index if not exists idx_comprobantes_tipo_comprobante on public.comprobantes(tipo_comprobante);
create unique index if not exists idx_comprobantes_tipo_serie_numero_unique
  on public.comprobantes(tipo_comprobante, serie, numero);
create unique index if not exists idx_comprobantes_pago_id_unique
  on public.comprobantes(pago_id);
create index if not exists idx_facturacion_eventos_comprobante_created
  on public.facturacion_eventos(comprobante_id, created_at desc);
create index if not exists idx_facturacion_eventos_paciente_created
  on public.facturacion_eventos(paciente_id, created_at desc);

drop trigger if exists set_comprobantes_updated_at on public.comprobantes;
create trigger set_comprobantes_updated_at
before update on public.comprobantes
for each row execute function public.set_updated_at();

alter table public.comprobantes enable row level security;
alter table public.facturacion_eventos enable row level security;

grant select, insert, update, delete on public.comprobantes to authenticated;
grant select, insert, update, delete on public.facturacion_eventos to authenticated;

drop policy if exists comprobantes_select_roles on public.comprobantes;
create policy comprobantes_select_roles on public.comprobantes
for select
to authenticated
using (
  public.is_admin()
  or public.is_recepcionista()
  or paciente_id = public.get_current_paciente_id()
);

drop policy if exists comprobantes_insert_rpc_only on public.comprobantes;
create policy comprobantes_insert_rpc_only on public.comprobantes
for insert
to authenticated
with check (false);

drop policy if exists comprobantes_update_rpc_only on public.comprobantes;
create policy comprobantes_update_rpc_only on public.comprobantes
for update
to authenticated
using (false)
with check (false);

drop policy if exists comprobantes_delete_blocked on public.comprobantes;
create policy comprobantes_delete_blocked on public.comprobantes
for delete
to authenticated
using (false);

drop policy if exists facturacion_eventos_select_roles on public.facturacion_eventos;
create policy facturacion_eventos_select_roles on public.facturacion_eventos
for select
to authenticated
using (
  public.is_admin()
  or public.is_recepcionista()
  or paciente_id = public.get_current_paciente_id()
);

drop policy if exists facturacion_eventos_insert_rpc_only on public.facturacion_eventos;
create policy facturacion_eventos_insert_rpc_only on public.facturacion_eventos
for insert
to authenticated
with check (false);

drop policy if exists facturacion_eventos_update_blocked on public.facturacion_eventos;
create policy facturacion_eventos_update_blocked on public.facturacion_eventos
for update
to authenticated
using (false)
with check (false);

drop policy if exists facturacion_eventos_delete_blocked on public.facturacion_eventos;
create policy facturacion_eventos_delete_blocked on public.facturacion_eventos
for delete
to authenticated
using (false);

create or replace function public.registrar_pago_con_comprobante(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rol text;
  v_cita record;
  v_paciente record;
  v_medico record;
  v_pago_id uuid;
  v_comprobante_id uuid;
  v_tipo_comprobante text := upper(coalesce(p_payload ->> 'tipo_comprobante', 'BOLETA'));
  v_serie text;
  v_numero integer;
  v_concepto text := coalesce(nullif(trim(p_payload ->> 'concepto'), ''), 'Consulta medica');
  v_monto numeric := coalesce((p_payload ->> 'monto')::numeric, 0);
  v_subtotal numeric;
  v_igv numeric;
  v_metodo_pago text := coalesce(nullif(p_payload ->> 'metodo_pago', ''), 'Efectivo');
  v_estado_pago text := coalesce(nullif(p_payload ->> 'estado', ''), 'pagado');
  v_fecha_pago date := coalesce(nullif(p_payload ->> 'fecha_pago', '')::date, current_date);
  v_cliente_tipo_documento text;
  v_cliente_numero_documento text;
  v_cliente_denominacion text;
  v_cliente_direccion text;
  v_preview jsonb;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesion para registrar pagos.';
  end if;

  v_rol := public.get_current_user_role();

  if v_rol not in ('admin', 'recepcionista') then
    raise exception 'Tu rol no permite registrar pagos con comprobante.';
  end if;

  if v_tipo_comprobante not in ('BOLETA', 'FACTURA') then
    raise exception 'Tipo de comprobante invalido.';
  end if;

  if v_monto <= 0 then
    raise exception 'El comprobante no puede tener monto menor o igual a cero.';
  end if;

  select c.*
  into v_cita
  from public.citas c
  where c.id = nullif(p_payload ->> 'cita_id', '')::uuid;

  if not found then
    raise exception 'La cita relacionada no existe.';
  end if;

  if v_cita.paciente_id is distinct from nullif(p_payload ->> 'paciente_id', '')::uuid then
    raise exception 'El paciente no pertenece a la cita seleccionada.';
  end if;

  select p.*
  into v_paciente
  from public.pacientes p
  where p.id = v_cita.paciente_id;

  if not found then
    raise exception 'El paciente relacionado no existe.';
  end if;

  select m.*
  into v_medico
  from public.medicos m
  where m.id = v_cita.medico_id;

  if v_tipo_comprobante = 'FACTURA' then
    v_cliente_tipo_documento := 'RUC';
    v_cliente_numero_documento := regexp_replace(coalesce(p_payload ->> 'cliente_numero_documento', ''), '\D', '', 'g');
    v_cliente_denominacion := nullif(trim(coalesce(p_payload ->> 'cliente_denominacion', '')), '');
    v_cliente_direccion := nullif(trim(coalesce(p_payload ->> 'cliente_direccion', '')), '');

    if length(v_cliente_numero_documento) <> 11
      or v_cliente_denominacion is null
      or v_cliente_direccion is null then
      raise exception 'Para factura exige RUC de 11 digitos, razon social y direccion fiscal.';
    end if;
  else
    v_cliente_tipo_documento := 'DNI';
    v_cliente_numero_documento := regexp_replace(coalesce(nullif(p_payload ->> 'cliente_numero_documento', ''), v_paciente.dni), '\D', '', 'g');
    v_cliente_denominacion := trim(v_paciente.nombres || ' ' || v_paciente.apellidos);
    v_cliente_direccion := coalesce(nullif(trim(coalesce(p_payload ->> 'cliente_direccion', '')), ''), v_paciente.direccion);

    if length(v_cliente_numero_documento) <> 8 then
      raise exception 'Para boleta el DNI del paciente debe tener 8 digitos.';
    end if;
  end if;

  v_serie := coalesce(
    nullif(trim(p_payload ->> 'serie'), ''),
    case when v_tipo_comprobante = 'FACTURA' then 'FFF1' else 'BBB1' end
  );

  v_subtotal := round(v_monto / 1.18, 2);
  v_igv := round(v_monto - v_subtotal, 2);

  perform pg_advisory_xact_lock(hashtext('clinica:comprobantes:' || v_tipo_comprobante || ':' || v_serie));

  select coalesce(max(numero), 0) + 1
  into v_numero
  from public.comprobantes
  where tipo_comprobante = v_tipo_comprobante
    and serie = v_serie;

  insert into public.pagos(
    cita_id,
    paciente_id,
    concepto,
    monto,
    metodo_pago,
    estado,
    fecha_pago
  )
  values(
    v_cita.id,
    v_cita.paciente_id,
    v_concepto,
    round(v_monto, 2),
    v_metodo_pago,
    v_estado_pago,
    v_fecha_pago
  )
  returning id into v_pago_id;

  v_preview := jsonb_build_object(
    'clinica', jsonb_build_object(
      'nombre', coalesce(nullif(p_payload ->> 'clinica_nombre', ''), 'Clinica Versalles'),
      'ruc', nullif(p_payload ->> 'clinica_ruc', '')
    ),
    'tipo_comprobante', v_tipo_comprobante,
    'serie', v_serie,
    'numero', v_numero,
    'fecha_emision', v_fecha_pago,
    'estado', 'PENDIENTE DE EMISION',
    'advertencia', 'Vista previa sin validez tributaria',
    'cliente', jsonb_build_object(
      'tipo_documento', v_cliente_tipo_documento,
      'numero_documento', v_cliente_numero_documento,
      'denominacion', v_cliente_denominacion,
      'direccion', v_cliente_direccion
    ),
    'pago', jsonb_build_object(
      'id', v_pago_id,
      'concepto', v_concepto,
      'metodo_pago', v_metodo_pago,
      'subtotal', v_subtotal,
      'igv', v_igv,
      'total', round(v_monto, 2)
    ),
    'cita', jsonb_build_object(
      'id', v_cita.id,
      'fecha', v_cita.fecha,
      'hora', v_cita.hora,
      'tipo_consulta', v_cita.tipo_consulta,
      'especialidad', v_medico.especialidad,
      'medico', case when v_medico.id is null then null else trim(v_medico.nombres || ' ' || v_medico.apellidos) end
    )
  );

  insert into public.comprobantes(
    pago_id,
    cita_id,
    paciente_id,
    tipo_comprobante,
    serie,
    numero,
    estado,
    proveedor,
    cliente_tipo_documento,
    cliente_numero_documento,
    cliente_denominacion,
    cliente_direccion,
    preview_data
  )
  values(
    v_pago_id,
    v_cita.id,
    v_cita.paciente_id,
    v_tipo_comprobante,
    v_serie,
    v_numero,
    'PENDIENTE_EMISION',
    'LOCAL',
    v_cliente_tipo_documento,
    v_cliente_numero_documento,
    v_cliente_denominacion,
    v_cliente_direccion,
    v_preview
  )
  returning id into v_comprobante_id;

  insert into public.facturacion_eventos(
    comprobante_id,
    pago_id,
    cita_id,
    paciente_id,
    proveedor,
    operacion,
    estado,
    mensaje,
    detalle
  )
  values(
    v_comprobante_id,
    v_pago_id,
    v_cita.id,
    v_cita.paciente_id,
    'LOCAL',
    'previsualizacion',
    'PENDIENTE_EMISION',
    'Comprobante preparado para emision.',
    v_preview
  );

  return jsonb_build_object(
    'pago_id', v_pago_id,
    'comprobante_id', v_comprobante_id,
    'serie', v_serie,
    'numero', v_numero,
    'estado', 'PENDIENTE_EMISION',
    'subtotal', v_subtotal,
    'igv', v_igv,
    'total', round(v_monto, 2),
    'preview_data', v_preview
  );
end;
$$;

create or replace function public.registrar_evento_facturacion(
  p_comprobante_id uuid,
  p_operacion text,
  p_estado text,
  p_mensaje text default null,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comprobante record;
begin
  if v_user_id is null then
    raise exception 'No autorizado.';
  end if;

  if public.get_current_user_role() not in ('admin', 'recepcionista') then
    raise exception 'Tu rol no permite operar comprobantes.';
  end if;

  select c.*
  into v_comprobante
  from public.comprobantes c
  where c.id = p_comprobante_id;

  if not found then
    raise exception 'Comprobante no encontrado.';
  end if;

  insert into public.facturacion_eventos(
    comprobante_id,
    pago_id,
    cita_id,
    paciente_id,
    proveedor,
    operacion,
    estado,
    mensaje,
    detalle
  )
  values(
    v_comprobante.id,
    v_comprobante.pago_id,
    v_comprobante.cita_id,
    v_comprobante.paciente_id,
    'NUBEFACT',
    p_operacion,
    p_estado,
    p_mensaje,
    p_detalle
  );
end;
$$;

create or replace function public.marcar_comprobante_nubefact(
  p_comprobante_id uuid,
  p_operacion text,
  p_estado text,
  p_respuesta jsonb,
  p_mensaje text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comprobante record;
  v_estado text := upper(coalesce(p_estado, 'PENDIENTE_REINTENTO'));
begin
  if v_user_id is null then
    raise exception 'No autorizado.';
  end if;

  if public.get_current_user_role() not in ('admin', 'recepcionista') then
    raise exception 'Tu rol no permite operar comprobantes.';
  end if;

  select c.*
  into v_comprobante
  from public.comprobantes c
  where c.id = p_comprobante_id;

  if not found then
    raise exception 'Comprobante no encontrado.';
  end if;

  update public.comprobantes
  set
    estado = v_estado,
    proveedor = 'NUBEFACT',
    proveedor_id = coalesce(p_respuesta ->> 'enlace', p_respuesta ->> 'enlace_del_pdf', proveedor_id),
    pdf_url = coalesce(p_respuesta ->> 'enlace_del_pdf', pdf_url),
    xml_url = coalesce(p_respuesta ->> 'enlace_del_xml', xml_url),
    cdr_url = coalesce(p_respuesta ->> 'enlace_del_cdr', cdr_url),
    estado_sunat = coalesce(
      p_respuesta ->> 'estado_sunat',
      case
        when p_respuesta ->> 'aceptada_por_sunat' = 'true' then 'ACEPTADA'
        when p_respuesta ? 'errors' then 'ERROR'
        else estado_sunat
      end
    ),
    respuesta_sunat = coalesce(p_respuesta, respuesta_sunat),
    sunat_description = coalesce(p_respuesta ->> 'sunat_description', sunat_description),
    sunat_note = coalesce(p_respuesta ->> 'sunat_note', sunat_note),
    sunat_responsecode = coalesce(p_respuesta ->> 'sunat_responsecode', sunat_responsecode),
    sunat_soap_error = coalesce(p_respuesta ->> 'sunat_soap_error', sunat_soap_error),
    cadena_para_codigo_qr = coalesce(p_respuesta ->> 'cadena_para_codigo_qr', cadena_para_codigo_qr),
    codigo_hash = coalesce(p_respuesta ->> 'codigo_hash', codigo_hash),
    error_mensaje = p_mensaje,
    updated_at = now()
  where id = p_comprobante_id;

  insert into public.facturacion_eventos(
    comprobante_id,
    pago_id,
    cita_id,
    paciente_id,
    proveedor,
    operacion,
    estado,
    mensaje,
    detalle
  )
  values(
    v_comprobante.id,
    v_comprobante.pago_id,
    v_comprobante.cita_id,
    v_comprobante.paciente_id,
    'NUBEFACT',
    p_operacion,
    v_estado,
    p_mensaje,
    p_respuesta
  );

  return jsonb_build_object(
    'comprobante_id', p_comprobante_id,
    'estado', v_estado
  );
end;
$$;

create or replace function public.marcar_comprobante_anulado_nubefact(
  p_comprobante_id uuid,
  p_respuesta jsonb,
  p_mensaje text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comprobante record;
begin
  if v_user_id is null then
    raise exception 'No autorizado.';
  end if;

  if public.get_current_user_role() not in ('admin', 'recepcionista') then
    raise exception 'Tu rol no permite anular comprobantes.';
  end if;

  select c.*
  into v_comprobante
  from public.comprobantes c
  where c.id = p_comprobante_id;

  if not found then
    raise exception 'Comprobante no encontrado.';
  end if;

  update public.comprobantes
  set
    estado = 'ANULADO_NUBEFACT',
    ticket_anulacion = coalesce(p_respuesta ->> 'ticket', p_respuesta ->> 'ticket_anulacion', ticket_anulacion),
    respuesta_sunat = coalesce(p_respuesta, respuesta_sunat),
    error_mensaje = p_mensaje,
    updated_at = now()
  where id = p_comprobante_id;

  insert into public.facturacion_eventos(
    comprobante_id,
    pago_id,
    cita_id,
    paciente_id,
    proveedor,
    operacion,
    estado,
    mensaje,
    detalle
  )
  values(
    v_comprobante.id,
    v_comprobante.pago_id,
    v_comprobante.cita_id,
    v_comprobante.paciente_id,
    'NUBEFACT',
    'anulacion',
    'ANULADO_NUBEFACT',
    p_mensaje,
    p_respuesta
  );

  return jsonb_build_object(
    'comprobante_id', p_comprobante_id,
    'estado', 'ANULADO_NUBEFACT'
  );
end;
$$;

revoke all on function public.registrar_pago_con_comprobante(jsonb) from public, anon, authenticated;
revoke all on function public.registrar_evento_facturacion(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.marcar_comprobante_nubefact(uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.marcar_comprobante_anulado_nubefact(uuid, jsonb, text) from public, anon, authenticated;

grant execute on function public.registrar_pago_con_comprobante(jsonb) to authenticated;
grant execute on function public.registrar_evento_facturacion(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.marcar_comprobante_nubefact(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.marcar_comprobante_anulado_nubefact(uuid, jsonb, text) to authenticated;

select pg_notify('pgrst', 'reload schema');
