import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

type RolUsuario = 'admin' | 'recepcionista' | 'medico' | 'paciente';

interface ChatRequest {
  mensaje: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const hourlyRequestLimit = Number(Deno.env.get('CHAT_AI_HOURLY_REQUEST_LIMIT') ?? '20');
const dailyRequestLimit = Number(Deno.env.get('CHAT_AI_DAILY_REQUEST_LIMIT') ?? '80');

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
    return json({ error: 'Faltan variables de entorno de Supabase para Chat IA.' }, 500);
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

  const { data: perfil, error: perfilError } = await adminClient
    .from('usuarios')
    .select('id,nombre,email,rol,activo')
    .eq('id', authUser.user.id)
    .single();

  if (perfilError || !perfil?.activo) {
    return json({ error: 'Usuario sin perfil activo.' }, 403);
  }

  let payload: Partial<ChatRequest>;

  try {
    payload = (await req.json()) as Partial<ChatRequest>;
  } catch {
    return json({ error: 'El cuerpo de la solicitud no es JSON valido.' }, 400);
  }
  const mensaje = payload.mensaje?.trim() ?? '';

  if (!mensaje) {
    return json({ error: 'Escribe una pregunta.' }, 400);
  }

  if (mensaje.length > 1200) {
    return json({ error: 'La pregunta es demasiado larga.' }, 400);
  }

  const rateLimit = await verificarRateLimit(adminClient, perfil.id);
  if (!rateLimit.allowed) {
    return json({ error: rateLimit.message }, 429);
  }

  const contexto = await construirContexto(adminClient, perfil.id, perfil.rol as RolUsuario);

  return json({ respuesta: responderModoDemo(perfil.rol as RolUsuario, contexto, mensaje) });
});

async function verificarRateLimit(adminClient: ReturnType<typeof createClient>, usuarioId: string): Promise<{ allowed: boolean; message: string }> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: hourlyCount, error: hourlyError }, { count: dailyCount, error: dailyError }] = await Promise.all([
    adminClient
      .from('chat_ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .gte('created_at', hourAgo),
    adminClient
      .from('chat_ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .gte('created_at', dayAgo)
  ]);

  if (hourlyError || dailyError) {
    return { allowed: false, message: 'No se pudo validar la cuota del chat IA.' };
  }

  if ((hourlyCount ?? 0) >= hourlyRequestLimit) {
    return { allowed: false, message: 'Alcanzaste el limite de consultas por hora. Intenta mas tarde.' };
  }

  if ((dailyCount ?? 0) >= dailyRequestLimit) {
    return { allowed: false, message: 'Alcanzaste el limite diario de consultas del chat IA.' };
  }

  const { error: insertError } = await adminClient
    .from('chat_ai_usage')
    .insert({ usuario_id: usuarioId, provider: 'local' });

  if (insertError) {
    return { allowed: false, message: 'No se pudo registrar el uso del chat IA.' };
  }

  return { allowed: true, message: '' };
}

async function construirContexto(adminClient: ReturnType<typeof createClient>, usuarioId: string, rol: RolUsuario): Promise<string> {
  if (rol === 'paciente') {
    const { data: paciente } = await adminClient
      .from('pacientes')
      .select('id,nombres,apellidos')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!paciente) {
      return 'El usuario paciente no tiene ficha vinculada.';
    }

    const [{ data: citas }, { data: pagos }] = await Promise.all([
      adminClient.from('citas').select('fecha,hora,estado,motivo,medicos(nombres,apellidos,especialidad)').eq('paciente_id', paciente.id).order('fecha', { ascending: true }).limit(10),
      adminClient.from('pagos').select('concepto,monto,estado,fecha_pago').eq('paciente_id', paciente.id).order('fecha_pago', { ascending: false }).limit(10)
    ]);

    return JSON.stringify({ paciente, citas, pagos });
  }

  if (rol === 'medico') {
    const { data: medico } = await adminClient
      .from('medicos')
      .select('id,nombres,apellidos,especialidad')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!medico) {
      return 'El usuario medico no tiene perfil medico vinculado.';
    }

    const [{ data: citas }, { data: historiales }] = await Promise.all([
      adminClient.from('citas').select('fecha,hora,estado,motivo,pacientes(nombres,apellidos)').eq('medico_id', medico.id).order('fecha', { ascending: true }).limit(12),
      adminClient.from('historial_clinico').select('fecha,diagnostico,tratamiento,pacientes(nombres,apellidos)').eq('medico_id', medico.id).order('fecha', { ascending: false }).limit(8)
    ]);

    return JSON.stringify({ medico, citas, historiales });
  }

  if (rol === 'recepcionista') {
    const [{ data: citas }, { data: pacientes }, { data: pagos }] = await Promise.all([
      adminClient.from('citas').select('fecha,hora,estado,motivo,pacientes(nombres,apellidos),medicos(nombres,apellidos,especialidad)').order('fecha', { ascending: true }).limit(15),
      adminClient.from('pacientes').select('nombres,apellidos,activo').order('created_at', { ascending: false }).limit(10),
      adminClient.from('pagos').select('concepto,monto,estado,fecha_pago,pacientes(nombres,apellidos)').order('fecha_pago', { ascending: false }).limit(10)
    ]);

    return JSON.stringify({ citas, pacientes, pagos });
  }

  const [{ data: citas }, { data: pacientes }, { data: medicos }, { data: pagos }] = await Promise.all([
    adminClient.from('citas').select('fecha,hora,estado,pacientes(nombres,apellidos),medicos(nombres,apellidos,especialidad)').order('fecha', { ascending: true }).limit(15),
    adminClient.from('pacientes').select('nombres,apellidos,activo').order('created_at', { ascending: false }).limit(10),
    adminClient.from('medicos').select('nombres,apellidos,especialidad,activo').order('apellidos', { ascending: true }).limit(10),
    adminClient.from('pagos').select('concepto,monto,estado,fecha_pago').order('fecha_pago', { ascending: false }).limit(10)
  ]);

  return JSON.stringify({ citas, pacientes, medicos, pagos });
}

