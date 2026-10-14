import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { HistorialClinico } from '@features/historial/models/historial-clinico.model';
import { requiereTexto } from '@shared/validators/clinic.validators';
import { singleRelation } from '@shared/data-access/relation.utils';

interface NombreRelacionado {
  nombres: string;
  apellidos: string;
}

interface HistorialRow {
  id: string;
  cita_id: string | null;
  paciente_id: string;
  medico_id: string;
  diagnostico: string;
  tratamiento: string;
  observaciones: string | null;
  fecha: string;
  created_at: string;
  updated_at: string;
  pacientes?: NombreRelacionado | NombreRelacionado[] | null;
  medicos?: NombreRelacionado | NombreRelacionado[] | null;
}

@Injectable({ providedIn: 'root' })
export class HistorialService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarHistorial(): Observable<HistorialClinico[]> {
    return defer(() => from(this.obtenerHistorial()));
  }

  async listarHistorialPorPaciente(pacienteId: string): Promise<HistorialClinico[]> {
    return this.obtenerHistorial(query => query.eq('paciente_id', pacienteId));
  }

  async listarHistorialPorMedico(medicoId: string): Promise<HistorialClinico[]> {
    return this.obtenerHistorial(query => query.eq('medico_id', medicoId));
  }

  async crearHistorial(historial: Omit<HistorialClinico, 'id'>): Promise<HistorialClinico> {
    this.validarHistorial(historial);

    const { data, error } = await this.supabase
      .from('historial_clinico')
      .insert(this.toHistorialPayload(historial))
      .select(this.selectHistorial)
      .single<HistorialRow>();

    if (error) {
      throw error;
    }

    if (historial.citaId) {
      await this.supabase
        .from('citas')
        .update({ estado: 'atendida' })
        .eq('id', historial.citaId)
        .neq('estado', 'atendida');
    }

    return this.mapHistorial(data as unknown as HistorialRow);
  }

  agregarHistorial(historial: Omit<HistorialClinico, 'id'>): Promise<HistorialClinico> {
    return this.crearHistorial(historial);
  }

  async actualizarHistorial(id: string, historial: Omit<HistorialClinico, 'id' | 'createdAt'>): Promise<HistorialClinico> {
    this.validarHistorial(historial);

    const { data, error } = await this.supabase
      .from('historial_clinico')
      .update(this.toHistorialPayload(historial))
      .eq('id', id)
      .select(this.selectHistorial)
      .single<HistorialRow>();

    if (error) {
      throw error;
    }

    return this.mapHistorial(data as unknown as HistorialRow);
  }

  async eliminarHistorial(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('historial_clinico')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  private readonly selectHistorial = `
    id,
    cita_id,
    paciente_id,
    medico_id,
    diagnostico,
    tratamiento,
    observaciones,
    fecha,
    created_at,
    updated_at,
    pacientes(nombres, apellidos),
    medicos(nombres, apellidos)
  `;

  private async obtenerHistorial(aplicarFiltro?: (query: any) => any): Promise<HistorialClinico[]> {
    const query = aplicarFiltro ? aplicarFiltro(this.baseHistorialQuery()) : this.baseHistorialQuery();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as unknown as HistorialRow[]).map(row => this.mapHistorial(row));
  }

  private baseHistorialQuery() {
    return this.supabase
      .from('historial_clinico')
      .select(this.selectHistorial)
      .order('fecha', { ascending: false });
  }

  private validarHistorial(historial: Omit<HistorialClinico, 'id'>): void {
    if (!requiereTexto(historial.pacienteId)) {
      throw new Error('Selecciona un paciente.');
    }

    if (!requiereTexto(historial.citaId)) {
      throw new Error('Selecciona una cita relacionada.');
    }

    if (!requiereTexto(historial.medicoId)) {
      throw new Error('Selecciona un medico.');
    }

    if (!requiereTexto(historial.diagnostico) || !requiereTexto(historial.tratamiento)) {
      throw new Error('Completa diagnostico y tratamiento.');
    }
  }

  private toHistorialPayload(historial: Omit<HistorialClinico, 'id'>) {
    return {
      cita_id: historial.citaId ?? '',
      paciente_id: historial.pacienteId,
      medico_id: historial.medicoId ?? '',
      diagnostico: historial.diagnostico.trim(),
      tratamiento: historial.tratamiento.trim(),
      observaciones: historial.observaciones?.trim() || null,
      fecha: historial.fecha
    };
  }

  private mapHistorial(row: HistorialRow): HistorialClinico {
    const paciente = singleRelation(row.pacientes);
    const medico = singleRelation(row.medicos);

    return {
      id: row.id,
      pacienteId: row.paciente_id,
      pacienteNombre: paciente ? `${paciente.nombres} ${paciente.apellidos}` : 'Paciente sin perfil',
      citaId: row.cita_id ?? '',
      medicoId: row.medico_id,
      medicoNombre: medico ? `Dr(a). ${medico.nombres} ${medico.apellidos}` : 'Medico sin perfil',
      diagnostico: row.diagnostico,
      tratamiento: row.tratamiento,
      observaciones: row.observaciones ?? '',
      fecha: row.fecha,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

}

export type { HistorialClinico };
