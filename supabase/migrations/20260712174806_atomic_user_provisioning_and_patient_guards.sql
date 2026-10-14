-- Provisioning data never reaches Auth metadata. Only a one-time opaque token does.
create table if not exists public.pending_user_provisioning (
  token uuid primary key,
  rol text not null check (rol in ('admin', 'recepcionista', 'medico', 'paciente')),
  nombre text not null,
  email citext not null,
  telefono text,
  activo boolean not null default true,
  paciente_id uuid references public.pacientes(id) on delete restrict,
  paciente_nombres text,
  paciente_apellidos text,
  paciente_dni text check (paciente_dni is null or paciente_dni ~ '^[0-9]{8}$'),
  paciente_telefono text check (paciente_telefono is null or paciente_telefono ~ '^[0-9]{7,15}$'),
  paciente_direccion text,
  paciente_fecha_nacimiento date,
  medico_nombres text,
  medico_apellidos text,
  medico_especialidad text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  check (
    (rol <> 'paciente')
    or paciente_id is not null
    or (paciente_nombres is not null and paciente_apellidos is not null and paciente_dni is not null and paciente_telefono is not null)
  ),
  check ((rol <> 'medico') or (medico_nombres is not null and medico_apellidos is not null and medico_especialidad is not null))
);

alter table public.pending_user_provisioning enable row level security;
revoke all on table public.pending_user_provisioning from public, anon, authenticated;

create or replace function public.provision_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request public.pending_user_provisioning%rowtype;
  provisioning_token uuid;
begin
  if new.raw_user_meta_data ? 'provisioning_token' then
    provisioning_token := (new.raw_user_meta_data ->> 'provisioning_token')::uuid;
  else
    return new;
  end if;

  delete from public.pending_user_provisioning
  where token = provisioning_token and expires_at > now()
  returning * into request;

  if not found then
    raise exception 'Solicitud de alta inexistente o expirada.';
  end if;
  if new.email is distinct from request.email::text then
    raise exception 'El correo de Auth no coincide con la solicitud de alta.';
  end if;

  insert into public.usuarios (id, nombre, email, telefono, rol, activo)
  values (new.id, request.nombre, request.email, request.telefono, request.rol, request.activo);

  if request.rol = 'paciente' and request.paciente_id is not null then
    update public.pacientes
    set usuario_id = new.id, email = request.email, telefono = coalesce(request.telefono, telefono), activo = request.activo
    where id = request.paciente_id and usuario_id is null;
    if not found then
      raise exception 'La ficha de paciente no existe o ya tiene una cuenta vinculada.';
    end if;
  elsif request.rol = 'paciente' then
    insert into public.pacientes (usuario_id, nombres, apellidos, dni, telefono, email, direccion, fecha_nacimiento, activo)
    values (new.id, request.paciente_nombres, request.paciente_apellidos, request.paciente_dni,
            request.paciente_telefono, request.email, request.paciente_direccion, request.paciente_fecha_nacimiento, request.activo);
  elsif request.rol = 'medico' then
    insert into public.medicos (usuario_id, nombres, apellidos, especialidad, telefono, email, activo)
    values (new.id, request.medico_nombres, request.medico_apellidos, request.medico_especialidad,
            coalesce(request.telefono, '0000000'), request.email, request.activo);
  end if;
  return new;
end;
$$;

revoke all on function public.provision_auth_user() from public, anon, authenticated;
drop trigger if exists provision_auth_user on auth.users;
create trigger provision_auth_user
after insert on auth.users
for each row execute function public.provision_auth_user();

create or replace function public.protect_paciente_sensitive_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select auth.uid()) = old.usuario_id
     and (to_jsonb(new) - array['nombres', 'apellidos', 'telefono', 'email', 'direccion', 'fecha_nacimiento', 'grupo_sanguineo', 'alergias', 'antecedentes', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['nombres', 'apellidos', 'telefono', 'email', 'direccion', 'fecha_nacimiento', 'grupo_sanguineo', 'alergias', 'antecedentes', 'updated_at']) then
    raise exception 'No tienes permiso para modificar campos clinicos o administrativos.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_paciente_sensitive_fields on public.pacientes;
create trigger protect_paciente_sensitive_fields
before update on public.pacientes
for each row execute function public.protect_paciente_sensitive_fields();

drop policy if exists chat_ai_usage_backend_only on public.chat_ai_usage;
create policy chat_ai_usage_backend_only on public.chat_ai_usage
as restrictive for all to authenticated
using (false) with check (false);

revoke all on table public.chat_ai_usage from anon, authenticated;
