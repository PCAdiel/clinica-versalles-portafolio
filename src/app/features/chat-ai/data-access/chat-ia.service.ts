import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SupabaseClientService } from '@core/supabase/supabase.client';

interface ChatAiResponse {
  respuesta: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatIaService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  async preguntar(mensaje: string): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke<ChatAiResponse>('chat-ai', {
      body: { mensaje }
    });

    if (error) {
      throw new Error(await this.obtenerMensajeError(error));
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.respuesta ?? 'No se recibio respuesta.';
  }

  private async obtenerMensajeError(error: unknown): Promise<string> {
    const fallback = 'No se pudo consultar el chat IA. Verifica que la Edge Function chat-ai este desplegada.';

    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json() as { error?: string };
        return payload.error ?? fallback;
      } catch {
        return error.message || fallback;
      }
    }

    if (error instanceof Error) {
      return error.message || fallback;
    }

    return fallback;
  }
}
