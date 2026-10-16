import type { SupabaseClient } from '@supabase/supabase-js';
import {
  actualizarFilaNominaProyecto,
  crearFilaNominaProyecto,
  listarNominaProyecto,
} from '@/lib/proyectos/proyectoNomina';
import {
  ROLES_NOMINA_EMPLEADO,
  ROLES_NOMINA_OBRERO,
  type CategoriaNominaProyecto,
} from '@/lib/proyectos/rolesProyectoNomina';

/**
 * Carga de la nómina de una obra desde CSV (Excel → «Guardar como CSV»).
 * Columnas (el orden no importa, mayúsculas/acentos tampoco):
 *   nombre, cedula, rol, categoria, telefono, email, chat_id, notas
 * Si la cédula (o el nombre, si no hay cédula) ya está en la obra, se actualiza.
 */

export type FilaCsvNomina = {
  linea: number;
  nombre: string;
  cedula: string | null;
  rol: string;
  categoria: CategoriaNominaProyecto;
  telefono: string | null;
  email: string | null;
  chatId: string | null;
  notas: string | null;
};

export type ErrorCsvNomina = { linea: number; error: string };

export { PLANTILLA_CSV_NOMINA } from '@/lib/proyectos/plantillaNominaCsv';

const ALIAS_COLUMNAS: Record<string, keyof Omit<FilaCsvNomina, 'linea' | 'categoria'> | 'categoria'> = {
  nombre: 'nombre',
  nombres: 'nombre',
  nombre_completo: 'nombre',
  nombre_y_apellido: 'nombre',
  nombres_y_apellidos: 'nombre',
  apellidos_y_nombres: 'nombre',
  trabajador: 'nombre',
  cedula: 'cedula',
  ci: 'cedula',
  documento: 'cedula',
  rol: 'rol',
  cargo: 'rol',
  funcion: 'rol',
  categoria: 'categoria',
  tipo: 'categoria',
  telefono: 'telefono',
  celular: 'telefono',
  movil: 'telefono',
  telefono_telegram: 'telefono',
  email: 'email',
  correo: 'email',
  chat_id: 'chatId',
  chatid: 'chatId',
  telegram: 'chatId',
  telegram_chat_id: 'chatId',
  notas: 'notas',
  observaciones: 'notas',
};

