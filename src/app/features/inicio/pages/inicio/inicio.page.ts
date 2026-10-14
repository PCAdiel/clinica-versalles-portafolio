import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRow
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addCircle,
  arrowForward,
  calendar,
  cash,
  checkmarkCircle,
  documentText,
  medical,
  people,
  pulse,
  time,
  trendingUp
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { AuthService, UsuarioSesion } from '@core/auth/auth.service';
import { Cita, CitasService } from '@features/citas/data-access/citas.service';
import { Medico, MedicosService } from '@features/medicos/data-access/medicos.service';
import { Paciente, PacientesService } from '@features/pacientes/data-access/pacientes.service';
import { Pago, PagosService } from '@features/pagos/data-access/pagos.service';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonButton
  ]
})
export class InicioPage implements OnInit {
  private readonly pacientesService = inject(PacientesService);
  private readonly citasService = inject(CitasService);
  private readonly pagosService = inject(PagosService);
  private readonly medicosService = inject(MedicosService);
  private readonly authService = inject(AuthService);

  pacientes: Paciente[] = [];
  citas: Cita[] = [];
  pagos: Pago[] = [];
  medicos: Medico[] = [];
  usuario: UsuarioSesion | null = this.authService.getUsuarioActual();
  mensajeError = '';

  constructor() {
    addIcons({
      people,
      calendar,
      medical,
      cash,
      documentText,
      trendingUp,
      checkmarkCircle,
      time,
      addCircle,
      arrowForward,
      pulse
    });
  }

  ngOnInit(): void {
    void this.cargarDatos();
  }

  private async cargarDatos(): Promise<void> {
    try {
      [this.pacientes, this.citas, this.pagos, this.medicos] = await Promise.all([
        firstValueFrom(this.pacientesService.listarPacientes()),
        firstValueFrom(this.citasService.listarCitas()),
        firstValueFrom(this.pagosService.listarPagos()),
        firstValueFrom(this.medicosService.listarMedicos())
      ]);
      this.mensajeError = '';
    } catch (error) {
      this.mensajeError = 'No se pudo cargar el resumen del dashboard.';
    }
  }

  get fechaActual(): string {
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
  }

  get horaActual(): string {
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());
  }

  get citasHoy(): number {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.citas.filter(cita => cita.fecha === hoy).length;
  }

  get citasPendientes(): number {
    return this.citas.filter(cita => cita.estado === 'pendiente').length;
  }

  get citasConfirmadas(): number {
    return this.citas.filter(cita => cita.estado === 'confirmada').length;
  }

  get pacientesActivos(): number {
    return this.pacientes.filter(paciente => paciente.estado === 'Activo').length;
  }

  get medicosActivos(): number {
    return this.medicos.filter(medico => medico.estado === 'Activo').length;
  }

  get ingresos(): number {
    return this.pagos
      .filter(pago => pago.estado === 'pagado')
      .reduce((total, pago) => total + Number(pago.monto || 0), 0);
  }

  get ultimasCitas(): Cita[] {
    return [...this.citas]
      .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
      .slice(0, 5);
  }

  get ultimosPacientes(): Paciente[] {
    return [...this.pacientes]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 5);
  }

  get especialidadesResumen(): { nombre: string; total: number; porcentaje: number }[] {
    const total = this.citas.length || 1;
    const conteo = this.citas.reduce((acc, cita) => {
      const nombre = cita.especialidad || 'Sin especialidad';
      acc[nombre] = (acc[nombre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(conteo)
      .map(([nombre, cantidad]) => ({
        nombre,
        total: cantidad,
        porcentaje: Math.round((cantidad / total) * 100)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }

  iniciales(nombre?: string, apellido?: string): string {
    const n = nombre?.trim().charAt(0) || '';
    const a = apellido?.trim().charAt(0) || '';
    return `${n}${a}`.toUpperCase() || 'CV';
  }

  estadoClase(estado?: string): string {
    return String(estado || '').toLowerCase().replace(' ', '-');
  }

  trackById(_: number, item: { id?: string }): string | undefined {
    return item.id;
  }
}
