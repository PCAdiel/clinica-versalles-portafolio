import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import { Observable } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { Cita, CitasService } from '@features/citas/data-access/citas.service';
import { ESTADO_COMPROBANTE_LABELS } from '@features/facturacion/models/facturacion.model';
import { FacturacionService } from '@features/facturacion/services/facturacion.service';
import { NubefactService } from '@features/facturacion/services/nubefact.service';
import { EstadoPago, Pago, PagosService } from '@features/pagos/data-access/pagos.service';
import { ESTADO_PAGO_LABELS } from '@features/pagos/models/pago.model';
import { ConfirmationService } from '@shared/ui/confirmation.service';

@Component({
  selector: 'app-pagos',
  templateUrl: './pagos.page.html',
  styleUrls: ['./pagos.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonCheckbox,
    IonContent,
    IonInput,
    IonItem,
    IonList,
    IonSelect,
    IonSelectOption
  ]
})
export class PagosPage implements OnInit {
  private readonly pagosService = inject(PagosService);
  private readonly citasService = inject(CitasService);
  private readonly facturacionService = inject(FacturacionService);
  private readonly nubefactService = inject(NubefactService);
  private readonly authService = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  pagos$!: Observable<Pago[]>;
  citas$!: Observable<Cita[]>;
  idEdicion: string | null = null;

  pacienteNombre = '';

  readonly pagoForm = this.fb.group({
    citaId: this.fb.nonNullable.control('', Validators.required),
    pacienteId: this.fb.nonNullable.control('', Validators.required),
    concepto: this.fb.nonNullable.control('Consulta medica', Validators.required),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    metodoPago: this.fb.nonNullable.control<Pago['metodoPago']>('Efectivo', Validators.required),
    estado: this.fb.nonNullable.control<EstadoPago>('pendiente', Validators.required),
    fechaPago: this.fb.nonNullable.control('', Validators.required),
    generarComprobante: this.fb.nonNullable.control(false),
    tipoComprobante: this.fb.nonNullable.control<Pago['tipoComprobante']>('BOLETA'),
    clienteNumeroDocumento: this.fb.nonNullable.control(''),
    clienteDenominacion: this.fb.nonNullable.control(''),
    clienteDireccion: this.fb.nonNullable.control('')
  });

  mensajeExito = '';
  mensajeError = '';
  isGuardando = false;
  procesandoComprobanteId = '';

  ngOnInit(): void {
    this.pagos$ = this.pagosService.listarPagos();
    this.citas$ = this.citasService.listarCitas();
  }

  get puedeGestionar(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista']);
  }

  get puedeAnular(): boolean {
    return this.authService.tieneRol(['admin']);
  }

  estadoLabel(estado: EstadoPago): string {
    return ESTADO_PAGO_LABELS[estado];
  }

  comprobanteEstadoLabel(pago: Pago): string {
    const estado = pago.comprobante?.estado;
    return estado ? ESTADO_COMPROBANTE_LABELS[estado] ?? estado : 'Sin comprobante';
  }

  get muestraDatosFactura(): boolean {
    return this.pagoForm.controls.generarComprobante.value
      && this.pagoForm.controls.tipoComprobante.value === 'FACTURA';
  }

  seleccionarCita(citas: Cita[]): void {
    const cita = citas.find(item => item.id === this.pagoForm.controls.citaId.value);
    this.pacienteNombre = cita?.pacienteNombre ?? '';
    this.pagoForm.patchValue({
      pacienteId: cita?.pacienteId ?? '',
      concepto: cita ? `${cita.tipoConsulta ?? 'Consulta'} - ${cita.especialidad}` : 'Consulta medica'
    });
  }

