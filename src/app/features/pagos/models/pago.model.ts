import type { Comprobante, TipoComprobante } from '@features/facturacion/models/facturacion.model';

export type EstadoPago = 'pendiente' | 'pagado' | 'anulado';

export const ESTADO_PAGO_LABELS: Record<EstadoPago, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  anulado: 'Anulado'
};

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Yape' | 'Plin' | 'Transferencia';

export interface Pago {
  id?: string;
  citaId: string;
  pacienteId: string;
  pacienteNombre: string;
  concepto: string;
  monto: number;
  metodoPago: MetodoPago;
  estado: EstadoPago;
  fechaPago: string;
  generarComprobante?: boolean;
  tipoComprobante?: TipoComprobante;
  comprobante?: Comprobante;
  clienteTipoDocumento?: string;
  clienteNumeroDocumento?: string;
  clienteDenominacion?: string;
  clienteDireccion?: string;
  createdAt?: string;
  updatedAt?: string;
}
