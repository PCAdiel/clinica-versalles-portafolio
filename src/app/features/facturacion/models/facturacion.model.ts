import { MetodoPago } from '@features/pagos/models/pago.model';

export type TipoComprobante = 'BOLETA' | 'FACTURA';

export type EstadoComprobante =
  | 'PENDIENTE_EMISION'
  | 'ENVIANDO'
  | 'EMITIDO'
  | 'ERROR_FACTURACION'
  | 'PENDIENTE_REINTENTO'
  | 'ANULADO_NUBEFACT';

export const ESTADO_COMPROBANTE_LABELS: Record<EstadoComprobante, string> = {
  PENDIENTE_EMISION: 'Pendiente de emision',
  ENVIANDO: 'Enviando',
  EMITIDO: 'Emitido',
  ERROR_FACTURACION: 'Error',
  PENDIENTE_REINTENTO: 'Pendiente de reintento',
  ANULADO_NUBEFACT: 'Anulado'
};

export interface ComprobantePreviewData {
  clinica?: {
    nombre?: string;
    ruc?: string | null;
  };
  tipo_comprobante?: TipoComprobante;
  serie?: string;
  numero?: number;
  fecha_emision?: string;
  estado?: string;
  advertencia?: string;
  cliente?: {
    tipo_documento?: string;
    numero_documento?: string;
    denominacion?: string;
    direccion?: string | null;
  };
  pago?: {
    id?: string;
    concepto?: string;
    metodo_pago?: MetodoPago | string;
    subtotal?: number;
    igv?: number;
    total?: number;
  };
  cita?: {
    id?: string;
    fecha?: string;
    hora?: string;
    tipo_consulta?: string;
    especialidad?: string;
    medico?: string | null;
  };
}

export interface Comprobante {
  id: string;
  pagoId: string;
  citaId: string;
  pacienteId: string;
  pacienteNombre: string;
  concepto: string;
  tipoComprobante: TipoComprobante;
  serie: string;
  numero: number;
  estado: EstadoComprobante;
  proveedor: string;
  proveedorId?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  cdrUrl?: string | null;
  estadoSunat?: string | null;
  respuestaSunat?: Record<string, unknown> | null;
  ticketAnulacion?: string | null;
  sunatDescription?: string | null;
  sunatNote?: string | null;
  sunatResponseCode?: string | null;
  sunatSoapError?: string | null;
  cadenaQr?: string | null;
  codigoHash?: string | null;
  errorMensaje?: string | null;
  clienteTipoDocumento: string;
  clienteNumeroDocumento: string;
  clienteDenominacion: string;
  clienteDireccion?: string | null;
  previewData: ComprobantePreviewData;
  monto: number;
  metodoPago?: MetodoPago | string;
  fechaPago?: string;
  citaFecha?: string;
  citaHora?: string;
  medicoNombre?: string;
  especialidad?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NubefactRespuesta {
  ok?: boolean;
  comprobante?: {
    comprobante_id?: string;
    estado?: EstadoComprobante | string;
  };
  nubefact?: Record<string, unknown>;
  error?: string;
}

export interface FacturacionEvento {
  id: string;
  comprobanteId?: string | null;
  pagoId?: string | null;
  citaId?: string | null;
  pacienteId?: string | null;
  proveedor: string;
  operacion: string;
  estado: string;
  mensaje?: string | null;
  detalle?: Record<string, unknown> | null;
  createdAt: string;
}
