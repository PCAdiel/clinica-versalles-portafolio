create table if not exists public.chat_ai_usage (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  provider text not null check (provider in ('demo', 'openai', 'gemini')),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_ai_usage_usuario_created_at
  on public.chat_ai_usage(usuario_id, created_at desc);

alter table public.chat_ai_usage enable row level security;

grant select, insert, update, delete on public.chat_ai_usage to authenticated;

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

revoke all on function public.enforce_historial_cita_match() from public, anon, authenticated;