function clave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s.-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/** Separa una línea CSV respetando comillas. */
function partirLinea(linea: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') comillas = false;
      else cur += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const ROLES = [...ROLES_NOMINA_EMPLEADO, ...ROLES_NOMINA_OBRERO];
const ROLES_OBRERO = new Set<string>(ROLES_NOMINA_OBRERO.map((r) => r.value));
/** Roles de aplicación que también viven en la nómina de la obra. */
const ROLES_EXTRA: Record<string, string> = {
  comprador: 'comprador',
  compras: 'comprador',
  pm: 'pm_obra',
  pm_obra: 'pm_obra',
  project_manager: 'pm_obra',
  administrador: 'admin',
  admin: 'admin',
  ingeniero: 'ingeniero_residente',
  residente: 'ingeniero_residente',
  almacenista: 'depositario',
  deposito: 'depositario',
  chofer: 'logistica',
  transportista: 'logistica',
};

/** «Ingeniero residente» → ingeniero_residente; desconocido → texto en snake_case. */
export function normalizarRolNomina(v: string): string {
  const k = clave(v);
  if (!k) return '';
  const hit = ROLES.find((r) => r.value === k || clave(r.label) === k);
  if (hit) return hit.value;
  return ROLES_EXTRA[k] ?? k;
}

function normalizarCategoria(v: string, rol: string): CategoriaNominaProyecto {
  const k = clave(v);
  if (k.startsWith('obr')) return 'obrero';
  if (k.startsWith('emp')) return 'empleado';
  return ROLES_OBRERO.has(rol) ? 'obrero' : 'empleado';
}

function normalizarCedula(v: string): string | null {
  const t = v.toUpperCase().replace(/[\s.]/g, '');
  if (!t) return null;
  const m = t.match(/^([VEJPG])-?(\d+)$/);
  if (m) return `${m[1]}-${m[2]}`;
  return /^\d+$/.test(t) ? `V-${t}` : t;
}

export function parsearNominaCsv(texto: string): { filas: FilaCsvNomina[]; errores: ErrorCsvNomina[] } {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const iCab = lineas.findIndex((l) => l.trim());
  if (iCab < 0) return { filas: [], errores: [{ linea: 1, error: 'El archivo está vacío' }] };
  const cab = lineas[iCab];
  const sep = (cab.match(/;/g)?.length ?? 0) >= (cab.match(/,/g)?.length ?? 0) ? ';' : ',';
  const columnas = partirLinea(cab, sep).map((c) => ALIAS_COLUMNAS[clave(c)] ?? null);
  if (!columnas.includes('nombre')) {
    return { filas: [], errores: [{ linea: iCab + 1, error: 'Falta la columna «nombre»' }] };
  }
  if (!columnas.includes('rol')) {
    return { filas: [], errores: [{ linea: iCab + 1, error: 'Falta la columna «rol»' }] };
  }

  const filas: FilaCsvNomina[] = [];
  const errores: ErrorCsvNomina[] = [];
  for (let i = iCab + 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    const celdas = partirLinea(lineas[i], sep);
    const v: Record<string, string> = {};
    columnas.forEach((col, j) => {
      if (col && celdas[j] != null && !v[col]) v[col] = celdas[j];
    });
    const linea = i + 1;
    const nombre = (v.nombre ?? '').trim();
    const rol = normalizarRolNomina(v.rol ?? '');
    if (!nombre) {
      errores.push({ linea, error: 'Sin nombre' });
      continue;
    }
    if (!rol) {
      errores.push({ linea, error: `${nombre}: sin rol` });
      continue;
    }
    const chat = (v.chatId ?? '').replace(/[^\d-]/g, '');
    filas.push({
      linea,
      nombre,
      cedula: normalizarCedula(v.cedula ?? ''),
      rol,
      categoria: normalizarCategoria(v.categoria ?? '', rol),
      telefono: (v.telefono ?? '').trim() || null,
      email: (v.email ?? '').trim().toLowerCase() || null,
      chatId: chat || null,
      notas: (v.notas ?? '').trim() || null,
    });
  }
  return { filas, errores };
}

export type ResultadoImportNomina = {
  creados: number;
  actualizados: number;
  errores: ErrorCsvNomina[];
};

export async function importarNominaProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  texto: string,
): Promise<ResultadoImportNomina> {
  const { filas, errores } = parsearNominaCsv(texto);
  const existentes = await listarNominaProyecto(supabase, proyectoId, { soloActivos: false });
  const porCedula = new Map(existentes.filter((f) => f.cedula).map((f) => [normalizarCedula(f.cedula!), f]));
  const porNombre = new Map(existentes.map((f) => [clave(f.nombre_display), f]));

  let creados = 0;
  let actualizados = 0;
  for (const f of filas) {
    const previo = (f.cedula ? porCedula.get(f.cedula) : undefined) ?? porNombre.get(clave(f.nombre));
    try {
      if (previo) {
        await actualizarFilaNominaProyecto(supabase, proyectoId, previo.id, {
          categoria: f.categoria,
          rol: f.rol,
          ...(previo.empleado_id ? {} : { nombre: f.nombre }),
          ...(f.cedula ? { cedula: f.cedula } : {}),
          ...(f.telefono ? { telegram_telefono: f.telefono } : {}),
          ...(f.email ? { email: f.email } : {}),
          ...(f.chatId ? { telegram_chat_id: f.chatId } : {}),
          ...(f.notas ? { notas: f.notas } : {}),
          activo: true,
        });
        actualizados += 1;
      } else {
        const nueva = await crearFilaNominaProyecto(supabase, proyectoId, {
          categoria: f.categoria,
          rol: f.rol,
          nombre: f.nombre,
          cedula: f.cedula,
          telegram_telefono: f.telefono,
          email: f.email,
          telegram_chat_id: f.chatId,
          notas: f.notas,
        });
        if (f.cedula) porCedula.set(f.cedula, nueva);
        porNombre.set(clave(f.nombre), nueva);
        creados += 1;
      }
    } catch (e) {
      errores.push({ linea: f.linea, error: `${f.nombre}: ${e instanceof Error ? e.message : 'no se pudo guardar'}` });
    }
  }
  errores.sort((a, b) => a.linea - b.linea);
  return { creados, actualizados, errores };
}
