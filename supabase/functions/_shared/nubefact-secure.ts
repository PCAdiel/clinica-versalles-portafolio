import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export interface SecureContext {
  client: SupabaseClient;
  userId: string;
  apiUrl: string;
  token: string;
  env: string;
}

interface ComprobanteClinico {
  id: string;
  pago_id: string;
  cita_id: string;
  paciente_id: string;
  tipo_comprobante: 'BOLETA' | 'FACTURA';
  serie: string;
  numero: number;
  cliente_tipo_documento: string;
  cliente_numero_documento: string;
  cliente_denominacion: string;
  cliente_direccion?: string | null;
  pagos?: {
    concepto?: string | null;
    monto: number | string;
    metodo_pago?: string | null;
    fecha_pago?: string | null;
    created_at?: string | null;
  } | null;
  citas?: {
    fecha?: string | null;
    hora?: string | null;
    tipo_consulta?: string | null;
    medicos?: {
      nombres?: string | null;
      apellidos?: string | null;
      especialidad?: string | null;
    } | null;
  } | null;
  pacientes?: {
    nombres?: string | null;
    apellidos?: string | null;
    dni?: string | null;
    direccion?: string | null;
  } | null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

export async function getSecureContext(req: Request): Promise<SecureContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const apiUrl = Deno.env.get('NUBEFACT_API_URL');
  const token = Deno.env.get('NUBEFACT_TOKEN');
  const env = Deno.env.get('NUBEFACT_ENV') ?? 'demo';
  const authHeader = req.headers.get('authorization');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase no esta configurado en Edge Functions.');
  }

  if (!apiUrl || !token) {
    throw new Error('Nubefact no esta configurado.');
  }

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No autorizado.');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error('Sesion invalida.');
  }

  return { client, userId: data.user.id, apiUrl, token, env };
}

export async function readComprobanteRequest(req: Request): Promise<{ comprobanteId: string; motivo?: string }> {
  const body = await req.json().catch(() => null) as { comprobante_id?: string; motivo?: string } | null;
  const comprobanteId = body?.comprobante_id;

  if (!comprobanteId || typeof comprobanteId !== 'string') {
    throw new Error('Envia comprobante_id.');
  }

  return {
    comprobanteId,
    motivo: typeof body?.motivo === 'string' ? body.motivo : undefined
  };
}

export async function obtenerComprobanteSeguro(
  ctx: SecureContext,
  comprobanteId: string
): Promise<ComprobanteClinico> {
  const { data: perfil, error: perfilError } = await ctx.client
    .from('usuarios')
    .select('rol, activo')
    .eq('id', ctx.userId)
    .maybeSingle();

  if (perfilError) {
    throw new Error(perfilError.message);
  }

  if (!perfil?.activo || !['admin', 'recepcionista'].includes(String(perfil.rol))) {
    throw new Error('Tu rol no permite operar comprobantes.');
  }

  const { data: comprobante, error } = await ctx.client
    .from('comprobantes')
    .select(`
      *,
      pagos:pago_id(*),
      citas:cita_id(
        *,
        medicos:medico_id(nombres, apellidos, especialidad)
      ),
      pacientes:paciente_id(nombres, apellidos, dni, direccion)
    `)
    .eq('id', comprobanteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!comprobante?.id) {
    throw new Error('Comprobante no encontrado.');
  }

  return comprobante as ComprobanteClinico;
}

