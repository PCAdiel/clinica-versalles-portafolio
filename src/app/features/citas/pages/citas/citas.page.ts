import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea
} from '@ionic/angular/standalone';
import { Observable } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { Cita, CitasService, EstadoCita } from '@features/citas/data-access/citas.service';
import { Medico, MedicosService } from '@features/medicos/data-access/medicos.service';
import { Paciente, PacientesService } from '@features/pacientes/data-access/pacientes.service';
import { ESTADO_CITA_LABELS } from '@features/citas/models/cita.model';
import { esFechaActualOFutura } from '@shared/validators/clinic.validators';
import { ConfirmationService } from '@shared/ui/confirmation.service';

interface CambioEstadoCita {
  header: string;
  message: string;
  confirmText: string;
  successMessage: string;
  fallbackError: string;
  action: (id: string) => Promise<void>;
}

@Component({
  selector: 'app-citas',
  templateUrl: './citas.page.html',
  styleUrls: ['./citas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea
  ]
})
export class CitasPage implements OnInit {
  private readonly citasService = inject(CitasService);
  private readonly pacientesService = inject(PacientesService);
  private readonly medicosService = inject(MedicosService);
  private readonly authService = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  citas$!: Observable<Cita[]>;
  pacientes$!: Observable<Paciente[]>;
  medicos$!: Observable<Medico[]>;

  idEdicion: string | null = null;
  pacienteNombre = '';
  medicoNombre = '';
  especialidad = '';

  readonly citaForm = this.fb.nonNullable.group({
    pacienteId: ['', Validators.required],
    medicoId: ['', Validators.required],
    motivo: [''],
    tipoConsulta: ['Consulta General'],
    fecha: ['', Validators.required],
    hora: ['', Validators.required],
    estado: this.fb.nonNullable.control<EstadoCita>('pendiente', Validators.required),
    mensaje: ['']
  });

  horarios = ['08:00', '09:00', '10:30', '11:30', '12:00', '13:30', '15:00', '16:30'];
  isGuardando = false;
  mensajeExito = '';
  mensajeError = '';

  ngOnInit(): void {
    this.citas$ = this.citasService.listarCitas();
    this.pacientes$ = this.pacientesService.listarPacientes();
    this.medicos$ = this.medicosService.listarMedicos();

    const usuario = this.authService.getUsuarioActual();

    if (usuario?.rol === 'paciente' && usuario.pacienteId) {
      this.citaForm.controls.pacienteId.setValue(usuario.pacienteId);
    }
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista', 'paciente']);
  }

  get puedeEditarCitas(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista']);
  }

  get puedeConfirmarCancelar(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista']);
  }

  get puedeCancelarCitas(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista', 'paciente']);
  }

  get puedeAtender(): boolean {
    return this.authService.tieneRol(['admin', 'medico']);
  }

  get esPaciente(): boolean {
    return this.authService.tieneRol(['paciente']);
  }

  seleccionarPaciente(pacientes: Paciente[]): void {
    const paciente = pacientes.find(item => item.id === this.citaForm.controls.pacienteId.value);
    this.pacienteNombre = paciente ? `${paciente.nombres} ${paciente.apellidos}` : '';
  }

  seleccionarMedico(medicos: Medico[]): void {
    const medico = medicos.find(item => item.id === this.citaForm.controls.medicoId.value);
    this.medicoNombre = medico ? `Dr(a). ${medico.nombres} ${medico.apellidos}` : '';
    this.especialidad = medico?.especialidad ?? '';
  }

  seleccionarHora(hora: string): void {
    this.citaForm.controls.hora.setValue(hora);
  }

  estadoLabel(estado: EstadoCita): string {
    return ESTADO_CITA_LABELS[estado];
  }

