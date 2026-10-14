import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { User } from '@supabase/supabase-js';
import { SupabaseClientService } from '@core/supabase/supabase.client';
import {
  RegistroPacienteAuth,
  RolUsuario,
  ROLE_LABELS,
  UsuarioSesion
} from '@shared/models/auth.models';
import { esDniValido, esEmailValido, esTelefonoValido } from '@shared/validators/clinic.validators';

interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

interface PacienteIdRow {
  id: string;
}

interface MedicoIdRow {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseClient = inject(SupabaseClientService);
  private readonly usuarioActual = signal<UsuarioSesion | null>(null);

  readonly usuarioActual$ = toObservable(this.usuarioActual);

  private get supabase() {
    return this.supabaseClient.client;
  }

  async login(email: string, password: string): Promise<UsuarioSesion | null> {
    const correo = email.trim().toLowerCase();

    if (!esEmailValido(correo) || !password) {
      return null;
    }

    const { error } = await this.supabase.auth.signInWithPassword({
      email: correo,
      password
    });

    if (error) {
      return null;
    }

    return this.getCurrentUserProfile(true);
  }

  async registerPaciente(data: RegistroPacienteAuth): Promise<UsuarioSesion | null> {
    const email = data.email.trim().toLowerCase();
    const dni = data.dni.trim();
    const telefono = data.telefono.trim();

    if (!esEmailValido(email)) {
      throw new Error('El correo no tiene un formato valido.');
    }

    if (!esDniValido(dni)) {
      throw new Error('El DNI debe tener 8 digitos.');
    }

    if (!esTelefonoValido(telefono)) {
      throw new Error('El telefono debe tener entre 7 y 15 digitos.');
    }

    if (data.password.length < 8 || !/[A-Za-z]/.test(data.password) || !/\d/.test(data.password)) {
      throw new Error('La contrasena debe tener al menos 8 caracteres, una letra y un numero.');
    }

    const { error: registroError } = await this.supabase.functions.invoke('register-patient', {
      body: {
        nombres: data.nombres.trim(), apellidos: data.apellidos.trim(), dni, telefono, email,
        password: data.password, direccion: data.direccion?.trim() || null, fechaNacimiento: data.fechaNacimiento || null
      }
    });

    if (registroError) {
      throw registroError;
    }

    const { error: loginError } = await this.supabase.auth.signInWithPassword({ email, password: data.password });
    if (loginError) {
      throw new Error('Registro creado. Confirma tu correo antes de iniciar sesion.');
    }

    return this.getCurrentUserProfile(true);
  }

  async logout(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } finally {
      this.usuarioActual.set(null);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data.user;
  }

  async getCurrentUserProfile(forceRefresh = false): Promise<UsuarioSesion | null> {
    if (!forceRefresh && this.usuarioActual()) {
      return this.usuarioActual();
    }

    const user = await this.getCurrentUser();

    if (!user) {
      this.usuarioActual.set(null);
      return null;
    }

    const { data: perfil, error } = await this.supabase
      .from('usuarios')
      .select('id,nombre,email,rol,activo')
      .eq('id', user.id)
      .eq('activo', true)
      .single<UsuarioRow>();

    if (error || !perfil) {
      this.usuarioActual.set(null);
      return null;
    }

    const [pacienteId, medicoId] = await Promise.all([
      this.obtenerPacienteId(perfil.id),
      this.obtenerMedicoId(perfil.id)
    ]);

    const sesion: UsuarioSesion = {
      uid: perfil.id,
      id: perfil.id,
      nombre: perfil.nombre,
      email: perfil.email,
      rol: perfil.rol,
      pacienteId,
      medicoId
    };

    this.usuarioActual.set(sesion);
    return sesion;
  }

  getUsuarioActual(): UsuarioSesion | null {
    return this.usuarioActual();
  }

  async isAuthenticated(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();

    if (!data.session) {
      this.usuarioActual.set(null);
      return false;
    }

    return Boolean(await this.getCurrentUserProfile(true));
  }

  estaAutenticado(): boolean {
    return this.usuarioActual() !== null;
  }

  async hasRole(rolesPermitidos: RolUsuario | RolUsuario[]): Promise<boolean> {
    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    const usuario = await this.getCurrentUserProfile();
    return Boolean(usuario && roles.includes(usuario.rol));
  }

  tieneRol(rolesPermitidos: RolUsuario[]): boolean {
    const usuario = this.getUsuarioActual();
    return Boolean(usuario && rolesPermitidos.includes(usuario.rol));
  }

  getRolLabel(rol: RolUsuario | undefined): string {
    return rol ? ROLE_LABELS[rol] : '';
  }

  getDefaultRouteForRole(rol: RolUsuario): string {
    const rutas: Record<RolUsuario, string> = {
      admin: '/dashboard/inicio',
      recepcionista: '/dashboard/citas',
      medico: '/dashboard/citas',
      paciente: '/dashboard/citas'
    };

    return rutas[rol];
  }



  private async obtenerPacienteId(usuarioId: string): Promise<string | undefined> {
    const { data, error } = await this.supabase
      .from('pacientes')
      .select('id')
      .eq('usuario_id', usuarioId)
      .maybeSingle<PacienteIdRow>();

    if (error) {
      return undefined;
    }

    return data?.id;
  }

  private async obtenerMedicoId(usuarioId: string): Promise<string | undefined> {
    const { data, error } = await this.supabase
      .from('medicos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .maybeSingle<MedicoIdRow>();

    if (error) {
      return undefined;
    }

    return data?.id;
  }

}

export type { RegistroPacienteAuth, RolUsuario, UsuarioSesion };
