import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatboxEllipses, close } from 'ionicons/icons';
import { ChatIaService } from '@features/chat-ai/data-access/chat-ia.service';

interface MensajeChat {
  autor: 'usuario' | 'ia';
  texto: string;
}

@Component({
  selector: 'app-chat-ia',
  templateUrl: './chat-ia.page.html',
  styleUrls: ['./chat-ia.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonSpinner
  ]
})
export class ChatIaPage {
  private readonly chatIaService = inject(ChatIaService);
  private readonly fb = inject(FormBuilder);

  readonly chatForm = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(1200)]]
  });

  mensajes: MensajeChat[] = [
    {
      autor: 'ia',
      texto: 'Hola. Puedo ayudarte con citas, pagos, pacientes y resumenes segun tu rol.'
    }
  ];
  isEnviando = false;
  mensajeError = '';
  isChatAbierto = false;

  constructor() {
    addIcons({ chatboxEllipses, close });
  }

  alternarChat(): void {
    this.isChatAbierto = !this.isChatAbierto;
    this.mensajeError = '';
  }

  async enviar(): Promise<void> {
    this.mensajeError = '';

    if (this.chatForm.invalid) {
      this.chatForm.markAllAsTouched();
      this.mensajeError = 'Escribe una consulta valida.';
      return;
    }

    const pregunta = this.chatForm.controls.mensaje.value.trim();
    this.mensajes.push({ autor: 'usuario', texto: pregunta });
    this.chatForm.reset({ mensaje: '' });

    try {
      this.isEnviando = true;
      const respuesta = await this.chatIaService.preguntar(pregunta);
      this.mensajes.push({ autor: 'ia', texto: respuesta });
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo consultar el chat IA.';
    } finally {
      this.isEnviando = false;
    }
  }
}