function responderModoDemo(rol: RolUsuario, contextoSerializado: string, mensaje: string): string {
  let contexto: any = {};

  try {
    contexto = JSON.parse(contextoSerializado);
  } catch {
    return `${contextoSerializado}\n\nEstoy en modo local, asi que respondo solo con los datos disponibles en el sistema.`;
  }

  const pregunta = mensaje.toLowerCase();

  if (pregunta.includes('cita')) {
    return resumirCitas(contexto.citas ?? []);
  }

  if (pregunta.includes('pago') || pregunta.includes('deuda') || pregunta.includes('monto')) {
    return resumirPagos(contexto.pagos ?? []);
  }

  if (pregunta.includes('paciente')) {
    return resumirPacientes(rol, contexto);
  }

  if (pregunta.includes('medico') || pregunta.includes('doctor')) {
    return resumirMedicos(contexto.medicos ?? [], contexto.medico);
  }

  if (pregunta.includes('historial') || pregunta.includes('diagnostico') || pregunta.includes('tratamiento')) {
    return resumirHistoriales(contexto.historiales ?? []);
  }

  return [
    'Soy la IA local integrada de la Clinica Versalles.',
    'Puedo resumir citas, pagos, pacientes, medicos e historiales segun tu rol.',
    rol === 'paciente' ? 'Como paciente, solo veo informacion vinculada a tu ficha.' : '',
    rol === 'medico' ? 'Como medico, solo veo tus citas e historiales vinculados.' : '',
    rol === 'admin' || rol === 'recepcionista' ? 'Tu rol tiene una vista operativa mas amplia del sistema.' : ''
  ].filter(Boolean).join(' ');
}

