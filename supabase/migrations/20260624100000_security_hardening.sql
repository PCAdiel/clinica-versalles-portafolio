-- Restrict internal helpers and trigger functions. PostgreSQL grants EXECUTE
-- to PUBLIC by default, including SECURITY DEFINER functions.
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

-- These helpers are needed by authenticated RLS policies.
grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_recepcionista() to authenticated;
grant execute on function public.is_medico() to authenticated;
grant execute on function public.is_paciente() to authenticated;
grant execute on function public.get_current_paciente_id() to authenticated;
grant execute on function public.get_current_medico_id() to authenticated;
