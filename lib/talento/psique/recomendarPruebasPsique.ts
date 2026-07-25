import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extraerPalabrasClave,
  normalizarPalabrasClave,
} from '@/lib/talento/psique/extraerPalabrasClave';

export type PruebaPsiqueSugerida = {
  id_prueba: number;
  nombre_prueba: string;
  categoria: string;
  descripcion: string;
  objetivo_evaluacion: string;
  es_clinico: boolean;
  rol_examen_sugerido: string | null;
};

export type RolExamenPsique = 'programador' | 'tecnico' | 'obrero' | 'vigilante';

export type RecomendacionPsiqueResult = {
  palabras_clave: string[];
  pruebas: PruebaPsiqueSugerida[];
  rol_examen_sugerido: RolExamenPsique | null;
  fuente: 'rpc' | 'fallback';
  aviso?: string;
};

/** Catálogo offline si la migración 290 aún no está aplicada. */
const FALLBACK_TRIGGERS: { palabra: string; prueba: Omit<PruebaPsiqueSugerida, 'id_prueba'> & { id: number } }[] =
  [
    {
      palabra: 'tecnico',
      prueba: {
        id: 1,
        nombre_prueba: 'Razonamiento lógico (GMA)',
        categoria: 'Cognitiva / GMA',
        descripcion: 'Ítems de lógica alineados al banco CI.',
        objetivo_evaluacion: 'Estimar razonamiento para roles técnicos.',
        es_clinico: false,
        rol_examen_sugerido: 'tecnico',
      },
    },
    {
      palabra: 'tecnico',
      prueba: {
        id: 3,
        nombre_prueba: 'Integridad y honestidad',
        categoria: 'Integridad',
        descripcion: 'Situaciones de ética y material de obra.',
        objetivo_evaluacion: 'Detectar riesgo de deshonestidad.',
        es_clinico: false,
        rol_examen_sugerido: 'tecnico',
      },
    },
    {
      palabra: 'cctv',
      prueba: {
        id: 6,
        nombre_prueba: 'Aptitud técnica CCTV / redes',
        categoria: 'Técnica / oficio',
        descripcion: 'Criterio para instalación y operación de CCTV.',
        objetivo_evaluacion: 'Validar base técnica de seguridad electrónica.',
        es_clinico: false,
        rol_examen_sugerido: 'tecnico',
      },
    },
    {
      palabra: 'cctv',
      prueba: {
        id: 7,
        nombre_prueba: 'Atención sostenida / vigilancia',
        categoria: 'Atención y vigilancia',
        descripcion: 'Monitoreo y respuesta ante eventos.',
        objetivo_evaluacion: 'Idoneidad para monitoreo CCTV.',
        es_clinico: false,
        rol_examen_sugerido: 'vigilante',
      },
    },
    {
      palabra: 'cctv',
      prueba: {
        id: 3,
        nombre_prueba: 'Integridad y honestidad',
        categoria: 'Integridad',
        descripcion: 'Situaciones de ética y material de obra.',
        objetivo_evaluacion: 'Detectar riesgo de deshonestidad.',
        es_clinico: false,
        rol_examen_sugerido: 'tecnico',
      },
    },
    {
      palabra: 'obrero',
      prueba: {
        id: 5,
        nombre_prueba: 'Situacional de obra (obrero)',
        categoria: 'Seguridad ocupacional',
        descripcion: 'Ítems situacionales de obra Casa Inteligente.',
        objetivo_evaluacion: 'Seguridad, responsabilidad y convivencia.',
        es_clinico: false,
        rol_examen_sugerido: 'obrero',
      },
    },
    {
      palabra: 'programador',
      prueba: {
        id: 2,
        nombre_prueba: 'Razonamiento lógico programador',
        categoria: 'Cognitiva / GMA',
        descripcion: 'Lógica orientada a perfiles TI.',
        objetivo_evaluacion: 'Pensamiento analítico en software.',
        es_clinico: false,
        rol_examen_sugerido: 'programador',
      },
    },
    {
      palabra: 'vigilante',
      prueba: {
        id: 7,
        nombre_prueba: 'Atención sostenida / vigilancia',
        categoria: 'Atención y vigilancia',
        descripcion: 'Monitoreo y respuesta ante eventos.',
        objetivo_evaluacion: 'Idoneidad para vigilancia.',
        es_clinico: false,
        rol_examen_sugerido: 'vigilante',
      },
    },
  ];

function esRolExamenPsique(v: string | null | undefined): v is RolExamenPsique {
  return v === 'programador' || v === 'tecnico' || v === 'obrero' || v === 'vigilante';
}