  async guardarPago(): Promise<void> {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.puedeGestionar) {
      this.mensajeError = 'Tu rol no permite registrar pagos.';
      return;
    }

    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      this.mensajeError = 'Selecciona una cita, monto valido, metodo, estado y fecha de pago.';
      return;
    }

    const form = this.pagoForm.getRawValue();
    const datos: Omit<Pago, 'id'> = {
      citaId: form.citaId,
      pacienteId: form.pacienteId,
      pacienteNombre: this.pacienteNombre,
      concepto: form.concepto,
      monto: Number(form.monto),
      metodoPago: form.metodoPago,
      estado: form.estado,
      fechaPago: form.fechaPago,
      generarComprobante: form.generarComprobante,
      tipoComprobante: form.generarComprobante ? form.tipoComprobante : undefined,
      clienteTipoDocumento: form.tipoComprobante === 'FACTURA' ? 'RUC' : 'DNI',
      clienteNumeroDocumento: form.clienteNumeroDocumento,
      clienteDenominacion: form.clienteDenominacion,
      clienteDireccion: form.clienteDireccion
    };

    if (datos.generarComprobante && datos.tipoComprobante === 'FACTURA' && !this.facturaValida(datos)) {
      this.mensajeError = 'Para factura ingresa RUC de 11 digitos, razon social y direccion fiscal.';
      return;
    }

    try {
      this.isGuardando = true;
      if (this.idEdicion) {
        await this.pagosService.actualizarPago(this.idEdicion, datos);
        this.mensajeExito = 'Pago actualizado correctamente.';
      } else {
        await this.pagosService.registrarPago(datos);
        this.mensajeExito = 'Pago registrado correctamente.';
      }
      this.limpiarFormulario();
      this.pagos$ = this.pagosService.listarPagos();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo guardar el pago.';
    } finally {
      this.isGuardando = false;
    }
  }

  prepararEdicion(pago: Pago): void {
    this.idEdicion = pago.id ?? null;
    this.pacienteNombre = pago.pacienteNombre;
    this.pagoForm.setValue({
      citaId: pago.citaId,
      pacienteId: pago.pacienteId,
      concepto: pago.concepto,
      monto: pago.monto,
      metodoPago: pago.metodoPago,
      estado: pago.estado,
      fechaPago: pago.fechaPago,
      generarComprobante: Boolean(pago.comprobante),
      tipoComprobante: pago.tipoComprobante ?? 'BOLETA',
      clienteNumeroDocumento: pago.clienteNumeroDocumento ?? '',
      clienteDenominacion: pago.clienteDenominacion ?? '',
      clienteDireccion: pago.clienteDireccion ?? ''
    });
  }

  async eliminarPago(id?: string): Promise<void> {
    if (!id) {
      this.mensajeError = 'No se encontro el ID del pago.';
      return;
    }

    if (!this.puedeAnular) {
      this.mensajeError = 'Solo administrador puede anular pagos.';
      return;
    }

    const confirmado = await this.confirmation.confirm({
      header: 'Anular pago',
      message: 'El pago quedara marcado como anulado. Esta accion debe usarse solo si corresponde.',
      confirmText: 'Anular'
    });

    if (!confirmado) {
      return;
    }

    try {
      await this.pagosService.actualizarEstadoPago(id, 'anulado');
      this.mensajeExito = 'Pago anulado correctamente.';
      this.pagos$ = this.pagosService.listarPagos();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo anular el pago.';
    }
  }

  limpiarFormulario(): void {
    this.idEdicion = null;
    this.pacienteNombre = '';
    this.pagoForm.reset({
      citaId: '',
      pacienteId: '',
      concepto: 'Consulta medica',
      monto: null,
      metodoPago: 'Efectivo',
      estado: 'pendiente',
      fechaPago: '',
      generarComprobante: false,
      tipoComprobante: 'BOLETA',
      clienteNumeroDocumento: '',
      clienteDenominacion: '',
      clienteDireccion: ''
    });
  }

  async previsualizar(pago: Pago): Promise<void> {
    if (!pago.comprobante?.id) {
      this.mensajeError = 'Este pago no tiene comprobante para previsualizar.';
      return;
    }

    await this.router.navigate(['/dashboard/facturacion', pago.comprobante.id, 'preview']);
  }

  async emitir(pago: Pago): Promise<void> {
    if (!pago.comprobante?.id) {
      this.mensajeError = 'Este pago no tiene comprobante para emitir.';
      return;
    }

    await this.operarComprobante(pago.comprobante.id, () => this.nubefactService.emitir(pago.comprobante!.id), 'Comprobante enviado correctamente.');
  }

  async consultarEstado(pago: Pago): Promise<void> {
    if (!pago.comprobante?.id) {
      this.mensajeError = 'Este pago no tiene comprobante para consultar.';
      return;
    }

    await this.operarComprobante(pago.comprobante.id, () => this.nubefactService.consultar(pago.comprobante!.id), 'Estado consultado correctamente.');
  }

  abrirPdf(pago: Pago): void {
    const pdfUrl = pago.comprobante?.pdfUrl;

    if (!pdfUrl) {
      this.mensajeError = 'El comprobante aun no tiene PDF oficial.';
      return;
    }

    window.open(pdfUrl, '_blank', 'noopener');
  }

  imprimir(pago: Pago): void {
    const pdfUrl = pago.comprobante?.pdfUrl;

    if (!pdfUrl) {
      this.mensajeError = 'El comprobante aun no tiene PDF oficial para imprimir.';
      return;
    }

    const ventana = window.open(pdfUrl, '_blank', 'noopener');
    ventana?.addEventListener('load', () => ventana.print());
  }

  puedeEmitir(pago: Pago): boolean {
    return Boolean(pago.comprobante && this.puedeGestionar && this.facturacionService.puedeEmitir(pago.comprobante));
  }

  private facturaValida(pago: Omit<Pago, 'id'>): boolean {
    const ruc = (pago.clienteNumeroDocumento ?? '').replace(/\D/g, '');
    return ruc.length === 11
      && Boolean(pago.clienteDenominacion?.trim())
      && Boolean(pago.clienteDireccion?.trim());
  }

  private async operarComprobante(
    comprobanteId: string,
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
      this.procesandoComprobanteId = comprobanteId;
      await accion();
      this.mensajeExito = mensaje;
      this.pagos$ = this.pagosService.listarPagos();
    } catch (error) {
      this.mensajeError = error instanceof Error ? error.message : 'No se pudo operar el comprobante.';
    } finally {
      this.procesandoComprobanteId = '';
    }
  }

}
