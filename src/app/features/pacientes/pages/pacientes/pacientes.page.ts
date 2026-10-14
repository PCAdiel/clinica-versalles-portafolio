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
import { Paciente, PacientesService } from '@features/pacientes/data-access/pacientes.service';
import { ConfirmationService } from '@shared/ui/confirmation.service';

@Component({
  selector: 'app-pacientes',
  templateUrl: './pacientes.page.html',
  styleUrls: ['./pacientes.page.scss'],
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
export class PacientesPage implements OnInit {
  private readonly pacientesService = inject(PacientesService);
  private readonly authService = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  pacientes$!: Observable<Paciente[]>;
  pacienteSeleccionado: Paciente | null = null;
  idEdicion: string | null = null;

  readonly filtroForm = this.fb.nonNullable.group({
    busqueda: ['']
  });

  readonly pacienteForm = this.fb.nonNullable.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    documento: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]],
    email: ['', Validators.email],
    fechaNacimiento: [''],
    direccion: [''],
    grupoSanguineo: [''],
    alergias: [''],
    antecedentes: [''],
    estado: this.fb.nonNullable.control<'Activo' | 'Inactivo'>('Activo', Validators.required)
  });

  isGuardando = false;
  mensajeExito = '';
  mensajeError = '';

  ngOnInit(): void {
    this.pacientes$ = this.pacientesService.listarPacientes();
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista']);
  }

  filtrarPacientes(pacientes: Paciente[]): Paciente[] {
    const texto = this.filtroForm.controls.busqueda.value.trim().toLowerCase();

    if (!texto) {
      return pacientes;
    }

    return pacientes.filter(paciente =>
      `${paciente.nombres} ${paciente.apellidos} ${paciente.documento} ${paciente.telefono} ${paciente.email}`
        .toLowerCase()
        .includes(texto)
    );
  }

  seleccionarPaciente(paciente: Paciente): void {
    this.pacienteSeleccionado = paciente;
  }

  async guardarPaciente(): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite registrar o editar pacientes.';
      return;
    }

    if (this.pacienteForm.invalid) {
      this.pacienteForm.markAllAsTouched();
      this.mensajeError = 'Completa nombres, apellidos, DNI y telefono validos.';
      return;
    }

    const form = this.pacienteForm.getRawValue();
    const datos: Omit<Paciente, 'id'> = {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      documento: form.documento.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      fechaNacimiento: form.fechaNacimiento,
      direccion: form.direccion.trim(),
      grupoSanguineo: form.grupoSanguineo.trim(),
      alergias: form.alergias.trim(),
      antecedentes: form.antecedentes.trim(),
      estado: form.estado
    };

    try {
      this.isGuardando = true;
      if (this.idEdicion) {
        await this.pacientesService.actualizarPaciente(this.idEdicion, datos);
        this.mensajeExito = 'Paciente actualizado correctamente.';
      } else {
        await this.pacientesService.crearPaciente(datos);
        this.mensajeExito = 'Paciente registrado correctamente.';
      }
      this.limpiarFormulario();
      this.pacientes$ = this.pacientesService.listarPacientes();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo guardar el paciente.';
    } finally {
      this.isGuardando = false;
    }
  }

  prepararEdicion(paciente: Paciente): void {
    this.idEdicion = paciente.id ?? null;
    this.pacienteForm.setValue({
      nombres: paciente.nombres,
      apellidos: paciente.apellidos,
      documento: paciente.documento,
      telefono: paciente.telefono,
      email: paciente.email ?? '',
      fechaNacimiento: paciente.fechaNacimiento ?? '',
      direccion: paciente.direccion ?? '',
      grupoSanguineo: paciente.grupoSanguineo ?? '',
      alergias: paciente.alergias ?? '',
      antecedentes: paciente.antecedentes ?? '',
      estado: paciente.estado
    });
    this.seleccionarPaciente(paciente);
  }

  async eliminarPaciente(id?: string): Promise<void> {
    if (!id) {
      this.mensajeError = 'No se encontro el ID del paciente.';
      return;
    }

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite desactivar pacientes.';
      return;
    }

    const confirmado = await this.confirmation.confirm({
      header: 'Desactivar paciente',
      message: 'El paciente quedara inactivo y no deberia usarse para nuevos procesos.',
      confirmText: 'Desactivar'
    });

    if (!confirmado) {
      return;
    }

    try {
      await this.pacientesService.desactivarPaciente(id);
      this.mensajeExito = 'Paciente desactivado correctamente.';
      this.pacientes$ = this.pacientesService.listarPacientes();
      if (this.pacienteSeleccionado?.id === id) {
        this.pacienteSeleccionado = null;
      }
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo desactivar el paciente.';
    }
  }

  limpiarFormulario(): void {
    this.idEdicion = null;
    this.pacienteForm.reset({
      nombres: '',
      apellidos: '',
      documento: '',
      telefono: '',
      email: '',
      fechaNacimiento: '',
      direccion: '',
      grupoSanguineo: '',
      alergias: '',
      antecedentes: '',
      estado: 'Activo'
    });
  }

}
