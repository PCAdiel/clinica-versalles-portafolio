import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { Notificacion, TipoNotificacion } from '@features/notificaciones/models/notificacion.model';

interface NotificacionRow {
  id: string;
  usuario_id: string;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  leida: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarNotificaciones(): Observable<Notificacion[]> {
    return defer(() => from(this.obtenerNotificaciones()));
  }

  async contarNoLeidas(): Promise<number> {
    const { count, error } = await this.supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('leida', false);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async marcarComoLeida(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async marcarTodasComoLeidas(): Promise<void> {
    const { error } = await this.supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('leida', false);

    if (error) {
      throw error;
    }
  }

  private async obtenerNotificaciones(): Promise<Notificacion[]> {
    const { data, error } = await this.supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return (data as NotificacionRow[]).map(row => ({
      id: row.id,
      usuarioId: row.usuario_id,
      titulo: row.titulo,
      mensaje: row.mensaje,
      tipo: row.tipo,
      leida: row.leida,
      createdAt: row.created_at
    }));
  }
}

export type { Notificacion };
