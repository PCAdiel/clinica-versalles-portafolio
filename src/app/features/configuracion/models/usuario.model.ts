import { EstadoRegistro } from '@shared/models/common.models';
import { RolUsuario } from '@shared/models/auth.models';

export interface UsuarioSistema {
  id?: string;
  uid?: string;
  nombre: string;
  email: string;
  password?: string;
  telefono?: string;
  rol: RolUsuario;
  estado: EstadoRegistro;
  pacienteId?: string;
  especialidad?: string;
  createdAt?: string;
  updatedAt?: string;
}
