import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { Cita, EstadoCita } from '@features/citas/models/cita.model';
import { esFechaActualOFutura, requiereTexto } from '@shared/validators/clinic.validators';
import { singleRelation } from '@shared/data-access/relation.utils';

interface NombreRelacionado {
  nombres: string;
  apellidos: string;
}

interface MedicoRelacionado extends NombreRelacionado {
  especialidad: string;
}

interface CitaRow {
  id: string;
  paciente_id: string;
  medico_id: string;
  fecha: string;
  hora: string;
  motivo: string | null;
  tipo_consulta: string | null;
  mensaje: string | null;
  estado: EstadoCita;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  pacientes?: NombreRelacionado | NombreRelacionado[] | null;
  medicos?: MedicoRelacionado | MedicoRelacionado[] | null;
}

@Injectable({ providedIn: 'root' })
export class CitasService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarCitas(): Observable<Cita[]> {
    return defer(() => from(this.obtenerCitas()));
  }

  async listarCitasPorPaciente(pacienteId: string): Promise<Cita[]> {
    return this.obtenerCitas(query => query.eq('paciente_id', pacienteId));
  }

  async listarCitasPorMedico(medicoId: string): Promise<Cita[]> {
    return this.obtenerCitas(query => query.eq('medico_id', medicoId));
  }

  async crearCita(cita: Omit<Cita, 'id'>): Promise<Cita> {
    await this.validarCita(cita);

    const { data, error } = await this.supabase
      .from('citas')
      .insert(this.toCitaPayload(cita))
      .select(this.selectCita)
      .single<CitaRow>();

    if (error) {
      throw this.normalizarErrorCita(error);
    }

    return this.mapCita(data as unknown as CitaRow);
  }

  agregarCita(cita: Omit<Cita, 'id'>): Promise<Cita> {
    return this.crearCita(cita);
  }

  async actualizarCita(id: string, cita: Omit<Cita, 'id' | 'createdAt'>): Promise<Cita> {
    await this.validarCita(cita, id);
    await this.assertCitaEditable(id);

    const { data, error } = await this.supabase
      .from('citas')
      .update(this.toCitaPayload(cita))
      .eq('id', id)
      .select(this.selectCita)
      .single<CitaRow>();

    if (error) {
      throw this.normalizarErrorCita(error);
    }

    return this.mapCita(data as unknown as CitaRow);
  }

  async cancelarCita(id: string): Promise<void> {
    await this.assertCitaEditable(id);
    await this.actualizarEstado(id, 'cancelada');
  }

  async confirmarCita(id: string): Promise<void> {
    await this.assertCitaEditable(id);
    await this.actualizarEstado(id, 'confirmada');
  }

  async marcarAtendida(id: string): Promise<void> {
    await this.assertCitaEditable(id);
    await this.actualizarEstado(id, 'atendida');
  }

  eliminarCita(id: string): Promise<void> {
    return this.cancelarCita(id);
  }

  async existeCitaDuplicada(medicoId: string, fecha: string, hora: string, ignorarId?: string): Promise<boolean> {
    let consulta = this.supabase
      .from('citas')
      .select('id')
      .eq('medico_id', medicoId)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .limit(1);

    if (ignorarId) {
      consulta = consulta.neq('id', ignorarId);
    }

    const { data, error } = await consulta;

    if (error) {
      throw error;
    }

    return Boolean(data?.length);
  }

  private readonly selectCita = `
    id,
    paciente_id,
    medico_id,
    fecha,
    hora,
    motivo,
    tipo_consulta,
    mensaje,
    estado,
    created_by,
    created_at,
    updated_at,
    pacientes(nombres, apellidos),
    medicos(nombres, apellidos, especialidad)
  `;

  private async obtenerCitas(
    aplicarFiltro?: (query: ReturnType<typeof this.baseCitasQuery>) => ReturnType<typeof this.baseCitasQuery>
  ): Promise<Cita[]> {
    const query = aplicarFiltro ? aplicarFiltro(this.baseCitasQuery()) : this.baseCitasQuery();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as unknown as CitaRow[]).map(row => this.mapCita(row));
  }

  private baseCitasQuery() {
    return this.supabase
      .from('citas')
      .select(this.selectCita)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
  }

  private async validarCita(cita: Omit<Cita, 'id'>, ignorarId?: string): Promise<void> {
    if (!requiereTexto(cita.pacienteId)) {
      throw new Error('Selecciona un paciente.');
    }

    if (!requiereTexto(cita.medicoId)) {
      throw new Error('Selecciona un medico.');
    }

    if (!esFechaActualOFutura(cita.fecha)) {
      throw new Error('La fecha de la cita no puede estar en el pasado.');
    }

    if (!requiereTexto(cita.hora)) {
      throw new Error('Selecciona una hora.');
    }

    if (await this.existeCitaDuplicada(cita.medicoId, cita.fecha, cita.hora, ignorarId)) {
      throw new Error('Ya existe una cita para este medico en la misma fecha y hora.');
    }
  }

  private async assertCitaEditable(id: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('citas')
      .select('estado')
      .eq('id', id)
      .single<{ estado: EstadoCita }>();

    if (error) {
      throw error;
    }

    if (data.estado === 'atendida') {
      throw new Error('No se puede modificar una cita atendida.');
    }
  }

  private async actualizarEstado(id: string, estado: EstadoCita): Promise<void> {
    const { error } = await this.supabase
      .from('citas')
      .update({ estado })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  private toCitaPayload(cita: Omit<Cita, 'id'>) {
    return {
      paciente_id: cita.pacienteId,
      medico_id: cita.medicoId,
      fecha: cita.fecha,
      hora: cita.hora,
      motivo: cita.motivo?.trim() || null,
      tipo_consulta: cita.tipoConsulta?.trim() || null,
      mensaje: cita.mensaje?.trim() || null,
      estado: cita.estado,
      created_by: cita.creadoPor ?? null
    };
  }

  private mapCita(row: CitaRow): Cita {
    const paciente = singleRelation(row.pacientes);
    const medico = singleRelation(row.medicos);
    const pacienteNombre = paciente
      ? `${paciente.nombres} ${paciente.apellidos}`
      : 'Paciente sin perfil';
    const medicoNombre = medico
      ? `Dr(a). ${medico.nombres} ${medico.apellidos}`
      : 'Medico sin perfil';

    return {
      id: row.id,
      pacienteId: row.paciente_id,
      pacienteNombre,
      medicoId: row.medico_id,
      medicoNombre,
      especialidad: medico?.especialidad ?? '',
      fecha: row.fecha,
      hora: row.hora,
      estado: row.estado,
      motivo: row.motivo ?? '',
      tipoConsulta: row.tipo_consulta ?? 'Consulta General',
      mensaje: row.mensaje ?? '',
      creadoPor: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private normalizarErrorCita(error: unknown): Error {
    const supabaseError = error as { code?: string; message?: string };

    if (supabaseError.code === '23505') {
      return new Error('Ya existe una cita para este medico en la misma fecha y hora.');
    }

    return error instanceof Error ? error : new Error(supabaseError.message ?? 'No se pudo procesar la cita.');
  }
}

export type { Cita, EstadoCita };