  async guardarCita(): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    const usuario = this.authService.getUsuarioActual();

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite crear o editar citas.';
      return;
    }

    if (this.idEdicion && !this.puedeEditarCitas) {
      this.mensajeError = 'Tu rol no permite editar citas existentes.';
      return;
    }

    if (usuario?.rol === 'paciente') {
      this.citaForm.controls.pacienteId.setValue(usuario.pacienteId ?? '');
      this.citaForm.controls.estado.setValue('pendiente');
    }

    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      this.mensajeError = 'Selecciona paciente, medico, fecha y hora.';
      return;
    }

    const form = this.citaForm.getRawValue();

    if (!esFechaActualOFutura(form.fecha)) {
      this.mensajeError = 'La fecha de la cita no puede estar en el pasado.';
      return;
    }

    const datosCita: Omit<Cita, 'id'> = {
      pacienteId: form.pacienteId,
      pacienteNombre: this.pacienteNombre,
      medicoId: form.medicoId,
      medicoNombre: this.medicoNombre,
      especialidad: this.especialidad,
      fecha: form.fecha,
      hora: form.hora,
      estado: form.estado,
      motivo: form.motivo.trim(),
      tipoConsulta: form.tipoConsulta,
      mensaje: form.mensaje.trim(),
      creadoPor: usuario?.uid
    };

    try {
      this.isGuardando = true;
      if (this.idEdicion) {
        await this.citasService.actualizarCita(this.idEdicion, datosCita);
        this.mensajeExito = 'Cita actualizada correctamente.';
      } else {
        await this.citasService.crearCita(datosCita);
        this.mensajeExito = 'Cita registrada correctamente.';
      }
      this.limpiarFormulario();
      this.citas$ = this.citasService.listarCitas();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo guardar la cita.';
    } finally {
      this.isGuardando = false;
    }
  }

  prepararEdicion(cita: Cita): void {
    if (!this.puedeEditarCitas) {
      this.mensajeError = 'Tu rol no permite editar citas existentes.';
      return;
    }

    if (cita.estado === 'atendida') {
      this.mensajeError = 'No se puede modificar una cita atendida.';
      return;
    }

    this.idEdicion = cita.id ?? null;
    this.pacienteNombre = cita.pacienteNombre;
    this.medicoNombre = cita.medicoNombre;
    this.especialidad = cita.especialidad;
    this.citaForm.setValue({
      pacienteId: cita.pacienteId,
      medicoId: cita.medicoId,
      fecha: cita.fecha,
      hora: cita.hora,
      estado: cita.estado,
      motivo: cita.motivo ?? '',
      tipoConsulta: cita.tipoConsulta ?? 'Consulta General',
      mensaje: cita.mensaje ?? ''
    });
  }

  async confirmarCita(id?: string): Promise<void> {
    await this.cambiarEstado(id, {
      header: 'Confirmar cita',
      message: 'La cita pasara al estado confirmada.',
      confirmText: 'Confirmar',
      successMessage: 'Cita confirmada correctamente.',
      fallbackError: 'No se pudo confirmar la cita.',
      action: citaId => this.citasService.confirmarCita(citaId)
    });
  }

  async marcarAtendida(id?: string): Promise<void> {
    await this.cambiarEstado(id, {
      header: 'Marcar como atendida',
      message: 'La cita quedara registrada como atendida y ya no podra modificarse.',
      confirmText: 'Marcar atendida',
      successMessage: 'Cita marcada como atendida.',
      fallbackError: 'No se pudo atender la cita.',
      action: citaId => this.citasService.marcarAtendida(citaId)
    });
  }

  async cancelarCita(id?: string): Promise<void> {
    await this.cambiarEstado(id, {
      header: 'Cancelar cita',
      message: 'Esta accion cancelara la cita seleccionada.',
      confirmText: 'Cancelar cita',
      successMessage: 'Cita cancelada correctamente.',
      fallbackError: 'No se pudo cancelar la cita.',
      action: citaId => this.citasService.cancelarCita(citaId)
    });
  }

  limpiarFormulario(): void {
    this.idEdicion = null;
    this.pacienteNombre = '';
    this.medicoNombre = '';
    this.especialidad = '';
    this.citaForm.reset({
      pacienteId: this.authService.getUsuarioActual()?.pacienteId ?? '',
      medicoId: '',
      fecha: '',
      hora: '',
      estado: 'pendiente',
      motivo: '',
      tipoConsulta: 'Consulta General',
      mensaje: ''
    });
  }

  private async cambiarEstado(id: string | undefined, options: CambioEstadoCita): Promise<void> {
    if (!id) {
      this.mensajeError = 'No se encontro el ID de la cita.';
      return;
    }

    if (!await this.confirmation.confirm({
      header: options.header,
      message: options.message,
      confirmText: options.confirmText
    })) {
      return;
    }

    try {
      await options.action(id);
      this.mensajeExito = options.successMessage;
      this.mensajeError = '';
      this.citas$ = this.citasService.listarCitas();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : options.fallbackError;
    }
  }

}
