export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function esDniValido(dni: string): boolean {
  return /^\d{8}$/.test(dni.trim());
}

export function esTelefonoValido(telefono: string): boolean {
  return /^\d{7,15}$/.test(telefono.replace(/\s+/g, ''));
}

export function esFechaActualOFutura(fecha: string): boolean {
  if (!fecha) {
    return false;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const seleccionada = new Date(`${fecha}T00:00:00`);
  return seleccionada >= hoy;
}

export function requiereTexto(valor: string | undefined | null): boolean {
  return Boolean(valor?.trim());
}
