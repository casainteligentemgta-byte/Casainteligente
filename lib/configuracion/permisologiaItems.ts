/**
 * Permisos del patrono: ítems fijos (IVSS/INCES/solvencia) + personalizados.
 */

import type { PermisoPatronoItem, PermisologiaCi } from '@/types/ci-entidad';

export const PERMISOS_FIJOS: { id: string; nombre: string }[] = [
  { id: 'ivss', nombre: 'IVSS' },
  { id: 'inces', nombre: 'INCES' },
  { id: 'solvencia_laboral', nombre: 'Solvencia laboral' },
];

function newPermisoId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickStr(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === 'string' ? v.trim() : '';
}

/** Normaliza jsonb legado + `items` a lista editable. */
export function permisosDesdePermisologia(raw: unknown): PermisoPatronoItem[] {
  const o =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const fromItems: PermisoPatronoItem[] = [];
  if (Array.isArray(o.items)) {
    for (const item of o.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const r = item as Record<string, unknown>;
      const id = pickStr(r, 'id') || newPermisoId();
      const nombre = pickStr(r, 'nombre') || 'Permiso';
      fromItems.push({
        id,
        nombre,
        vence: pickStr(r, 'vence').slice(0, 10) || undefined,
        documento_url: pickStr(r, 'documento_url') || undefined,
        fijo: r.fijo === true || PERMISOS_FIJOS.some((f) => f.id === id),
      });
    }
  }

  if (fromItems.length > 0) {
    // Completar fijos ausentes (datos viejos solo con items parciales)
    const ids = new Set(fromItems.map((x) => x.id));
    for (const f of PERMISOS_FIJOS) {
      if (ids.has(f.id)) continue;
      const venceKey =
        f.id === 'ivss'
          ? 'ivss_vence'
          : f.id === 'inces'
            ? 'inces_vence'
            : 'solvencia_laboral_vence';
      const docKey =
        f.id === 'ivss'
          ? 'ivss_documento_url'
          : f.id === 'inces'
            ? 'inces_documento_url'
            : 'solvencia_laboral_documento_url';
      fromItems.push({
        id: f.id,
        nombre: f.nombre,
        vence: pickStr(o, venceKey).slice(0, 10) || undefined,
        documento_url: pickStr(o, docKey) || undefined,
        fijo: true,
      });
    }
    return fromItems;
  }

  // Solo campos legado
  return PERMISOS_FIJOS.map((f) => {
    const venceKey =
      f.id === 'ivss'
        ? 'ivss_vence'
        : f.id === 'inces'
          ? 'inces_vence'
          : 'solvencia_laboral_vence';
    const docKey =
      f.id === 'ivss'
        ? 'ivss_documento_url'
        : f.id === 'inces'
          ? 'inces_documento_url'
          : 'solvencia_laboral_documento_url';
    return {
      id: f.id,
      nombre: f.nombre,
      vence: pickStr(o, venceKey).slice(0, 10) || undefined,
      documento_url: pickStr(o, docKey) || undefined,
      fijo: true,
    };
  });
}

export function nuevoPermisoPersonalizado(nombre: string): PermisoPatronoItem {
  const n = nombre.trim() || 'Nuevo permiso';
  return {
    id: newPermisoId(),
    nombre: n,
    vence: undefined,
    documento_url: undefined,
    fijo: false,
  };
}

/** Serializa lista a jsonb (items + claves legado para compatibilidad). */
export function permisologiaDesdeItems(items: PermisoPatronoItem[]): PermisologiaCi {
  const clean = items
    .map((it) => ({
      id: it.id.trim(),
      nombre: it.nombre.trim() || 'Permiso',
      vence: (it.vence ?? '').trim().slice(0, 10) || undefined,
      documento_url: (it.documento_url ?? '').trim() || undefined,
      fijo: Boolean(it.fijo) || PERMISOS_FIJOS.some((f) => f.id === it.id),
    }))
    .filter((it) => it.id);

  const byId = new Map(clean.map((x) => [x.id, x]));
  const ivss = byId.get('ivss');
  const inces = byId.get('inces');
  const sol = byId.get('solvencia_laboral');

  return {
    items: clean.length ? clean : undefined,
    ivss_vence: ivss?.vence,
    inces_vence: inces?.vence,
    solvencia_laboral_vence: sol?.vence,
    ivss_documento_url: ivss?.documento_url,
    inces_documento_url: inces?.documento_url,
    solvencia_laboral_documento_url: sol?.documento_url,
  };
}
