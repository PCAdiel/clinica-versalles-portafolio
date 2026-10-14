import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import { UsuarioSistema } from '@features/configuracion/models/usuario.model';
import { esEmailValido } from '@shared/validators/clinic.validators';

interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: UsuarioSistema['rol'];
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface CrearUsuarioResponse {
  usuario: UsuarioRow;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly supabaseClient = inject(SupabaseClientService);

  private get supabase() {
    return this.supabaseClient.client;
  }

  listarUsuarios(): Observable<UsuarioSistema[]> {
    return defer(() => from(this.obtenerUsuarios()));
  }

  async agregarUsuario(usuario: Omit<UsuarioSistema, 'id'>): Promise<UsuarioSistema> {
    this.validarUsuario(usuario);

    const { data, error } = await this.supabase.functions.invoke<CrearUsuarioResponse>('admin-create-user', {
      body: {
        nombre: usuario.nombre,
        email: usuario.email,
        password: usuario.password,
        telefono: usuario.telefono,
        rol: usuario.rol,
        activo: usuario.estado !== 'Inactivo',
        pacienteId: usuario.pacienteId,
        especialidad: usuario.especialidad
      }
    });

    if (error) {
      throw error;
    }

    if (!data?.usuario) {
      throw new Error('La Edge Function no devolvio el usuario creado.');
    }

    return this.mapUsuario(data.usuario);
  }

  async actualizarUsuario(id: string, usuario: Omit<UsuarioSistema, 'id' | 'createdAt'>): Promise<UsuarioSistema> {
    this.validarUsuario(usuario);

    const { data, error } = await this.supabase
      .from('usuarios')
      .update(this.toUsuarioPayload(usuario))
      .eq('id', id)
      .select('*')
      .single<UsuarioRow>();

    if (error) {
      throw error;
    }

    return this.mapUsuario(data);
  }

  async eliminarUsuario(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('usuarios')
      .update({ activo: false })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  private async obtenerUsuarios(): Promise<UsuarioSistema[]> {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as UsuarioRow[]).map(row => this.mapUsuario(row));
  }

  private validarUsuario(usuario: Omit<UsuarioSistema, 'id'>): void {
    if (!usuario.nombre.trim() || !esEmailValido(usuario.email)) {
      throw new Error('Completa nombre y un correo valido.');
    }

    if (!usuario.uid && (!usuario.password || usuario.password.length < 8)) {
      throw new Error('La contrasena debe tener al menos 8 caracteres.');
    }

    if (!usuario.uid && usuario.rol === 'paciente' && !usuario.pacienteId?.trim()) {
      throw new Error('Selecciona el paciente existente al que se le dara acceso.');
    }

    if (!usuario.uid && usuario.rol === 'medico' && !usuario.especialidad?.trim()) {
      throw new Error('Indica la especialidad para crear un medico.');
    }
  }

  private toUsuarioPayload(usuario: Omit<UsuarioSistema, 'id'>) {
    return {
      nombre: usuario.nombre.trim(),
      email: usuario.email.trim().toLowerCase(),
      telefono: usuario.telefono?.trim() || null,
      rol: usuario.rol,
      activo: usuario.estado !== 'Inactivo'
    };
  }

  private mapUsuario(row: UsuarioRow): UsuarioSistema {
    return {
      id: row.id,
      uid: row.id,
      nombre: row.nombre,
      email: row.email,
      telefono: row.telefono ?? '',
      rol: row.rol,
      estado: row.activo ? 'Activo' : 'Inactivo',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export type { UsuarioSistema };
