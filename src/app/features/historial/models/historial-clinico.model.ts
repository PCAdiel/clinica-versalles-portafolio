export interface HistorialClinico {
  id?: string;
  pacienteId: string;
  pacienteNombre: string;
  citaId?: string;
  medicoId?: string;
  medicoNombre?: string;
  diagnostico: string;
  tratamiento: string;
  observaciones?: string;
  fecha: string;
  createdAt?: string;
  updatedAt?: string;
}
