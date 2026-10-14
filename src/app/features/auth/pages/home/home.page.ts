import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  eyeOutline,
  logInOutline,
  lockClosedOutline,
  personOutline
} from 'ionicons/icons';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonInput,
    IonItem
  ]
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  mensajeError = '';
  isLoading = false;
  mostrarPassword = false;

  constructor() {
    addIcons({
      personOutline,
      lockClosedOutline,
      eyeOutline,
      logInOutline
    });
  }

  async login(): Promise<void> {
    this.mensajeError = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.mensajeError = 'Ingresa un correo valido y tu contrasena.';
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    try {
      this.isLoading = true;
      const usuario = await this.authService.login(email, password);

      if (!usuario) {
        this.mensajeError = 'Correo o contrasena incorrectos.';
        return;
      }

      await this.router.navigate([this.authService.getDefaultRouteForRole(usuario.rol)]);
    } catch (error) {
      this.mensajeError = error instanceof Error
        ? error.message
        : 'No se pudo iniciar sesion. Revisa la configuracion de Supabase.';
    } finally {
      this.isLoading = false;
    }
  }

  alternarPassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }
}
