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
  IonTextarea
} from '@ionic/angular/standalone';
import { Observable } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { Cita, CitasService } from '@features/citas/data-access/citas.service';
import {
  HistorialClinico,
  HistorialService
} from '@features/historial/data-access/historial.service';
import { Paciente, PacientesService } from '@features/pacientes/data-access/pacientes.service';
import { ConfirmationService } from '@shared/ui/confirmation.service';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.page.html',
  styleUrls: ['./historial.page.scss'],
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
    IonTextarea
  ]
})
export class HistorialPage implements OnInit {
  private readonly historialService = inject(HistorialService);
  private readonly pacientesService = inject(PacientesService);
  private readonly citasService = inject(CitasService);
  private readonly authService = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  historial$!: Observable<HistorialClinico[]>;
  pacientes$!: Observable<Paciente[]>;
  citas$!: Observable<Cita[]>;
  idEdicion: string | null = null;

  pacienteNombre = '';
  medicoNombre = '';

  readonly historialForm = this.fb.nonNullable.group({
    citaId: ['', Validators.required],
    pacienteId: ['', Validators.required],
    medicoId: ['', Validators.required],
    diagnostico: ['', Validators.required],
    tratamiento: ['', Validators.required],
    observaciones: [''],
    fecha: ['', Validators.required]
  });

  mensajeExito = '';
  mensajeError = '';
  isGuardando = false;

  ngOnInit(): void {
    this.historial$ = this.historialService.listarHistorial();
    this.pacientes$ = this.pacientesService.listarPacientes();
    this.citas$ = this.citasService.listarCitas();
    this.historialForm.controls.medicoId.setValue(this.authService.getUsuarioActual()?.medicoId ?? '');
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin', 'medico']);
  }

  seleccionarPaciente(pacientes: Paciente[]): void {
    const paciente = pacientes.find(item => item.id === this.historialForm.controls.pacienteId.value);
    this.pacienteNombre = paciente ? `${paciente.nombres} ${paciente.apellidos}` : '';
  }

  seleccionarCita(citas: Cita[]): void {
    const cita = citas.find(item => item.id === this.historialForm.controls.citaId.value);
    this.historialForm.patchValue({
      pacienteId: cita?.pacienteId ?? this.historialForm.controls.pacienteId.value,
      medicoId: cita?.medicoId ?? this.historialForm.controls.medicoId.value,
      fecha: cita?.fecha ?? this.historialForm.controls.fecha.value
    });
    this.pacienteNombre = cita?.pacienteNombre ?? this.pacienteNombre;
    this.medicoNombre = cita?.medicoNombre ?? this.medicoNombre;
  }

  async guardarHistorial(): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite registrar historial clinico.';
      return;
    }

    if (this.historialForm.invalid) {
      this.historialForm.markAllAsTouched();
      this.mensajeError = 'Selecciona cita, paciente, medico y completa diagnostico y tratamiento.';
      return;
    }

    const form = this.historialForm.getRawValue();
    const datos: Omit<HistorialClinico, 'id'> = {
      pacienteId: form.pacienteId,
      pacienteNombre: this.pacienteNombre,
      citaId: form.citaId,
      medicoId: form.medicoId,
      medicoNombre: this.medicoNombre,
      diagnostico: form.diagnostico.trim(),
      tratamiento: form.tratamiento.trim(),
      observaciones: form.observaciones.trim(),
      fecha: form.fecha
    };

    try {
      this.isGuardando = true;
      if (this.idEdicion) {
        await this.historialService.actualizarHistorial(this.idEdicion, datos);
        this.mensajeExito = 'Historial actualizado correctamente.';
      } else {
        await this.historialService.crearHistorial(datos);
        this.mensajeExito = 'Historial registrado correctamente.';
      }
      this.limpiarFormulario();
      this.historial$ = this.historialService.listarHistorial();
      this.citas$ = this.citasService.listarCitas();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo guardar el historial.';
    } finally {
      this.isGuardando = false;
    }
  }

  prepararEdicion(historial: HistorialClinico): void {
    this.idEdicion = historial.id ?? null;
    this.pacienteNombre = historial.pacienteNombre;
    this.medicoNombre = historial.medicoNombre ?? '';
    this.historialForm.setValue({
      pacienteId: historial.pacienteId,
      citaId: historial.citaId ?? '',
      medicoId: historial.medicoId ?? '',
      diagnostico: historial.diagnostico,
      tratamiento: historial.tratamiento,
      observaciones: historial.observaciones ?? '',
      fecha: historial.fecha
    });
  }

  async eliminarHistorial(id?: string): Promise<void> {
    if (!id) {
      this.mensajeError = 'No se encontro el ID del historial.';
      return;
    }

    if (!this.authService.tieneRol(['admin'])) {
      this.mensajeError = 'Solo el administrador puede eliminar historiales.';
      return;
    }

    const confirmado = await this.confirmation.confirm({
      header: 'Eliminar historial',
      message: 'Esta accion elimina un registro clinico. Confirma solo si es necesario para la demostracion.',
      confirmText: 'Eliminar'
    });

    if (!confirmado) {
      return;
    }

    try {
      await this.historialService.eliminarHistorial(id);
      this.mensajeExito = 'Historial eliminado correctamente.';
      this.historial$ = this.historialService.listarHistorial();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo eliminar el historial.';
    }
  }

  limpiarFormulario(): void {
    this.idEdicion = null;
    this.pacienteNombre = '';
    this.medicoNombre = '';
    this.historialForm.reset({
      citaId: '',
      pacienteId: '',
      medicoId: this.authService.getUsuarioActual()?.medicoId ?? '',
      diagnostico: '',
      tratamiento: '',
      observaciones: '',
      fecha: ''
    });
  }

}
