import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { open, print, refresh, send } from 'ionicons/icons';
import QRCode from 'qrcode';
import { AuthService } from '@core/auth/auth.service';
import {
  Comprobante,
  ESTADO_COMPROBANTE_LABELS,
  FacturacionEvento
} from '@features/facturacion/models/facturacion.model';
import { FacturacionService } from '@features/facturacion/services/facturacion.service';
import { NubefactService } from '@features/facturacion/services/nubefact.service';
import { esUrlPdfNubefactValida } from '@shared/validators/nubefact-url.validator';

@Component({
  selector: 'app-comprobante-preview',
  templateUrl: './comprobante-preview.page.html',
  styleUrls: ['./comprobante-preview.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSpinner
  ]
})
export class ComprobantePreviewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly facturacionService = inject(FacturacionService);
  private readonly nubefactService = inject(NubefactService);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);

  comprobante: Comprobante | null = null;
  eventos: FacturacionEvento[] = [];
  qrDataUrl = '';
  pdfSafeUrl: SafeResourceUrl | null = null;
  isCargando = false;
  procesando = false;
  mensajeExito = '';
  mensajeError = '';

  constructor() {
    addIcons({ send, refresh, print, open });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista']);
  }

  get esOficial(): boolean {
    return Boolean(this.comprobante?.pdfUrl || this.comprobante?.cadenaQr || this.comprobante?.estado === 'EMITIDO');
  }

  get puedeEmitir(): boolean {
    return Boolean(this.comprobante && this.puedeGestionar && this.facturacionService.puedeEmitir(this.comprobante));
  }

  estadoLabel(estado?: Comprobante['estado']): string {
    return estado ? ESTADO_COMPROBANTE_LABELS[estado] ?? estado : '';
  }

  async cargar(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.mensajeError = 'No se encontro el comprobante solicitado.';
      return;
    }

    this.isCargando = true;
    this.mensajeError = '';

    try {
      this.comprobante = await this.facturacionService.obtenerComprobante(id);
      this.eventos = this.comprobante ? await this.facturacionService.listarEventos(this.comprobante.id) : [];
      this.pdfSafeUrl = this.obtenerPdfSeguro(this.comprobante?.pdfUrl);
      if (this.comprobante?.pdfUrl && !this.pdfSafeUrl) {
        this.mensajeError = 'La URL del PDF no pertenece a un origen autorizado.';
      }
      await this.generarQr();

      if (!this.comprobante) {
        this.mensajeError = 'Comprobante no encontrado.';
      }
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo cargar el comprobante.';
    } finally {
      this.isCargando = false;
    }
  }

  async emitir(): Promise<void> {
    if (!this.comprobante) {
      return;
    }

    await this.operar(() => this.nubefactService.emitir(this.comprobante!.id), 'Comprobante emitido correctamente.');
  }

  async consultar(): Promise<void> {
    if (!this.comprobante) {
      return;
    }

    await this.operar(() => this.nubefactService.consultar(this.comprobante!.id), 'Estado consultado correctamente.');
  }

  abrirPdf(): void {
    const pdfUrl = this.getPdfUrlAutorizada();
    if (!pdfUrl) {
      this.mensajeError = 'El comprobante aun no tiene PDF oficial.';
      return;
    }

    window.open(pdfUrl, '_blank', 'noopener');
  }

  imprimir(): void {
    const pdfUrl = this.getPdfUrlAutorizada();
    if (!pdfUrl) {
      this.mensajeError = 'El comprobante aun no tiene PDF oficial para imprimir.';
      return;
    }

    const ventana = window.open(pdfUrl, '_blank', 'noopener');
    ventana?.addEventListener('load', () => ventana.print());
  }

  private async operar(accion: () => Promise<unknown>, mensaje: string): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite operar comprobantes.';
      return;
    }

    try {
      this.procesando = true;
      await accion();
      this.mensajeExito = mensaje;
      await this.cargar();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo completar la operacion.';
    } finally {
      this.procesando = false;
    }
  }

  private async generarQr(): Promise<void> {
    this.qrDataUrl = '';

    if (!this.comprobante?.cadenaQr) {
      return;
    }

    this.qrDataUrl = await QRCode.toDataURL(this.comprobante.cadenaQr, {
      margin: 1,
      width: 180
    });
  }

  private getPdfUrlAutorizada(): string | null {
    const pdfUrl = this.comprobante?.pdfUrl;
    if (!pdfUrl || !esUrlPdfNubefactValida(pdfUrl)) {
      this.mensajeError = 'La URL del PDF no pertenece a un origen autorizado.';
      return null;
    }
    return pdfUrl;
  }

  private obtenerPdfSeguro(pdfUrl?: string | null): SafeResourceUrl | null {
    return pdfUrl && esUrlPdfNubefactValida(pdfUrl)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl)
      : null;
  }

}
