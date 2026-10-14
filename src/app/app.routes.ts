import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { roleGuard } from '@core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadComponent: () => import('@features/auth/pages/home/home.page').then(m => m.HomePage)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('@features/shell/pages/dashboard/dashboard.page').then(m => m.DashboardPage),
    children: [
      {
        path: '',
        redirectTo: 'inicio',
        pathMatch: 'full'
      },
      {
        path: 'inicio',
        loadComponent: () => import('@features/inicio/pages/inicio/inicio.page').then(m => m.InicioPage)
      },
      {
        path: 'pacientes',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista', 'medico'] },
        loadComponent: () => import('@features/pacientes/pages/pacientes/pacientes.page').then(m => m.PacientesPage)
      },
      {
        path: 'citas',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista', 'medico', 'paciente'] },
        loadComponent: () => import('@features/citas/pages/citas/citas.page').then(m => m.CitasPage)
      },
      {
        path: 'medicos',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista'] },
        loadComponent: () => import('@features/medicos/pages/medicos/medicos.page').then(m => m.MedicosPage)
      },
      {
        path: 'historial',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'medico'] },
        loadComponent: () => import('@features/historial/pages/historial/historial.page').then(m => m.HistorialPage)
      },
      {
        path: 'pagos',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista', 'paciente'] },
        loadComponent: () => import('@features/pagos/pages/pagos/pagos.page').then(m => m.PagosPage)
      },
      {
        path: 'facturacion',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista'] },
        loadComponent: () => import('@features/facturacion/pages/comprobantes/comprobantes.page').then(m => m.ComprobantesPage)
      },
      {
        path: 'facturacion/:id/preview',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista', 'paciente'] },
        loadComponent: () => import('@features/facturacion/pages/comprobante-preview/comprobante-preview.page').then(m => m.ComprobantePreviewPage)
      },
      {
        path: 'reportes',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'recepcionista'] },
        loadComponent: () => import('@features/reportes/pages/reportes/reportes.page').then(m => m.ReportesPage)
      },
      {
        path: 'configuracion',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () => import('@features/configuracion/pages/configuracion/configuracion.page').then(m => m.ConfiguracionPage)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
