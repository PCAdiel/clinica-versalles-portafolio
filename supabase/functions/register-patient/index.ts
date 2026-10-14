import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Metodo no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anonKey || !serviceKey) return json({ error: 'Faltan variables de entorno de Supabase.' }, 500);

  let payload: Record<string, unknown>;
  try { payload = await req.json() as Record<string, unknown>; } catch { return json({ error: 'El cuerpo no es JSON valido.' }, 400); }
  const nombres = String(payload.nombres ?? '').trim();
  const apellidos = String(payload.apellidos ?? '').trim();
  const dni = String(payload.dni ?? '').trim();
  const telefono = String(payload.telefono ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');
  const direccion = String(payload.direccion ?? '').trim() || null;
  const fechaNacimiento = String(payload.fechaNacimiento ?? '').trim() || null;
  if (!nombres || !apellidos || !/^\d{8}$/.test(dni) || !/^\d{7,15}$/.test(telefono) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Los datos de paciente no son validos.' }, 400);
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json({ error: 'La contrasena debe tener al menos 8 caracteres, una letra y un numero.' }, 400);

  const admin = createClient(url, serviceKey);
  const publicClient = createClient(url, anonKey);
  const token = crypto.randomUUID();
  const { error: pendingError } = await admin.from('pending_user_provisioning').insert({
    token, rol: 'paciente', nombre: `${nombres} ${apellidos}`, email, activo: true,
    paciente_nombres: nombres, paciente_apellidos: apellidos, paciente_dni: dni,
    paciente_telefono: telefono, paciente_direccion: direccion, paciente_fecha_nacimiento: fechaNacimiento
  });
  if (pendingError) return json({ error: 'No se pudo preparar el registro.' }, 500);
  const { data, error } = await publicClient.auth.signUp({ email, password, options: { data: { provisioning_token: token } } });
  if (error || !data.user) {
    await admin.from('pending_user_provisioning').delete().eq('token', token);
    return json({ error: error?.message ?? 'No se pudo crear la cuenta.' }, 400);
  }
  return json({ userId: data.user.id }, 201);
});
