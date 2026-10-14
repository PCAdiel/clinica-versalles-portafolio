import { EstadoRegistro } from '@shared/models/common.models';

export interface Medico {
  id?: string;
  usuarioId?: string | null;
  nombres: string;
  apellidos: string;
  especialidad: string;
  telefono: string;
  email: string;
  colegiatura?: string;
  horario?: string;
  estado: EstadoRegistro;
  createdAt?: string;
  updatedAt?: string;
}

export interface HorarioMedico {
  id?: string;
  medicoId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}