export function buildGenerarComprobantePayload(comprobante: ComprobanteClinico): Record<string, unknown> {
  const pago = comprobante.pagos;

  if (!pago) {
    throw new Error('El pago del comprobante no existe.');
  }

  const total = round(Number(pago.monto));
  const subtotal = round(total / 1.18);
  const igv = round(total - subtotal);
  const tipo = comprobante.tipo_comprobante === 'FACTURA' ? 1 : 2;
  const numeroDocumento = soloDigitos(comprobante.cliente_numero_documento);

  if (tipo === 1 && (numeroDocumento.length !== 11 || !comprobante.cliente_denominacion.trim() || !comprobante.cliente_direccion?.trim())) {
    throw new Error('Para factura el cliente debe tener RUC, razon social y direccion fiscal.');
  }

  if (tipo === 2 && numeroDocumento.length !== 8) {
    throw new Error('Para boleta el paciente debe tener DNI valido.');
  }

  return {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: tipo,
    serie: comprobante.serie,
    numero: Number(comprobante.numero),
    sunat_transaction: 1,
    cliente_tipo_de_documento: tipo === 1 ? '6' : '1',
    cliente_numero_de_documento: numeroDocumento,
    cliente_denominacion: comprobante.cliente_denominacion,
    cliente_direccion: comprobante.cliente_direccion ?? '',
    fecha_de_emision: fechaNubefact(pago.fecha_pago ?? pago.created_at),
    moneda: 1,
    porcentaje_de_igv: 18,
    total_gravada: subtotal,
    total_igv: igv,
    total,
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    formato_de_pdf: Deno.env.get('NUBEFACT_FORMATO_PDF') ?? 'TICKET',
    items: [
      {
        unidad_de_medida: 'NIU',
        codigo: comprobante.pago_id,
        descripcion: descripcionItem(comprobante),
        cantidad: 1,
        valor_unitario: subtotal,
        precio_unitario: total,
        subtotal,
        tipo_de_igv: 1,
        igv,
        total,
        anticipo_regularizacion: false
      }
    ]
  };
}

export function buildConsultarPayload(comprobante: ComprobanteClinico): Record<string, unknown> {
  return {
    operacion: 'consultar_comprobante',
    tipo_de_comprobante: comprobante.tipo_comprobante === 'FACTURA' ? 1 : 2,
    serie: comprobante.serie,
    numero: Number(comprobante.numero)
  };
}

export function buildAnularPayload(comprobante: ComprobanteClinico, motivo?: string): Record<string, unknown> {
  return {
    operacion: 'generar_anulacion',
    tipo_de_comprobante: comprobante.tipo_comprobante === 'FACTURA' ? 1 : 2,
    serie: comprobante.serie,
    numero: Number(comprobante.numero),
    motivo: motivo?.trim() || 'ANULACION SOLICITADA'
  };
}

export async function callNubefact(
  ctx: SecureContext,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(ctx.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: ctx.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({ errors: 'Respuesta Nubefact no valida.' })) as Record<string, unknown>;
  return { ok: response.ok && !data.errors, data };
}

export function estadoDesdeRespuesta(ok: boolean, data: Record<string, unknown>): string {
  if (!ok) {
    return 'PENDIENTE_REINTENTO';
  }

  if (data.enlace || data.enlace_del_pdf || data.enlace_del_xml || data.aceptada_por_sunat === true) {
    return 'EMITIDO';
  }

  return 'PENDIENTE_REINTENTO';
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo procesar la solicitud.';
}

function descripcionItem(comprobante: ComprobanteClinico): string {
  const concepto = comprobante.pagos?.concepto?.trim();

  if (concepto) {
    return concepto;
  }

  const especialidad = comprobante.citas?.medicos?.especialidad?.trim();
  const tipoConsulta = comprobante.citas?.tipo_consulta?.trim();

  if (tipoConsulta && especialidad) {
    return `${tipoConsulta} - ${especialidad}`;
  }

  if (especialidad) {
    return `Consulta - ${especialidad}`;
  }

  return 'Atencion medica';
}

function fechaNubefact(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(Number.isNaN(date.getTime()) ? new Date() : date);
  const day = parts.find(part => part.type === 'day')?.value ?? '01';
  const month = parts.find(part => part.type === 'month')?.value ?? '01';
  const year = parts.find(part => part.type === 'year')?.value ?? String(new Date().getFullYear());

  return `${day}-${month}-${year}`;
}

function soloDigitos(value = ''): string {
  return value.replace(/\D/g, '');
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
