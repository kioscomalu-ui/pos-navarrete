// ---------------------------------------------------------------------
// ARCHIVO NUEVO
// Guardar en: apps/web/lib/roles.ts
// ---------------------------------------------------------------------

import type { RolUsuario } from '@pos/shared/types';

/**
 * Cómo se llama cada rol en pantalla.
 *
 * En la base de datos el rol sigue siendo 'gerente': cambiar el valor
 * del enum obligaría a revisar funciones y policies que lo nombran.
 * Acá se traduce solo lo que leen los usuarios.
 *
 * Único lugar donde vive el nombre visible de un rol. Si mañana hay
 * que renombrar otro, se cambia una línea y no tres archivos.
 */
export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  admin: 'Administrador',
  gerente: 'Operador',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  cobrador: 'Cobrador',
};

export function etiquetaRol(rol: string): string {
  return ETIQUETA_ROL[rol as RolUsuario] ?? rol;
}