function resumirCitas(citas: any[]): string {
  if (!citas.length) {
    return 'No encontre citas registradas en el contexto permitido para tu rol.';
  }

  const pendientes = citas.filter(cita => ['pendiente', 'confirmada', 'programada'].includes(String(cita.estado).toLowerCase()));
  const base = pendientes.length ? pendientes : citas;
  const lineas = base.slice(0, 5).map(cita => {
    const paciente = cita.pacientes ? `Paciente: ${nombreCompleto(cita.pacientes)}. ` : '';
    const medico = cita.medicos ? `Medico: ${nombreCompleto(cita.medicos)}${cita.medicos.especialidad ? ` (${cita.medicos.especialidad})` : ''}. ` : '';
    return `- ${cita.fecha ?? 'Sin fecha'} ${cita.hora ?? ''}: ${cita.estado ?? 'sin estado'}. ${paciente}${medico}Motivo: ${cita.motivo ?? 'no registrado'}.`;
  });

  return `Encontre ${base.length} cita(s) relevante(s):\n${lineas.join('\n')}`;
}

function resumirPagos(pagos: any[]): string {
  if (!pagos.length) {
    return 'No encontre pagos registrados en el contexto permitido para tu rol.';
  }

  const lineas = pagos.slice(0, 5).map(pago => {
    const paciente = pago.pacientes ? ` - ${nombreCompleto(pago.pacientes)}` : '';
    return `- ${pago.concepto ?? 'Pago'}: S/ ${pago.monto ?? 0}, estado ${pago.estado ?? 'sin estado'}, fecha ${pago.fecha_pago ?? 'sin fecha'}${paciente}.`;
  });

  return `Ultimos pagos disponibles:\n${lineas.join('\n')}`;
}

function resumirPacientes(rol: RolUsuario, contexto: any): string {
  if (rol === 'paciente' && contexto.paciente) {
    return `Tu ficha vinculada es: ${nombreCompleto(contexto.paciente)}.`;
  }

  const pacientes = contexto.pacientes ?? [];
  if (!pacientes.length) {
    return 'No encontre pacientes en el contexto permitido para tu rol.';
  }

  const lineas = pacientes.slice(0, 8).map((paciente: any) =>
    `- ${nombreCompleto(paciente)}, estado ${paciente.activo === false ? 'inactivo' : 'activo'}.`
  );

  return `Pacientes disponibles para tu rol:\n${lineas.join('\n')}`;
}

function resumirMedicos(medicos: any[], medicoActual?: any): string {
  if (medicoActual) {
    return `Tu perfil medico vinculado es: ${nombreCompleto(medicoActual)}, especialidad ${medicoActual.especialidad ?? 'no registrada'}.`;
  }

  if (!medicos.length) {
    return 'No encontre medicos en el contexto permitido para tu rol.';
  }

  const lineas = medicos.slice(0, 8).map(medico =>
    `- ${nombreCompleto(medico)}, especialidad ${medico.especialidad ?? 'no registrada'}, estado ${medico.activo === false ? 'inactivo' : 'activo'}.`
  );

  return `Medicos disponibles:\n${lineas.join('\n')}`;
}

function resumirHistoriales(historiales: any[]): string {
  if (!historiales.length) {
    return 'No encontre historiales clinicos en el contexto permitido para tu rol.';
  }

  const lineas = historiales.slice(0, 5).map(historial => {
    const paciente = historial.pacientes ? `Paciente: ${nombreCompleto(historial.pacientes)}. ` : '';
    return `- ${historial.fecha ?? 'Sin fecha'}: ${paciente}Diagnostico: ${historial.diagnostico ?? 'no registrado'}. Tratamiento: ${historial.tratamiento ?? 'no registrado'}.`;
  });

  return `Historiales disponibles para tu rol:\n${lineas.join('\n')}`;
}

function nombreCompleto(persona: any): string {
  return [persona?.nombres, persona?.apellidos].filter(Boolean).join(' ') || persona?.nombre || 'Sin nombre';
}
