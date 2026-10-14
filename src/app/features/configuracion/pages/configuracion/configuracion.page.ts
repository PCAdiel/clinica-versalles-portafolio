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
import { RolUsuario } from '@core/auth/auth.service';
import {
  UsuarioSistema,
  UsuariosService
} from '@features/configuracion/data-access/usuarios.service';
import { Paciente, PacientesService } from '@features/pacientes/data-access/pacientes.service';
import { ROLE_LABELS, ROLES_USUARIO } from '@shared/models/auth.models';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.page.html',
  styleUrls: ['./configuracion.page.scss'],
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
export class ConfiguracionPage implements OnInit {
  private readonly usuariosService = inject(UsuariosService);
  private readonly pacientesService = inject(PacientesService);
  private readonly fb = inject(FormBuilder);

  usuarios$!: Observable<UsuarioSistema[]>;
  pacientes$!: Observable<Paciente[]>;
  idEdicion: string | null = null;

  readonly usuarioForm = this.fb.nonNullable.group({
    uid: [''],
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    telefono: [''],
    rol: this.fb.nonNullable.control<RolUsuario>('recepcionista', Validators.required),
    estado: this.fb.nonNullable.control<'Activo' | 'Inactivo'>('Activo', Validators.required),
    pacienteId: [''],
    especialidad: ['Medicina General']
  });

  roles: RolUsuario[] = ROLES_USUARIO;
  mensajeExito = '';
  mensajeError = '';
  isGuardando = false;

  ngOnInit(): void {
    this.usuarios$ = this.usuariosService.listarUsuarios();
    this.pacientes$ = this.pacientesService.listarPacientes();
  }

  rolLabel(rol: RolUsuario): string {
    return ROLE_LABELS[rol];
  }

  async guardarUsuario(): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      this.mensajeError = 'Completa nombre, correo valido, rol y estado.';
      return;
    }

    const form = this.usuarioForm.getRawValue();
    const datos: Omit<UsuarioSistema, 'id'> = {
      uid: form.uid.trim() || undefined,
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      password: form.password,
      telefono: form.telefono.trim(),
      rol: form.rol,
      estado: form.estado,
      pacienteId: form.pacienteId,
      especialidad: form.especialidad.trim()
    };

    try {
      this.isGuardando = true;
      if (this.idEdicion) {
        await this.usuariosService.actualizarUsuario(this.idEdicion, datos);
        this.mensajeExito = 'Usuario actualizado correctamente.';
      } else {
        await this.usuariosService.agregarUsuario(datos);
        this.mensajeExito = 'Perfil de usuario registrado correctamente.';
      }
      this.limpiarFormulario();
      this.usuarios$ = this.usuariosService.listarUsuarios();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo guardar el usuario.';
    } finally {
      this.isGuardando = false;
    }
  }

  prepararEdicion(usuario: UsuarioSistema): void {
    this.idEdicion = usuario.id ?? null;
    this.usuarioForm.setValue({
      uid: usuario.uid ?? '',
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      telefono: usuario.telefono ?? '',
      rol: usuario.rol,
      estado: usuario.estado,
      pacienteId: '',
      especialidad: 'Medicina General'
    });
  }

  async eliminarUsuario(id?: string): Promise<void> {
    if (!id) {
      this.mensajeError = 'No se encontro el ID del usuario.';
      return;
    }

    try {
      await this.usuariosService.eliminarUsuario(id);
      this.mensajeExito = 'Usuario desactivado correctamente.';
      this.usuarios$ = this.usuariosService.listarUsuarios();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo desactivar el usuario.';
    }
  }

  limpiarFormulario(): void {
    this.idEdicion = null;
    this.usuarioForm.reset({
      uid: '',
      nombre: '',
      email: '',
      password: '',
      telefono: '',
      rol: 'recepcionista',
      estado: 'Activo',
      pacienteId: '',
      especialidad: 'Medicina General'
    });
  }
}
