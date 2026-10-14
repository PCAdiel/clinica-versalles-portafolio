import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, RolUsuario } from './auth.service';

export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as RolUsuario[];
  const usuario = await authService.getCurrentUserProfile();

  if (roles.length === 0 || (usuario && roles.includes(usuario.rol))) {
    return true;
  }

  return router.createUrlTree(['/dashboard/inicio']);
};
