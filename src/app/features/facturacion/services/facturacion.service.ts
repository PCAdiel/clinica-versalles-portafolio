import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import {
  Comprobante,
  ComprobantePreviewData,
  EstadoComprobante,
  FacturacionEvento,
  TipoComprobante
} from '@features/facturacion/models/facturacion.model';
import { MetodoPago } from '@features/pagos/models/pago.model';
import { singleRelation } from '@shared/data-access/relation.utils';

interface NombreRelacionado {
  nombres: string;
  apellidos: string;
}

interface PacienteRelacionado extends NombreRelacionado {
  dni?: string | null;
  direccion?: string | null;
}

interface MedicoRelacionado extends NombreRelacionado {
  especialidad?: string | null;
}

interface PagoRelacionado {
  concepto: string | null;
  monto: number;
  metodo_pago: MetodoPago;
  fecha_pago: string | null;
}

interface CitaRelacionado {
  fecha: string | null;
  hora: string | null;
  tipo_consulta: string | null;
  medicos?: MedicoRelacionado | MedicoRelacionado[] | null;
}

interface ComprobanteRow {
  id: string;
  pago_id: string;
  cita_id: string;
  paciente_id: string;
  tipo_comprobante: TipoComprobante;
  serie: string;
  numero: number;
  estado: EstadoComprobante;
  proveedor: string;
  proveedor_id: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  cdr_url: string | null;
  estado_sunat: string | null;
  respuesta_sunat: Record<string, unknown> | null;
  ticket_anulacion: string | null;
  sunat_description: string | null;
  sunat_note: string | null;
  sunat_responsecode: string | null;
  sunat_soap_error: string | null;
  cadena_para_codigo_qr: string | null;
  codigo_hash: string | null;
  error_mensaje: string | null;
  cliente_tipo_documento: string;
  cliente_numero_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string | null;
  preview_data: ComprobantePreviewData | null;
  created_at: string;
  updated_at: string;
  pagos?: PagoRelacionado | PagoRelacionado[] | null;
  citas?: CitaRelacionado | CitaRelacionado[] | null;
  pacientes?: PacienteRelacionado | PacienteRelacionado[] | null;
}

interface FacturacionEventoRow {
  id: string;
  comprobante_id: string | null;
  pago_id: string | null;
  cita_id: string | null;
  paciente_id: string | null;
  proveedor: string;
  operacion: string;
  estado: string;
  mensaje: string | null;
  detalle: Record<string, unknown> | null;
  created_at: string;
}

export type FiltroComprobantes = 'todos' | 'pendientes' | 'emitidos' | 'error' | 'anulados';

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarComprobantes(filtro: FiltroComprobantes = 'todos'): Observable<Comprobante[]> {
    return defer(() => from(this.obtenerComprobantes(filtro)));
  }

  async obtenerComprobante(id: string): Promise<Comprobante | null> {
    const { data, error } = await this.supabase
      .from('comprobantes')
      .select(this.selectComprobante)
      .eq('id', id)
      .maybeSingle<ComprobanteRow>();

    if (error) {
      throw error;
    }

    return data ? this.mapComprobante(data as unknown as ComprobanteRow) : null;
  }

  async listarEventos(comprobanteId: string): Promise<FacturacionEvento[]> {
    const { data, error } = await this.supabase
      .from('facturacion_eventos')
      .select('*')
      .eq('comprobante_id', comprobanteId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as FacturacionEventoRow[]).map(row => ({
      id: row.id,
      comprobanteId: row.comprobante_id,
      pagoId: row.pago_id,
      citaId: row.cita_id,
      pacienteId: row.paciente_id,
      proveedor: row.proveedor,
      operacion: row.operacion,
      estado: row.estado,
      mensaje: row.mensaje,
      detalle: row.detalle,
      createdAt: row.created_at
    }));
  }

  puedeEmitir(comprobante: Pick<Comprobante, 'estado'>): boolean {
    return ['PENDIENTE_EMISION', 'ERROR_FACTURACION', 'PENDIENTE_REINTENTO'].includes(comprobante.estado);
  }

  private readonly selectComprobante = `
    *,
    pagos:pago_id(concepto, monto, metodo_pago, fecha_pago),
    citas:cita_id(
      fecha,
      hora,
      tipo_consulta,
      medicos:medico_id(nombres, apellidos, especialidad)
    ),
    pacientes:paciente_id(nombres, apellidos, dni, direccion)
  `;

  private async obtenerComprobantes(filtro: FiltroComprobantes): Promise<Comprobante[]> {
    let query = this.supabase
      .from('comprobantes')
      .select(this.selectComprobante)
      .order('created_at', { ascending: false });

    if (filtro === 'pendientes') {
      query = query.in('estado', ['PENDIENTE_EMISION', 'PENDIENTE_REINTENTO']);
    }

    if (filtro === 'emitidos') {
      query = query.eq('estado', 'EMITIDO');
    }

    if (filtro === 'error') {
      query = query.in('estado', ['ERROR_FACTURACION', 'PENDIENTE_REINTENTO']);
    }

    if (filtro === 'anulados') {
      query = query.eq('estado', 'ANULADO_NUBEFACT');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as unknown as ComprobanteRow[]).map(row => this.mapComprobante(row));
  }

  private mapComprobante(row: ComprobanteRow): Comprobante {
    const pago = singleRelation(row.pagos);
    const cita = singleRelation(row.citas);
    const paciente = singleRelation(row.pacientes);
    const medico = singleRelation(cita?.medicos);
    const pacienteNombre = paciente ? `${paciente.nombres} ${paciente.apellidos}` : row.cliente_denominacion;
    const medicoNombre = medico ? `Dr(a). ${medico.nombres} ${medico.apellidos}` : undefined;

    return {
      id: row.id,
      pagoId: row.pago_id,
      citaId: row.cita_id,
      pacienteId: row.paciente_id,
      pacienteNombre,
      concepto: pago?.concepto ?? row.preview_data?.pago?.concepto ?? 'Consulta medica',
      tipoComprobante: row.tipo_comprobante,
      serie: row.serie,
      numero: Number(row.numero),
      estado: row.estado,
      proveedor: row.proveedor,
      proveedorId: row.proveedor_id,
      pdfUrl: row.pdf_url,
      xmlUrl: row.xml_url,
      cdrUrl: row.cdr_url,
      estadoSunat: row.estado_sunat,
      respuestaSunat: row.respuesta_sunat,
      ticketAnulacion: row.ticket_anulacion,
      sunatDescription: row.sunat_description,
      sunatNote: row.sunat_note,
      sunatResponseCode: row.sunat_responsecode,
      sunatSoapError: row.sunat_soap_error,
      cadenaQr: row.cadena_para_codigo_qr,
      codigoHash: row.codigo_hash,
      errorMensaje: row.error_mensaje,
      clienteTipoDocumento: row.cliente_tipo_documento,
      clienteNumeroDocumento: row.cliente_numero_documento,
      clienteDenominacion: row.cliente_denominacion,
      clienteDireccion: row.cliente_direccion,
      previewData: row.preview_data ?? {},
      monto: Number(pago?.monto ?? row.preview_data?.pago?.total ?? 0),
      metodoPago: pago?.metodo_pago ?? row.preview_data?.pago?.metodo_pago,
      fechaPago: pago?.fecha_pago ?? row.preview_data?.fecha_emision,
      citaFecha: cita?.fecha ?? row.preview_data?.cita?.fecha,
      citaHora: cita?.hora ?? row.preview_data?.cita?.hora,
      medicoNombre,
      especialidad: medico?.especialidad ?? row.preview_data?.cita?.especialidad,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