/** Prioridad al votar rol sugerido (más específico primero). */
const PRIORIDAD_ROL: RolExamenPsique[] = ['vigilante', 'programador', 'obrero', 'tecnico'];

export function elegirRolExamenSugerido(pruebas: PruebaPsiqueSugerida[]): RolExamenPsique | null {
  const votes = new Map<RolExamenPsique, number>();
  for (const p of pruebas) {
    if (!esRolExamenPsique(p.rol_examen_sugerido)) continue;
    votes.set(p.rol_examen_sugerido, (votes.get(p.rol_examen_sugerido) ?? 0) + 1);
  }
  if (votes.size === 0) return null;
  let best: RolExamenPsique | null = null;
  let bestN = -1;
  for (const rol of PRIORIDAD_ROL) {
    const n = votes.get(rol) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = rol;
    }
  }
  return best;
}

function fallbackLocal(palabras: string[]): RecomendacionPsiqueResult {
  const byId = new Map<number, PruebaPsiqueSugerida>();
  for (const row of FALLBACK_TRIGGERS) {
    if (!palabras.includes(row.palabra)) continue;
    byId.set(row.prueba.id, {
      id_prueba: row.prueba.id,
      nombre_prueba: row.prueba.nombre_prueba,
      categoria: row.prueba.categoria,
      descripcion: row.prueba.descripcion,
      objetivo_evaluacion: row.prueba.objetivo_evaluacion,
      es_clinico: row.prueba.es_clinico,
      rol_examen_sugerido: row.prueba.rol_examen_sugerido,
    });
  }
  const pruebas = [...byId.values()].sort((a, b) => a.nombre_prueba.localeCompare(b.nombre_prueba, 'es'));
  return {
    palabras_clave: palabras,
    pruebas,
    rol_examen_sugerido: elegirRolExamenSugerido(pruebas),
    fuente: 'fallback',
    aviso:
      'Catálogo local (migración 294 no disponible). Ejecuta 294_ci_psique_catalogo_aislado.sql en Supabase.',
  };
}

/**
 * Busca en la BD las pruebas Psique recomendadas según palabras clave
 * (equivalente a `recomendar_pruebas_psique` del prototipo Python).
 */
export async function recomendarPruebasPsique(
  supabase: SupabaseClient,
  opts: { palabrasClave?: string[]; textoSolicitud?: string },
): Promise<RecomendacionPsiqueResult> {
  const fromTexto = opts.textoSolicitud ? extraerPalabrasClave(opts.textoSolicitud) : [];
  const fromLista = normalizarPalabrasClave(opts.palabrasClave ?? []);
  const palabras = normalizarPalabrasClave([...fromLista, ...fromTexto]);

  if (palabras.length === 0) {
    return {
      palabras_clave: [],
      pruebas: [],
      rol_examen_sugerido: null,
      fuente: 'rpc',
    };
  }

  const { data, error } = await supabase.rpc('ci_recomendar_pruebas_psique', {
    palabras_clave: palabras,
  });

  if (error) {
    console.warn('[psique] RPC ci_recomendar_pruebas_psique:', error.message);
    return fallbackLocal(palabras);
  }

  const pruebas: PruebaPsiqueSugerida[] = (Array.isArray(data) ? data : []).map((row) => {
    const r = row as Record<string, unknown>;
    const rolRaw = r.rol_examen_sugerido == null ? null : String(r.rol_examen_sugerido);
    return {
      id_prueba: Number(r.id_prueba),
      nombre_prueba: String(r.nombre_prueba ?? ''),
      categoria: String(r.categoria ?? ''),
      descripcion: String(r.descripcion ?? ''),
      objetivo_evaluacion: String(r.objetivo_evaluacion ?? ''),
      es_clinico: Boolean(r.es_clinico),
      rol_examen_sugerido: esRolExamenPsique(rolRaw) ? rolRaw : null,
    };
  });

  return {
    palabras_clave: palabras,
    pruebas,
    rol_examen_sugerido: elegirRolExamenSugerido(pruebas),
    fuente: 'rpc',
  };
}

/**
 * Rol de examen a persistir en `ci_empleados.rol_examen` (4 bancos del libro).
 * Default seguro: técnico obra (trípode).
 */
export function rolExamenDesdePsique(rol: RolExamenPsique | null): RolExamenPsique {
  return rol ?? 'tecnico';
}

/**
 * @deprecated Preferir `rolExamenDesdePsique`. Solo programador|tecnico para UIs legacy.
 */
export function rolExamenParaGenerarLink(rol: RolExamenPsique | null): 'programador' | 'tecnico' {
  const r = rolExamenDesdePsique(rol);
  return r === 'programador' ? 'programador' : 'tecnico';
}
