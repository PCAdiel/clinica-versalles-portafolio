import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { HorarioMedico, Medico } from '@features/medicos/models/medico.model';
import { esEmailValido, esTelefonoValido } from '@shared/validators/clinic.validators';

interface MedicoRow {
  id: string;
  usuario_id: string | null;
  nombres: string;
  apellidos: string;
  especialidad: string;
  telefono: string;
  email: string;
  colegiatura: string | null;
  horario: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface HorarioMedicoRow {
  id: string;
  medico_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class MedicosService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarMedicos(): Observable<Medico[]> {
    return defer(() => from(this.obtenerMedicos()));
  }

  async obtenerMedico(id: string): Promise<Medico | null> {
    const { data, error } = await this.supabase
      .from('medicos')
      .select('*')
      .eq('id', id)
      .maybeSingle<MedicoRow>();

    if (error) {
      throw error;
    }

    return data ? this.mapMedico(data) : null;
  }

  async crearMedico(medico: Omit<Medico, 'id'>): Promise<Medico> {
    this.validarMedico(medico);

    const { data, error } = await this.supabase
      .from('medicos')
      .insert(this.toMedicoPayload(medico))
      .select('*')
      .single<MedicoRow>();

    if (error) {
      throw error;
    }

    return this.mapMedico(data);
  }

  agregarMedico(medico: Omit<Medico, 'id'>): Promise<Medico> {
    return this.crearMedico(medico);
  }

  async actualizarMedico(id: string, medico: Omit<Medico, 'id' | 'createdAt'>): Promise<Medico> {
    this.validarMedico(medico);

    const { data, error } = await this.supabase
      .from('medicos')
      .update(this.toMedicoPayload(medico))
      .eq('id', id)
      .select('*')
      .single<MedicoRow>();

    if (error) {
      throw error;
    }

    return this.mapMedico(data);
  }

  async desactivarMedico(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('medicos')
      .update({ activo: false })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  eliminarMedico(id: string): Promise<void> {
    return this.desactivarMedico(id);
  }

  async listarHorariosMedico(medicoId: string): Promise<HorarioMedico[]> {
    const { data, error } = await this.supabase
      .from('horarios_medicos')
      .select('*')
      .eq('medico_id', medicoId)
      .eq('activo', true)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) {
      throw error;
    }

    return (data as HorarioMedicoRow[]).map(row => ({
      id: row.id,
      medicoId: row.medico_id,
      diaSemana: row.dia_semana,
      horaInicio: row.hora_inicio,
      horaFin: row.hora_fin,
      activo: row.activo
    }));
  }

  private async obtenerMedicos(): Promise<Medico[]> {
    const { data, error } = await this.supabase
      .from('medicos')
      .select('*')
      .order('apellidos', { ascending: true })
      .order('nombres', { ascending: true });

    if (error) {
      throw error;
    }

    return (data as MedicoRow[]).map(row => this.mapMedico(row));
  }

  private validarMedico(medico: Omit<Medico, 'id'>): void {
    if (!medico.nombres.trim() || !medico.apellidos.trim() || !medico.especialidad.trim()) {
      throw new Error('Completa nombres, apellidos y especialidad.');
    }

    if (!esTelefonoValido(medico.telefono)) {
      throw new Error('El telefono debe tener entre 7 y 15 digitos.');
    }

    if (medico.email && !esEmailValido(medico.email)) {
      throw new Error('El correo no tiene un formato valido.');
    }
  }

  private toMedicoPayload(medico: Omit<Medico, 'id'>) {
    return {
      usuario_id: medico.usuarioId ?? null,
      nombres: medico.nombres.trim(),
      apellidos: medico.apellidos.trim(),
      especialidad: medico.especialidad.trim(),
      telefono: medico.telefono.trim(),
      email: medico.email.trim(),
      colegiatura: medico.colegiatura?.trim() || null,
      horario: medico.horario?.trim() || null,
      activo: medico.estado !== 'Inactivo'
    };
  }

  private mapMedico(row: MedicoRow): Medico {
    return {
      id: row.id,
      usuarioId: row.usuario_id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      especialidad: row.especialidad,
      telefono: row.telefono,
      email: row.email,
      colegiatura: row.colegiatura ?? '',
      horario: row.horario ?? '',
      estado: row.activo ? 'Activo' : 'Inactivo',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export type { HorarioMedico, Medico };
