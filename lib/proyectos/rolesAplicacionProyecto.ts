import { ROLES_EMPRESA } from '@/lib/auth/permisosCatalogo';
import { ROLES_COMPRAS_TELEGRAM } from '@/lib/compras/usuariosSistemaTelegram';
import { ROLES_NOMINA_EMPLEADO } from '@/lib/proyectos/rolesProyectoNomina';

export type RolAplicacionProyectoDef = {
  slug: string;
  label: string;
  /** Sincroniza con ci_usuarios_sistema_telegram al guardar (roles /procura). */
  sincronizarComprasTelegram?: boolean;
};

const slugsEmpresa = new Set<string>(ROLES_EMPRESA.map((r) => r.value));

function uniqBySlug(items: RolAplicacionProyectoDef[]): RolAplicacionProyectoDef[] {
  const seen = new Set<string>();
  const out: RolAplicacionProyectoDef[] = [];
  for (const item of items) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    out.push(item);
  }
  return out;
}

/** Catálogo de roles configurables por proyecto (nombre + Telegram). */
export const ROLES_APLICACION_PROYECTO: RolAplicacionProyectoDef[] = uniqBySlug([
  ...ROLES_EMPRESA.map((r) => ({
    slug: r.value,
    label: r.label,
  })),
  ...ROLES_NOMINA_EMPLEADO.filter((r) => !slugsEmpresa.has(r.value)).map((r) => ({
    slug: r.value,
    label: r.label,
  })),
  ...ROLES_COMPRAS_TELEGRAM.map((r) => ({
    slug: r,
    label: `${r} (Telegram /procura)`,
    sincronizarComprasTelegram: true,
  })),
]);

export const SLUGS_ROLES_APLICACION = new Set(ROLES_APLICACION_PROYECTO.map((r) => r.slug));

export function definicionRolAplicacion(slug: string): RolAplicacionProyectoDef | null {
  return ROLES_APLICACION_PROYECTO.find((r) => r.slug === slug) ?? null;
}

export function etiquetaRolAplicacion(slug: string): string {
  return definicionRolAplicacion(slug)?.label ?? slug.replace(/_/g, ' ');
}
