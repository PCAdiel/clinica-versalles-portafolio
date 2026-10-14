create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email citext not null unique,
  telefono text,
  rol text not null check (rol in ('admin', 'recepcionista', 'medico', 'paciente')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activo boolean not null default true
);

create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  nombres text not null,
  apellidos text not null,
  dni text not null unique check (dni ~ '^[0-9]{8}$'),
  telefono text not null check (telefono ~ '^[0-9]{7,15}$'),
  email citext,
  direccion text,
  fecha_nacimiento date,
  grupo_sanguineo text,
  alergias text,
  antecedentes text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medicos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  nombres text not null,
  apellidos text not null,
  especialidad text not null,
  telefono text not null check (telefono ~ '^[0-9]{7,15}$'),
  email citext not null unique,
  colegiatura text,
  horario text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.horarios_medicos (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medicos(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  check (hora_inicio < hora_fin)
);

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  medico_id uuid not null references public.medicos(id) on delete restrict,
  fecha date not null,
  hora time not null,
  motivo text,
  tipo_consulta text,
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'cancelada', 'atendida', 'no_asistio')),
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint citas_medico_fecha_hora_unique unique (medico_id, fecha, hora)
);

create table if not exists public.historial_clinico (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  medico_id uuid not null references public.medicos(id) on delete restrict,
  diagnostico text not null,
  tratamiento text not null,
  observaciones text,
  fecha date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  cita_id uuid not null references public.citas(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  concepto text,
  monto numeric(10, 2) not null check (monto > 0),
  metodo_pago text not null check (metodo_pago in ('Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'anulado')),
  fecha_pago date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  titulo text not null,
  mensaje text not null,
  tipo text not null default 'sistema' check (tipo in ('cita', 'pago', 'historial', 'sistema')),
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_ai_usage (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  provider text not null check (provider in ('demo', 'openai', 'gemini')),
  created_at timestamptz not null default now()
);

alter table public.citas drop constraint if exists citas_fecha_check;
alter table public.pagos drop constraint if exists pagos_monto_check;
alter table public.pagos drop constraint if exists pagos_monto_positive;
alter table public.pagos add constraint pagos_monto_positive check (monto > 0);

create index if not exists idx_usuarios_rol on public.usuarios(rol);
create index if not exists idx_pacientes_usuario_id on public.pacientes(usuario_id);
create unique index if not exists idx_pacientes_usuario_id_unique
  on public.pacientes(usuario_id)
  where usuario_id is not null;
create index if not exists idx_pacientes_dni on public.pacientes(dni);
create index if not exists idx_medicos_usuario_id on public.medicos(usuario_id);
create index if not exists idx_medicos_especialidad on public.medicos(especialidad);
create index if not exists idx_horarios_medico on public.horarios_medicos(medico_id, dia_semana);
create index if not exists idx_citas_paciente on public.citas(paciente_id);
create index if not exists idx_citas_medico_fecha on public.citas(medico_id, fecha);
create index if not exists idx_citas_estado on public.citas(estado);
create index if not exists idx_historial_paciente on public.historial_clinico(paciente_id);
create index if not exists idx_historial_medico on public.historial_clinico(medico_id);
create unique index if not exists idx_historial_cita_unique on public.historial_clinico(cita_id);
create index if not exists idx_pagos_paciente on public.pagos(paciente_id);
create index if not exists idx_pagos_estado on public.pagos(estado);
create index if not exists idx_notificaciones_usuario_leida on public.notificaciones(usuario_id, leida, created_at desc);
create index if not exists idx_chat_ai_usage_usuario_created_at on public.chat_ai_usage(usuario_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_usuarios_updated_at on public.usuarios;
create trigger set_usuarios_updated_at
before update on public.usuarios
for each row execute function public.set_updated_at();

drop trigger if exists set_pacientes_updated_at on public.pacientes;
create trigger set_pacientes_updated_at
before update on public.pacientes
for each row execute function public.set_updated_at();

drop trigger if exists set_medicos_updated_at on public.medicos;
create trigger set_medicos_updated_at
before update on public.medicos
for each row execute function public.set_updated_at();

drop trigger if exists set_citas_updated_at on public.citas;
create trigger set_citas_updated_at
before update on public.citas
for each row execute function public.set_updated_at();

drop trigger if exists set_historial_updated_at on public.historial_clinico;
create trigger set_historial_updated_at
before update on public.historial_clinico
for each row execute function public.set_updated_at();

drop trigger if exists set_pagos_updated_at on public.pagos;
create trigger set_pagos_updated_at
before update on public.pagos
for each row execute function public.set_updated_at();

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.rol
  from public.usuarios u
  where u.id = auth.uid()
    and u.activo = true
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'admin'
$$;

create or replace function public.is_recepcionista()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'recepcionista'
$$;

create or replace function public.is_medico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'medico'
$$;

create or replace function public.is_paciente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'paciente'
$$;

create or replace function public.get_current_paciente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.pacientes p
  where p.usuario_id = auth.uid()
    and p.activo = true
  limit 1
$$;

create or replace function public.get_current_medico_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.medicos m
  where m.usuario_id = auth.uid()
    and m.activo = true
  limit 1
$$;

create or replace function public.enforce_cita_business_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.fecha < current_date then
      raise exception 'La fecha de la cita no puede estar en el pasado.';
    end if;

    if new.estado not in ('pendiente', 'confirmada') then
      raise exception 'Una cita nueva solo puede iniciar como pendiente o confirmada.';
    end if;

    if public.is_paciente()
      and not public.is_admin()
      and not public.is_recepcionista()
      and new.estado <> 'pendiente' then
      raise exception 'El paciente solo puede crear citas pendientes.';
    end if;

    if new.created_by is null then
      new.created_by = auth.uid();
    end if;

    return new;
  end if;

  if old.estado = 'atendida' then
    raise exception 'No se puede modificar una cita atendida.';
  end if;

  if new.fecha is distinct from old.fecha and new.fecha < current_date then
    raise exception 'La fecha de la cita no puede estar en el pasado.';
  end if;

  if public.is_paciente()
    and not public.is_admin()
    and not public.is_recepcionista() then
    if new.estado <> 'cancelada'
      or old.estado not in ('pendiente', 'confirmada')
      or new.paciente_id is distinct from old.paciente_id
      or new.medico_id is distinct from old.medico_id
      or new.fecha is distinct from old.fecha
      or new.hora is distinct from old.hora
      or new.motivo is distinct from old.motivo
      or new.tipo_consulta is distinct from old.tipo_consulta
      or new.mensaje is distinct from old.mensaje
      or new.created_by is distinct from old.created_by then
      raise exception 'El paciente solo puede cancelar sus propias citas pendientes o confirmadas.';
    end if;
  end if;

  if public.is_medico()
    and not public.is_admin()
    and not public.is_recepcionista() then
    if new.estado not in ('atendida', 'no_asistio')
      or new.paciente_id is distinct from old.paciente_id
      or new.medico_id is distinct from old.medico_id
      or new.fecha is distinct from old.fecha
      or new.hora is distinct from old.hora
      or new.motivo is distinct from old.motivo
      or new.tipo_consulta is distinct from old.tipo_consulta
      or new.mensaje is distinct from old.mensaje
      or new.created_by is distinct from old.created_by then
      raise exception 'El medico solo puede actualizar el estado de atencion de sus citas.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_cita_business_rules on public.citas;
create trigger enforce_cita_business_rules
before insert or update on public.citas
for each row execute function public.enforce_cita_business_rules();

create or replace function public.enforce_historial_cita_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cita_paciente_id uuid;
  cita_medico_id uuid;
begin
  if tg_op = 'UPDATE'
    and not public.is_admin()
    and (
      new.cita_id is distinct from old.cita_id
      or new.paciente_id is distinct from old.paciente_id
      or new.medico_id is distinct from old.medico_id
      or new.diagnostico is distinct from old.diagnostico
      or new.tratamiento is distinct from old.tratamiento
      or new.fecha is distinct from old.fecha
    ) then
    raise exception 'Solo el administrador puede modificar campos clinicos o reasignar un historial.';
  end if;

  select c.paciente_id, c.medico_id
  into cita_paciente_id, cita_medico_id
  from public.citas c
  where c.id = new.cita_id;

  if not found then
    raise exception 'La cita relacionada no existe.';
  end if;

  if new.paciente_id is distinct from cita_paciente_id
    or new.medico_id is distinct from cita_medico_id then
    raise exception 'El historial debe coincidir con el paciente y medico de la cita.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_historial_cita_match on public.historial_clinico;
create trigger enforce_historial_cita_match
before insert or update on public.historial_clinico
for each row execute function public.enforce_historial_cita_match();

create or replace function public.crear_notificacion(
  p_usuario_id uuid,
  p_titulo text,
  p_mensaje text,
  p_tipo text default 'sistema'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario_id is null then
    return;
  end if;

  insert into public.notificaciones (usuario_id, titulo, mensaje, tipo)
  values (p_usuario_id, p_titulo, p_mensaje, p_tipo);
end;
$$;

create or replace function public.notificar_cita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paciente_usuario_id uuid;
  medico_usuario_id uuid;
  estado_mensaje text;
begin
  select p.usuario_id into paciente_usuario_id
  from public.pacientes p
  where p.id = new.paciente_id;

  select m.usuario_id into medico_usuario_id
  from public.medicos m
  where m.id = new.medico_id;

  if tg_op = 'INSERT' then
    perform public.crear_notificacion(
      paciente_usuario_id,
      'Cita registrada',
      'Tu cita fue registrada para el ' || new.fecha || ' a las ' || new.hora || '.',
      'cita'
    );
    perform public.crear_notificacion(
      medico_usuario_id,
      'Nueva cita asignada',
      'Tienes una cita asignada para el ' || new.fecha || ' a las ' || new.hora || '.',
      'cita'
    );
    return new;
  end if;

  if new.estado is distinct from old.estado then
    estado_mensaje = 'La cita del ' || new.fecha || ' a las ' || new.hora || ' cambio a estado ' || new.estado || '.';
    perform public.crear_notificacion(paciente_usuario_id, 'Estado de cita actualizado', estado_mensaje, 'cita');
    perform public.crear_notificacion(medico_usuario_id, 'Estado de cita actualizado', estado_mensaje, 'cita');
  end if;

  return new;
end;
$$;

drop trigger if exists notificar_cita on public.citas;
create trigger notificar_cita
after insert or update on public.citas
for each row execute function public.notificar_cita();

create or replace function public.notificar_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paciente_usuario_id uuid;
begin
  select p.usuario_id into paciente_usuario_id
  from public.pacientes p
  where p.id = new.paciente_id;

  perform public.crear_notificacion(
    paciente_usuario_id,
    'Pago registrado',
    'Se registro un pago de S/ ' || new.monto || ' con estado ' || new.estado || '.',
    'pago'
  );

  return new;
end;
$$;

drop trigger if exists notificar_pago on public.pagos;
create trigger notificar_pago
after insert on public.pagos
for each row execute function public.notificar_pago();

grant usage on schema public to anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.get_current_user_role() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_recepcionista() from public, anon, authenticated;
revoke all on function public.is_medico() from public, anon, authenticated;
revoke all on function public.is_paciente() from public, anon, authenticated;
revoke all on function public.get_current_paciente_id() from public, anon, authenticated;
revoke all on function public.get_current_medico_id() from public, anon, authenticated;
revoke all on function public.enforce_cita_business_rules() from public, anon, authenticated;
revoke all on function public.enforce_historial_cita_match() from public, anon, authenticated;
revoke all on function public.crear_notificacion(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.notificar_cita() from public, anon, authenticated;
revoke all on function public.notificar_pago() from public, anon, authenticated;
grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_recepcionista() to authenticated;
grant execute on function public.is_medico() to authenticated;
grant execute on function public.is_paciente() to authenticated;
grant execute on function public.get_current_paciente_id() to authenticated;
grant execute on function public.get_current_medico_id() to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.usuarios enable row level security;
alter table public.especialidades enable row level security;
alter table public.pacientes enable row level security;
alter table public.medicos enable row level security;
alter table public.horarios_medicos enable row level security;
alter table public.citas enable row level security;
alter table public.historial_clinico enable row level security;
alter table public.pagos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.chat_ai_usage enable row level security;

drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
for select
using (
  id = auth.uid()
  or public.is_admin()
  or public.is_recepcionista()
);

drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
for insert
with check (
  public.is_admin()
  or (id = auth.uid() and rol = 'paciente')
);

drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin on public.usuarios
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists usuarios_delete_admin on public.usuarios;
create policy usuarios_delete_admin on public.usuarios
for delete
using (public.is_admin());

drop policy if exists especialidades_select on public.especialidades;
create policy especialidades_select on public.especialidades
for select
using (activo = true or public.is_admin());

drop policy if exists especialidades_write_admin on public.especialidades;
create policy especialidades_write_admin on public.especialidades
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists pacientes_select on public.pacientes;
create policy pacientes_select on public.pacientes
for select
using (
  public.is_admin()
  or public.is_recepcionista()
  or usuario_id = auth.uid()
  or exists (
    select 1
    from public.citas c
    where c.paciente_id = pacientes.id
      and c.medico_id = public.get_current_medico_id()
  )
);

drop policy if exists pacientes_insert on public.pacientes;
create policy pacientes_insert on public.pacientes
for insert
with check (
  public.is_admin()
  or public.is_recepcionista()
  or usuario_id = auth.uid()
);

drop policy if exists pacientes_update on public.pacientes;
create policy pacientes_update on public.pacientes
for update
using (
  public.is_admin()
  or public.is_recepcionista()
  or usuario_id = auth.uid()
)
with check (
  public.is_admin()
  or public.is_recepcionista()
  or usuario_id = auth.uid()
);

drop policy if exists pacientes_delete_admin on public.pacientes;
create policy pacientes_delete_admin on public.pacientes
for delete
using (public.is_admin());

drop policy if exists medicos_select on public.medicos;
create policy medicos_select on public.medicos
for select
using (auth.role() = 'authenticated');

drop policy if exists medicos_write_admin on public.medicos;
create policy medicos_write_admin on public.medicos
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists horarios_select on public.horarios_medicos;
create policy horarios_select on public.horarios_medicos
for select
using (auth.role() = 'authenticated');

drop policy if exists horarios_write_admin on public.horarios_medicos;
create policy horarios_write_admin on public.horarios_medicos
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists citas_select on public.citas;
create policy citas_select on public.citas
for select
using (
  public.is_admin()
  or public.is_recepcionista()
  or paciente_id = public.get_current_paciente_id()
  or medico_id = public.get_current_medico_id()
);

drop policy if exists citas_insert on public.citas;
create policy citas_insert on public.citas
for insert
with check (
  public.is_admin()
  or public.is_recepcionista()
  or (
    public.is_paciente()
    and paciente_id = public.get_current_paciente_id()
    and created_by = auth.uid()
    and estado = 'pendiente'
  )
);

drop policy if exists citas_update on public.citas;
create policy citas_update on public.citas
for update
using (
  public.is_admin()
  or public.is_recepcionista()
  or medico_id = public.get_current_medico_id()
  or paciente_id = public.get_current_paciente_id()
)
with check (
  public.is_admin()
  or public.is_recepcionista()
  or (public.is_medico() and medico_id = public.get_current_medico_id())
  or (public.is_paciente() and paciente_id = public.get_current_paciente_id() and estado = 'cancelada')
);

drop policy if exists citas_delete_admin on public.citas;
create policy citas_delete_admin on public.citas
for delete
using (public.is_admin());

drop policy if exists historial_select on public.historial_clinico;
create policy historial_select on public.historial_clinico
for select
using (
  public.is_admin()
  or medico_id = public.get_current_medico_id()
);

drop policy if exists historial_insert on public.historial_clinico;
create policy historial_insert on public.historial_clinico
for insert
with check (
  public.is_admin()
  or (public.is_medico() and medico_id = public.get_current_medico_id())
);

drop policy if exists historial_update on public.historial_clinico;
create policy historial_update on public.historial_clinico
for update
using (
  public.is_admin()
  or medico_id = public.get_current_medico_id()
)
with check (
  public.is_admin()
  or medico_id = public.get_current_medico_id()
);

drop policy if exists historial_delete_admin on public.historial_clinico;
create policy historial_delete_admin on public.historial_clinico
for delete
using (public.is_admin());

drop policy if exists pagos_select on public.pagos;
create policy pagos_select on public.pagos
for select
using (
  public.is_admin()
  or public.is_recepcionista()
  or paciente_id = public.get_current_paciente_id()
);

drop policy if exists pagos_insert on public.pagos;
create policy pagos_insert on public.pagos
for insert
with check (public.is_admin() or public.is_recepcionista());

drop policy if exists pagos_update on public.pagos;
create policy pagos_update on public.pagos
for update
using (public.is_admin() or public.is_recepcionista())
with check (public.is_admin() or public.is_recepcionista());

drop policy if exists pagos_delete_admin on public.pagos;
create policy pagos_delete_admin on public.pagos
for delete
using (public.is_admin());

drop policy if exists notificaciones_select on public.notificaciones;
create policy notificaciones_select on public.notificaciones
for select
using (usuario_id = auth.uid() or public.is_admin());

drop policy if exists notificaciones_update_own on public.notificaciones;
create policy notificaciones_update_own on public.notificaciones
for update
using (usuario_id = auth.uid() or public.is_admin())
with check (usuario_id = auth.uid() or public.is_admin());

drop policy if exists notificaciones_insert_staff on public.notificaciones;
create policy notificaciones_insert_staff on public.notificaciones
for insert
with check (public.is_admin() or public.is_recepcionista());

drop policy if exists notificaciones_delete_admin on public.notificaciones;
create policy notificaciones_delete_admin on public.notificaciones
for delete
using (public.is_admin());

insert into public.especialidades (nombre, descripcion)
values
  ('Medicina General', 'Atencion medica primaria'),
  ('Pediatria', 'Atencion de ninos y adolescentes'),
  ('Cardiologia', 'Diagnostico y tratamiento cardiovascular'),
  ('Dermatologia', 'Atencion de piel y anexos'),
  ('Traumatologia', 'Lesiones musculoesqueleticas'),
  ('Ginecologia', 'Salud ginecologica'),
  ('Odontologia', 'Salud oral')
on conflict (nombre) do nothing;
