import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { NubefactRespuesta } from '@features/facturacion/models/facturacion.model';

@Injectable({ providedIn: 'root' })
export class NubefactService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  emitir(comprobanteId: string): Promise<NubefactRespuesta> {
    return this.invocar('emitir-comprobante', comprobanteId);
  }

  consultar(comprobanteId: string): Promise<NubefactRespuesta> {
    return this.invocar('consultar-comprobante', comprobanteId);
  }

  anular(comprobanteId: string, motivo?: string): Promise<NubefactRespuesta> {
    return this.invocar('anular-comprobante', comprobanteId, motivo);
  }

  private async invocar(functionName: string, comprobanteId: string, motivo?: string): Promise<NubefactRespuesta> {
    const { data, error } = await this.supabase.functions.invoke(functionName, {
      body: {
        comprobante_id: comprobanteId,
        motivo
      }
    });

    if (error) {
      throw new Error(error.message || 'No se pudo operar el comprobante.');
    }

    const respuesta = data as NubefactRespuesta;

    if (respuesta?.ok === false) {
      throw new Error(respuesta.error || String(respuesta.nubefact?.['errors'] ?? 'Nubefact rechazo la operacion.'));
    }

    return respuesta;
  }
}
