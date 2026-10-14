export type RolUsuario = 'admin' | 'recepcionista' | 'medico' | 'paciente';

export const ROLES_USUARIO: RolUsuario[] = ['admin', 'recepcionista', 'medico', 'paciente'];

export const ROLE_LABELS: Record<RolUsuario, string> = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  medico: 'Medico',
  paciente: 'Paciente'
};

export interface UsuarioSesion {
  uid: string;
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  pacienteId?: string;
  medicoId?: string;
}

export interface RegistroPacienteAuth {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  email: string;
  password: string;
  direccion?: string;
  fechaNacimiento?: string;
}
