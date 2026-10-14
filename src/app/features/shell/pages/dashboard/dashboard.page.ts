import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonMenu,
  IonMenuButton,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendar,
  cash,
  chatboxEllipses,
  close,
  documentText,
  home,
  logOut,
  medical,
  menu,
  people,
  receipt,
  settings
} from 'ionicons/icons';
import { AuthService, RolUsuario, UsuarioSesion } from '@core/auth/auth.service';
import {
  Notificacion,
  NotificacionesService
} from '@features/notificaciones/data-access/notificaciones.service';
import { ChatIaPage } from '@features/chat-ai/pages/chat-ia/chat-ia.page';

interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  roles: RolUsuario[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonRouterOutlet,
    IonContent,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonList,
    IonItem,
    IonIcon,
    IonMenuButton,
    IonButtons,
    IonSplitPane,
    ChatIaPage
  ]
})
export class DashboardPage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificacionesService = inject(NotificacionesService);

  usuario: UsuarioSesion | null = this.authService.getUsuarioActual();
  notificaciones: Notificacion[] = [];
  totalNoLeidas = 0;
  muestraNotificaciones = false;

  menuItems: MenuItem[] = [
    { label: 'Inicio', icon: 'home', route: '/dashboard/inicio', roles: ['admin', 'recepcionista', 'medico', 'paciente'] },
    { label: 'Pacientes', icon: 'people', route: '/dashboard/pacientes', roles: ['admin', 'recepcionista', 'medico'] },
    { label: 'Citas', icon: 'calendar', route: '/dashboard/citas', roles: ['admin', 'recepcionista', 'medico', 'paciente'] },
    { label: 'Medicos', icon: 'medical', route: '/dashboard/medicos', roles: ['admin', 'recepcionista'] },
    { label: 'Historial Clinico', icon: 'document-text', route: '/dashboard/historial', roles: ['admin', 'medico'] },
    { label: 'Pagos', icon: 'cash', route: '/dashboard/pagos', roles: ['admin', 'recepcionista', 'paciente'] },
    { label: 'Facturacion', icon: 'receipt', route: '/dashboard/facturacion', roles: ['admin', 'recepcionista'] },
    { label: 'Reportes', icon: 'document-text', route: '/dashboard/reportes', roles: ['admin', 'recepcionista'] },
    { label: 'Configuracion', icon: 'settings', route: '/dashboard/configuracion', roles: ['admin'] }
  ];

  constructor() {
    addIcons({
      home,
      people,
      calendar,
      medical,
      cash,
      receipt,
      chatboxEllipses,
      close,
      documentText,
      settings,
      logOut,
      menu
    });

    void this.authService.getCurrentUserProfile().then(usuario => {
      this.usuario = usuario;
      void this.cargarNotificaciones();
    });
  }

  puedeVer(item: MenuItem): boolean {
    return this.authService.tieneRol(item.roles);
  }

  puedeUsarChat(): boolean {
    return this.authService.tieneRol(['admin', 'recepcionista', 'medico', 'paciente']);
  }

  rolLabel(): string {
    return this.authService.getRolLabel(this.usuario?.rol);
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/home']);
  }

  async alternarNotificaciones(): Promise<void> {
    this.muestraNotificaciones = !this.muestraNotificaciones;

    if (this.muestraNotificaciones) {
      await this.cargarNotificaciones();
    }
  }

  async marcarNotificacion(id: string): Promise<void> {
    await this.notificacionesService.marcarComoLeida(id);
    await this.cargarNotificaciones();
  }

  async marcarTodas(): Promise<void> {
    await this.notificacionesService.marcarTodasComoLeidas();
    await this.cargarNotificaciones();
  }

  private async cargarNotificaciones(): Promise<void> {
    try {
      const [notificaciones, total] = await Promise.all([
        firstValueFrom(this.notificacionesService.listarNotificaciones()),
        this.notificacionesService.contarNoLeidas()
      ]);
      this.notificaciones = notificaciones;
      this.totalNoLeidas = total;
    } catch (error) {
      this.notificaciones = [];
      this.totalNoLeidas = 0;
    }
  }
}
