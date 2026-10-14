import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { IonBadge, IonCard, IonCardContent, IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { Cita, CitasService } from '@features/citas/data-access/citas.service';
import { Medico, MedicosService } from '@features/medicos/data-access/medicos.service';
import { Paciente, PacientesService } from '@features/pacientes/data-access/pacientes.service';
import { Pago, PagosService } from '@features/pagos/data-access/pagos.service';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: true,
  imports: [CommonModule, IonBadge, IonCard, IonCardContent, IonContent]
})
export class ReportesPage implements OnInit {
  private readonly pacientesService = inject(PacientesService);
  private readonly medicosService = inject(MedicosService);
  private readonly citasService = inject(CitasService);
  private readonly pagosService = inject(PagosService);

  pacientes: Paciente[] = [];
  medicos: Medico[] = [];
  citas: Cita[] = [];
  pagos: Pago[] = [];
  mensajeError = '';

  ngOnInit(): void {
    void this.cargarDatos();
  }

  private async cargarDatos(): Promise<void> {
    try {
      [this.pacientes, this.medicos, this.citas, this.pagos] = await Promise.all([
        firstValueFrom(this.pacientesService.listarPacientes()),
        firstValueFrom(this.medicosService.listarMedicos()),
        firstValueFrom(this.citasService.listarCitas()),
        firstValueFrom(this.pagosService.listarPagos())
      ]);
      this.mensajeError = '';
    } catch (error) {
      this.mensajeError = 'No se pudieron cargar los reportes.';
    }
  }

  get ingresosTotales(): number {
    return this.pagos.filter(pago => pago.estado === 'pagado').reduce((total, pago) => total + Number(pago.monto || 0), 0);
  }

  get citasPendientes(): number {
    return this.citas.filter(cita => cita.estado === 'pendiente').length;
  }

  get citasConfirmadas(): number {
    return this.citas.filter(cita => cita.estado === 'confirmada').length;
  }
}
