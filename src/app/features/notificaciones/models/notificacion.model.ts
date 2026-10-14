export type TipoNotificacion = 'cita' | 'pago' | 'historial' | 'sistema';

export interface Notificacion {
  id: string;
  usuarioId: string;
  titulo: string;
  mensaje: string;
  tipo: TipoNotificacion;
  leida: boolean;
  createdAt: string;
}
