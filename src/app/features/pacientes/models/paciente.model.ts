import { EstadoRegistro } from '@shared/models/common.models';

export interface Paciente {
  id?: string;
  usuarioId?: string | null;
  nombres: string;
  apellidos: string;
  documento: string;
  telefono: string;
  email?: string;
  fechaNacimiento?: string;
  direccion?: string;
  grupoSanguineo?: string;
  alergias?: string;
  antecedentes?: string;
  estado: EstadoRegistro;
  createdAt?: string;
  updatedAt?: string;
}
