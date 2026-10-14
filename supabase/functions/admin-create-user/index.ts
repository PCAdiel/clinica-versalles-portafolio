import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

type RolUsuario = 'admin' | 'recepcionista' | 'medico' | 'paciente';

interface CreateUserRequest {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  rol: RolUsuario;
  activo?: boolean;
  pacienteId?: string;
  especialidad?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo no permitido.' }, 405);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: 'Faltan variables de entorno de Supabase.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: authUser, error: authError } = await userClient.auth.getUser();

  if (authError || !authUser.user) {
    return json({ error: 'No autenticado.' }, 401);
  }

  const { data: callerProfile, error: callerError } = await adminClient
    .from('usuarios')
    .select('rol,activo')
    .eq('id', authUser.user.id)
    .single();

  if (callerError || callerProfile?.rol !== 'admin' || callerProfile.activo !== true) {
    return json({ error: 'Solo el administrador puede crear usuarios.' }, 403);
  }

  let payload: Partial<CreateUserRequest>;

  try {
    payload = (await req.json()) as Partial<CreateUserRequest>;
  } catch {
    return json({ error: 'El cuerpo de la solicitud no es JSON valido.' }, 400);
  }
  const nombre = payload.nombre?.trim() ?? '';
  const email = payload.email?.trim().toLowerCase() ?? '';
  const password = payload.password ?? '';
  const telefono = payload.telefono?.trim() || null;
  const rol = payload.rol;
  const activo = payload.activo ?? true;

  if (!nombre || !email || !password || !rol) {
    return json({ error: 'Completa nombre, email, contrasena y rol.' }, 400);
  }

  if (nombre.length > 120 || email.length > 254 || (telefono?.length ?? 0) > 15) {
    return json({ error: 'Uno de los campos supera la longitud permitida.' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'El correo no tiene un formato valido.' }, 400);
  }

  if (password.length < 8) {
    return json({ error: 'La contrasena debe tener al menos 8 caracteres.' }, 400);
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return json({ error: 'La contrasena debe incluir al menos una letra y un numero.' }, 400);
  }

  if (!['admin', 'recepcionista', 'medico', 'paciente'].includes(rol)) {
    return json({ error: 'Rol invalido.' }, 400);
  }

  if (rol === 'paciente' && !payload.pacienteId?.trim()) {
    return json({ error: 'Selecciona una ficha de paciente existente.' }, 400);
  }

  if (rol === 'medico' && !payload.especialidad?.trim()) {
    return json({ error: 'La especialidad es obligatoria para usuarios medico.' }, 400);
  }

  const partesNombre = nombre.split(/\s+/).filter(Boolean);
  const nombres = partesNombre.slice(0, Math.max(1, partesNombre.length - 1)).join(' ');
  const apellidos = partesNombre.length > 1 ? partesNombre.slice(-1).join(' ') : '-';
  const token = crypto.randomUUID();

  const { error: pendingError } = await adminClient.from('pending_user_provisioning').insert({
    token,
    rol,
    nombre,
    email,
    telefono,
    activo,
    paciente_id: rol === 'paciente' ? payload.pacienteId?.trim() : null,
    medico_nombres: rol === 'medico' ? nombres : null,
    medico_apellidos: rol === 'medico' ? apellidos : null,
    medico_especialidad: rol === 'medico' ? payload.especialidad?.trim() : null
  });

  if (pendingError) {
    return json({ error: 'No se pudo preparar el alta de usuario.' }, 500);
  }

  const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { provisioning_token: token }
  });

  if (createAuthError || !createdAuth.user) {
    await adminClient.from('pending_user_provisioning').delete().eq('token', token);
    return json({ error: createAuthError?.message ?? 'No se pudo crear el usuario en Auth.' }, 400);
  }

  const userId = createdAuth.user.id;

  const { data: usuario, error: usuarioError } = await adminClient
    .from('usuarios').select('*').eq('id', userId).single();
  if (usuarioError || !usuario) return json({ error: 'La cuenta fue creada, pero no se pudo recuperar su perfil.' }, 500);

  return json({ usuario }, 201);
});
