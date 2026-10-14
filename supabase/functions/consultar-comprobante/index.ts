import {
  buildConsultarPayload,
  callNubefact,
  corsHeaders,
  errorMessage,
  estadoDesdeRespuesta,
  getSecureContext,
  json,
  obtenerComprobanteSeguro,
  readComprobanteRequest
} from '../_shared/nubefact-secure.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo no permitido.' }, 405);
  }

  try {
    const ctx = await getSecureContext(req);
    const { comprobanteId } = await readComprobanteRequest(req);
    const comprobante = await obtenerComprobanteSeguro(ctx, comprobanteId);
    const result = await callNubefact(ctx, buildConsultarPayload(comprobante));
    const estado = estadoDesdeRespuesta(result.ok, result.data);

    const { data, error } = await ctx.client.rpc('marcar_comprobante_nubefact', {
      p_comprobante_id: comprobanteId,
      p_operacion: result.ok ? 'consulta' : 'error',
      p_estado: result.ok ? estado : 'PENDIENTE_REINTENTO',
      p_respuesta: result.data,
      p_mensaje: result.ok ? null : String(result.data.errors ?? result.data.error ?? 'No se pudo consultar.')
    });

    if (error) {
      throw new Error(error.message);
    }

    return json({ ok: result.ok, comprobante: data, nubefact: result.data }, result.ok ? 200 : 502);
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) }, 400);
  }
});
