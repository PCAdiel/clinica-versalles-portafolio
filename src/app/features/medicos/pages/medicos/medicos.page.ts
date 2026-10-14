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
  IonSelectOption
} from '@ionic/angular/standalone';
import { Observable } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { Medico, MedicosService } from '@features/medicos/data-access/medicos.service';
import { ConfirmationService } from '@shared/ui/confirmation.service';

@Component({
  selector: 'app-medicos',
  templateUrl: './medicos.page.html',
  styleUrls: ['./medicos.page.scss'],
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
    IonSelectOption
  ]
})
export class MedicosPage implements OnInit {
  private readonly medicosService = inject(MedicosService);
  private readonly authService = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  medicos$!: Observable<Medico[]>;
  idEdicion: string | null = null;

  readonly medicoForm = this.fb.nonNullable.group({
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    especialidad: ['Medicina General', Validators.required],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]],
    email: ['', [Validators.required, Validators.email]],
    colegiatura: [''],
    horario: [''],
    estado: this.fb.nonNullable.control<'Activo' | 'Inactivo'>('Activo', Validators.required)
  });

  especialidades = ['Medicina General', 'Pediatria', 'Cardiologia', 'Dermatologia', 'Traumatologia', 'Ginecologia', 'Odontologia'];
  mensajeExito = '';
  mensajeError = '';
  isGuardando = false;

  ngOnInit(): void {
    this.medicos$ = this.medicosService.listarMedicos();
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin']);
  }

  async guardarMedico(): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.puedeGestionar) {
      this.mensajeError = 'Solo el administrador puede registrar o editar medicos.';
      return;
    }

    if (this.medicoForm.invalid) {
      this.medicoForm.markAllAsTouched();
      this.mensajeError = 'Completa nombres, apellidos, especialidad, telefono y correo validos.';
      return;
    }

    const form = this.medicoForm.getRawValue();
    const datos: Omit<Medico, 'id'> = {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      especialidad: form.especialidad,
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      colegiatura: form.colegiatura.trim(),
      horario: form.horario.trim(),
      estado: form.estado
    };

    try {
      this.isGuardando = true;
      if (this.idEdicion) {
        await this.medicosService.actualizarMedico(this.idEdicion, datos);
        this.mensajeExito = 'Medico actualizado correctamente.';
      } else {
        await this.medicosService.crearMedico(datos);
        this.mensajeExito = 'Medico registrado correctamente.';
      }
      this.limpiarFormulario();
      this.medicos$ = this.medicosService.listarMedicos();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo guardar el medico.';
    } finally {
      this.isGuardando = false;
    }
  }

  prepararEdicion(medico: Medico): void {
    this.idEdicion = medico.id ?? null;
    this.medicoForm.setValue({
      nombres: medico.nombres,
      apellidos: medico.apellidos,
      especialidad: medico.especialidad,
      telefono: medico.telefono,
      email: medico.email,
      colegiatura: medico.colegiatura ?? '',
      horario: medico.horario ?? '',
      estado: medico.estado
    });
  }

  async eliminarMedico(id?: string): Promise<void> {
    if (!id) {
      this.mensajeError = 'No se encontro el ID del medico.';
      return;
    }

    if (!this.puedeGestionar) {
      this.mensajeError = 'Solo el administrador puede desactivar medicos.';
      return;
    }

    const confirmado = await this.confirmation.confirm({
      header: 'Desactivar medico',
      message: 'El medico quedara inactivo para la gestion operativa.',
      confirmText: 'Desactivar'
    });

    if (!confirmado) {
      return;
    }

    try {
      await this.medicosService.desactivarMedico(id);
      this.mensajeExito = 'Medico desactivado correctamente.';
      this.medicos$ = this.medicosService.listarMedicos();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo desactivar el medico.';
    }
  }

  limpiarFormulario(): void {
    this.idEdicion = null;
    this.medicoForm.reset({
      nombres: '',
      apellidos: '',
      especialidad: 'Medicina General',
      telefono: '',
      email: '',
      colegiatura: '',
      horario: '',
      estado: 'Activo'
    });
  }

}
