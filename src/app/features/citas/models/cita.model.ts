export type EstadoCita = 'pendiente' | 'confirmada' | 'cancelada' | 'atendida' | 'no_asistio';

export const ESTADOS_CITA: EstadoCita[] = ['pendiente', 'confirmada', 'cancelada', 'atendida', 'no_asistio'];

export const ESTADO_CITA_LABELS: Record<EstadoCita, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  atendida: 'Atendida',
  no_asistio: 'No asistio'
};

export interface Cita {
  id?: string;
  pacienteId: string;
  pacienteNombre: string;
  medicoId: string;
  medicoNombre: string;
  especialidad: string;
  fecha: string;
  hora: string;
  estado: EstadoCita;
  motivo?: string;
  tipoConsulta?: string;
  mensaje?: string;
  creadoPor?: string;
  createdAt?: string;
  updatedAt?: string;
}
