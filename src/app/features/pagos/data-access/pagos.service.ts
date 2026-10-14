import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import {
  Comprobante,
  ComprobantePreviewData,
  EstadoComprobante,
  TipoComprobante
} from '@features/facturacion/models/facturacion.model';
import { EstadoPago, Pago } from '@features/pagos/models/pago.model';
import { singleRelation } from '@shared/data-access/relation.utils';

interface NombreRelacionado {
  nombres: string;
  apellidos: string;
}

interface PagoRow {
  id: string;
  cita_id: string;
  paciente_id: string;
  concepto: string | null;
  monto: number;
  metodo_pago: Pago['metodoPago'];
  estado: EstadoPago;
  fecha_pago: string | null;
  created_at: string;
  updated_at: string;
  pacientes?: NombreRelacionado | NombreRelacionado[] | null;
  comprobantes?: ComprobanteRow[] | ComprobanteRow | null;
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
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarPagos(): Observable<Pago[]> {
    return defer(() => from(this.obtenerPagos()));
  }

  async listarPagosPorPaciente(pacienteId: string): Promise<Pago[]> {
    return this.obtenerPagos(query => query.eq('paciente_id', pacienteId));
  }

  async registrarPago(pago: Omit<Pago, 'id'>): Promise<Pago> {
    this.validarPago(pago);

    if (pago.generarComprobante && pago.tipoComprobante) {
      const { data, error } = await this.supabase.rpc('registrar_pago_con_comprobante', {
        p_payload: this.toPagoConComprobantePayload(pago)
      });

      if (error) {
        throw error;
      }

      const pagoId = this.leerPagoIdRpc(data);
      return this.obtenerPagoPorId(pagoId);
    }

    const { data, error } = await this.supabase
      .from('pagos')
      .insert(this.toPagoPayload(pago))
      .select(this.selectPago)
      .single<PagoRow>();

    if (error) {
      throw error;
    }

    return this.mapPago(data as unknown as PagoRow);
  }

  agregarPago(pago: Omit<Pago, 'id'>): Promise<Pago> {
    return this.registrarPago(pago);
  }

  async actualizarPago(id: string, pago: Omit<Pago, 'id' | 'createdAt'>): Promise<Pago> {
    this.validarPago(pago);

    const { data, error } = await this.supabase
      .from('pagos')
      .update(this.toPagoPayload(pago))
      .eq('id', id)
      .select(this.selectPago)
      .single<PagoRow>();

    if (error) {
      throw error;
    }

    return this.mapPago(data as unknown as PagoRow);
  }

  async actualizarEstadoPago(id: string, estado: EstadoPago): Promise<void> {
    const { error } = await this.supabase
      .from('pagos')
      .update({ estado })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  eliminarPago(id: string): Promise<void> {
    return this.actualizarEstadoPago(id, 'anulado');
  }

  private readonly selectPago = `
    id,
    cita_id,
    paciente_id,
    concepto,
    monto,
    metodo_pago,
    estado,
    fecha_pago,
    created_at,
    updated_at,
    pacientes(nombres, apellidos),
    comprobantes(*)
  `;

  private async obtenerPagoPorId(id: string): Promise<Pago> {
    const { data, error } = await this.supabase
      .from('pagos')
      .select(this.selectPago)
      .eq('id', id)
      .single<PagoRow>();

    if (error) {
      throw error;
    }

    return this.mapPago(data as unknown as PagoRow);
  }

  private async obtenerPagos(aplicarFiltro?: (query: any) => any): Promise<Pago[]> {
    const query = aplicarFiltro ? aplicarFiltro(this.basePagosQuery()) : this.basePagosQuery();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as unknown as PagoRow[]).map(row => this.mapPago(row));
  }

  private basePagosQuery() {
    return this.supabase
      .from('pagos')
      .select(this.selectPago)
      .order('fecha_pago', { ascending: false });
  }

  private validarPago(pago: Omit<Pago, 'id'>): void {
    if (!pago.citaId || !pago.pacienteId) {
      throw new Error('Selecciona una cita valida.');
    }

    if (!Number.isFinite(Number(pago.monto)) || Number(pago.monto) <= 0) {
      throw new Error('El pago no puede ser negativo ni cero.');
    }
  }

  private toPagoPayload(pago: Omit<Pago, 'id'>) {
    return {
      cita_id: pago.citaId,
      paciente_id: pago.pacienteId,
      concepto: pago.concepto?.trim() || null,
      monto: Number(pago.monto),
      metodo_pago: pago.metodoPago,
      estado: pago.estado,
      fecha_pago: pago.fechaPago || null
    };
  }

  private toPagoConComprobantePayload(pago: Omit<Pago, 'id'>) {
    return {
      cita_id: pago.citaId,
      paciente_id: pago.pacienteId,
      concepto: pago.concepto?.trim() || 'Consulta medica',
      monto: Number(pago.monto),
      metodo_pago: pago.metodoPago,
      estado: pago.estado,
      fecha_pago: pago.fechaPago || null,
      tipo_comprobante: pago.tipoComprobante,
      cliente_tipo_documento: pago.clienteTipoDocumento,
      cliente_numero_documento: pago.clienteNumeroDocumento,
      cliente_denominacion: pago.clienteDenominacion,
      cliente_direccion: pago.clienteDireccion
    };
  }

  private mapPago(row: PagoRow): Pago {
    const paciente = singleRelation(row.pacientes);
    const comprobante = singleRelation(row.comprobantes);

    return {
      id: row.id,
      citaId: row.cita_id,
      pacienteId: row.paciente_id,
      pacienteNombre: paciente ? `${paciente.nombres} ${paciente.apellidos}` : 'Paciente sin perfil',
      concepto: row.concepto ?? 'Consulta medica',
      monto: Number(row.monto),
      metodoPago: row.metodo_pago,
      estado: row.estado,
      fechaPago: row.fecha_pago ?? '',
      generarComprobante: Boolean(comprobante),
      tipoComprobante: comprobante?.tipo_comprobante,
      comprobante: comprobante ? this.mapComprobante(comprobante, row, paciente) : undefined,
      clienteTipoDocumento: comprobante?.cliente_tipo_documento,
      clienteNumeroDocumento: comprobante?.cliente_numero_documento,
      clienteDenominacion: comprobante?.cliente_denominacion,
      clienteDireccion: comprobante?.cliente_direccion ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapComprobante(
    row: ComprobanteRow,
    pago: PagoRow,
    paciente: NombreRelacionado | null
  ): Comprobante {
    const pacienteNombre = paciente ? `${paciente.nombres} ${paciente.apellidos}` : row.cliente_denominacion;

    return {
      id: row.id,
      pagoId: row.pago_id,
      citaId: row.cita_id,
      pacienteId: row.paciente_id,
      pacienteNombre,
      concepto: pago.concepto ?? row.preview_data?.pago?.concepto ?? 'Consulta medica',
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
      monto: Number(pago.monto),
      metodoPago: pago.metodo_pago,
      fechaPago: pago.fecha_pago ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private leerPagoIdRpc(data: unknown): string {
    if (data && typeof data === 'object' && 'pago_id' in data) {
      const value = (data as { pago_id?: unknown }).pago_id;

      if (typeof value === 'string') {
        return value;
      }
    }

    throw new Error('La RPC no devolvio el pago registrado.');
  }

}

export type { EstadoPago, Pago };
