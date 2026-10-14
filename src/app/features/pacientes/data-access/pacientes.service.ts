import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { Paciente } from '@features/pacientes/models/paciente.model';
import { esDniValido, esEmailValido, esTelefonoValido } from '@shared/validators/clinic.validators';

interface PacienteRow {
  id: string;
  usuario_id: string | null;
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  email: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  grupo_sanguineo: string | null;
  alergias: string | null;
  antecedentes: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class PacientesService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarPacientes(): Observable<Paciente[]> {
    return defer(() => from(this.obtenerPacientes()));
  }

  async obtenerPaciente(id: string): Promise<Paciente | null> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .maybeSingle<PacienteRow>();

    if (error) {
      throw error;
    }

    return data ? this.mapPaciente(data) : null;
  }

  async crearPaciente(paciente: Omit<Paciente, 'id'>): Promise<Paciente> {
    this.validarPaciente(paciente);

    const { data, error } = await this.supabase
      .from('pacientes')
      .insert(this.toPacientePayload(paciente))
      .select('*')
      .single<PacienteRow>();

    if (error) {
      throw error;
    }

    return this.mapPaciente(data);
  }

  agregarPaciente(paciente: Omit<Paciente, 'id'>): Promise<Paciente> {
    return this.crearPaciente(paciente);
  }

  async actualizarPaciente(id: string, paciente: Omit<Paciente, 'id' | 'createdAt'>): Promise<Paciente> {
    this.validarPaciente(paciente);

    const { data, error } = await this.supabase
      .from('pacientes')
      .update(this.toPacientePayload(paciente))
      .eq('id', id)
      .select('*')
      .single<PacienteRow>();

    if (error) {
      throw error;
    }

    return this.mapPaciente(data);
  }

  async desactivarPaciente(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('pacientes')
      .update({ activo: false })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  eliminarPaciente(id: string): Promise<void> {
    return this.desactivarPaciente(id);
  }

  private async obtenerPacientes(): Promise<Paciente[]> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .select('*')
      .order('apellidos', { ascending: true })
      .order('nombres', { ascending: true });

    if (error) {
      throw error;
    }

    return (data as PacienteRow[]).map(item => this.mapPaciente(item));
  }

  private validarPaciente(paciente: Omit<Paciente, 'id'>): void {
    if (!paciente.nombres.trim() || !paciente.apellidos.trim()) {
      throw new Error('Completa nombres y apellidos.');
    }

    if (!esDniValido(paciente.documento)) {
      throw new Error('El DNI debe tener 8 digitos.');
    }

    if (!esTelefonoValido(paciente.telefono)) {
      throw new Error('El telefono debe tener entre 7 y 15 digitos.');
    }

    if (paciente.email && !esEmailValido(paciente.email)) {
      throw new Error('El correo no tiene un formato valido.');
    }
  }

  private toPacientePayload(paciente: Omit<Paciente, 'id'>) {
    return {
      usuario_id: paciente.usuarioId ?? null,
      nombres: paciente.nombres.trim(),
      apellidos: paciente.apellidos.trim(),
      dni: paciente.documento.trim(),
      telefono: paciente.telefono.trim(),
      email: paciente.email?.trim() || null,
      fecha_nacimiento: paciente.fechaNacimiento || null,
      direccion: paciente.direccion?.trim() || null,
      grupo_sanguineo: paciente.grupoSanguineo?.trim() || null,
      alergias: paciente.alergias?.trim() || null,
      antecedentes: paciente.antecedentes?.trim() || null,
      activo: paciente.estado !== 'Inactivo'
    };
  }

  private mapPaciente(row: PacienteRow): Paciente {
    return {
      id: row.id,
      usuarioId: row.usuario_id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      documento: row.dni,
      telefono: row.telefono,
      email: row.email ?? '',
      fechaNacimiento: row.fecha_nacimiento ?? '',
      direccion: row.direccion ?? '',
      grupoSanguineo: row.grupo_sanguineo ?? '',
      alergias: row.alergias ?? '',
      antecedentes: row.antecedentes ?? '',
      estado: row.activo ? 'Activo' : 'Inactivo',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export type { Paciente };
