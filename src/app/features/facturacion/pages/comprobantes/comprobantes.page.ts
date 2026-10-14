import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eye, print, refresh, receipt, send, trash } from 'ionicons/icons';
import { AuthService } from '@core/auth/auth.service';
import {
  Comprobante,
  ESTADO_COMPROBANTE_LABELS
} from '@features/facturacion/models/facturacion.model';
import {
  FacturacionService,
  FiltroComprobantes
} from '@features/facturacion/services/facturacion.service';
import { NubefactService } from '@features/facturacion/services/nubefact.service';
import { ConfirmationService } from '@shared/ui/confirmation.service';

@Component({
  selector: 'app-comprobantes',
  templateUrl: './comprobantes.page.html',
  styleUrls: ['./comprobantes.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonItem,
    IonList,
    IonSelect,
    IonSelectOption,
    IonSpinner
  ]
})
export class ComprobantesPage implements OnInit {
  private readonly facturacionService = inject(FacturacionService);
  private readonly nubefactService = inject(NubefactService);
  private readonly authService = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);

  comprobantes: Comprobante[] = [];
  filtro: FiltroComprobantes = 'todos';
  procesandoId = '';
  isCargando = false;
  mensajeExito = '';
  mensajeError = '';

  constructor() {
    addIcons({ receipt, eye, send, refresh, print, trash });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista']);
  }

  estadoLabel(estado: Comprobante['estado']): string {
    return ESTADO_COMPROBANTE_LABELS[estado] ?? estado;
  }

  puedeEmitir(comprobante: Comprobante): boolean {
    return this.puedeGestionar && this.facturacionService.puedeEmitir(comprobante);
  }

  async cargar(): Promise<void> {
    this.mensajeError = '';
    this.isCargando = true;

    try {
      this.comprobantes = await firstValueFrom(this.facturacionService.listarComprobantes(this.filtro));
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudieron cargar los comprobantes.';
    } finally {
      this.isCargando = false;
    }
  }

  async verPreview(comprobante: Comprobante): Promise<void> {
    await this.router.navigate(['/dashboard/facturacion', comprobante.id, 'preview']);
  }

  async emitir(comprobante: Comprobante): Promise<void> {
    await this.operar(comprobante, () => this.nubefactService.emitir(comprobante.id), 'Comprobante enviado correctamente.');
  }

  async consultar(comprobante: Comprobante): Promise<void> {
    await this.operar(comprobante, () => this.nubefactService.consultar(comprobante.id), 'Estado consultado correctamente.');
  }

  async anular(comprobante: Comprobante): Promise<void> {
    const confirmado = await this.confirmation.confirm({
      header: 'Anular comprobante',
      message: `Se solicitara la anulacion de ${comprobante.serie}-${comprobante.numero}.`,
      confirmText: 'Anular'
    });

    if (!confirmado) {
      return;
    }

    await this.operar(comprobante, () => this.nubefactService.anular(comprobante.id), 'Comprobante anulado correctamente.');
  }

  abrirPdf(comprobante: Comprobante): void {
    if (!comprobante.pdfUrl) {
      this.mensajeError = 'El comprobante aun no tiene PDF oficial.';
      return;
    }

    window.open(comprobante.pdfUrl, '_blank', 'noopener');
  }

  imprimir(comprobante: Comprobante): void {
    if (!comprobante.pdfUrl) {
      this.mensajeError = 'El comprobante aun no tiene PDF oficial para imprimir.';
      return;
    }

    const ventana = window.open(comprobante.pdfUrl, '_blank', 'noopener');
    ventana?.addEventListener('load', () => ventana.print());
  }

  private async operar(
    comprobante: Comprobante,
    accion: () => Promise<unknown>,
    mensaje: string
  ): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite operar comprobantes.';
      return;
    }

    try {
      this.procesandoId = comprobante.id;
      await accion();
      this.mensajeExito = mensaje;
      await this.cargar();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo completar la operacion.';
    } finally {
      this.procesandoId = '';
    }
  }
}
