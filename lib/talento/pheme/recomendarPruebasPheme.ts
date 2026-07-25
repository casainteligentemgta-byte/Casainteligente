import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extraerPalabrasClave,
  normalizarPalabrasClave,
} from '@/lib/talento/pheme/extraerPalabrasClave';

export type PruebaPhemeSugerida = {
  id_prueba: number;
  nombre_prueba: string;
  categoria: string;
  descripcion: string;
  objetivo_evaluacion: string;
  es_clinico: boolean;
  rol_examen_sugerido: string | null;
};

export type RolExamenPheme = 'programador' | 'tecnico' | 'obrero' | 'vigilante';

export type RecomendacionPhemeResult = {
  palabras_clave: string[];
  pruebas: PruebaPhemeSugerida[];
  rol_examen_sugerido: RolExamenPheme | null;
  fuente: 'rpc' | 'fallback';
  aviso?: string;
};

/** Catálogo offline si la migración 290 aún no está aplicada. */
const FALLBACK_TRIGGERS: { palabra: string; prueba: Omit<PruebaPhemeSugerida, 'id_prueba'> & { id: number } }[] =
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

function esRolExamenPheme(v: string | null | undefined): v is RolExamenPheme {
  return v === 'programador' || v === 'tecnico' || v === 'obrero' || v === 'vigilante';
}

/** Prioridad al votar rol sugerido (más específico primero). */
const PRIORIDAD_ROL: RolExamenPheme[] = ['vigilante', 'programador', 'obrero', 'tecnico'];

export function elegirRolExamenSugerido(pruebas: PruebaPhemeSugerida[]): RolExamenPheme | null {
  const votes = new Map<RolExamenPheme, number>();
  for (const p of pruebas) {
    if (!esRolExamenPheme(p.rol_examen_sugerido)) continue;
    votes.set(p.rol_examen_sugerido, (votes.get(p.rol_examen_sugerido) ?? 0) + 1);
  }
  if (votes.size === 0) return null;
  let best: RolExamenPheme | null = null;
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

function fallbackLocal(palabras: string[]): RecomendacionPhemeResult {
  const byId = new Map<number, PruebaPhemeSugerida>();
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
      'Catálogo local (migración 290 no disponible o sin coincidencias en BD). Ejecuta 290_ci_pheme_pruebas_triggers.sql en Supabase.',
  };
}

/**
 * Busca en la BD las pruebas Pheme recomendadas según palabras clave
 * (equivalente a `recomendar_pruebas_pheme` del prototipo Python).
 */
export async function recomendarPruebasPheme(
  supabase: SupabaseClient,
  opts: { palabrasClave?: string[]; textoSolicitud?: string },
): Promise<RecomendacionPhemeResult> {
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

  const { data, error } = await supabase.rpc('ci_recomendar_pruebas_pheme', {
    palabras_clave: palabras,
  });

  if (error) {
    console.warn('[pheme] RPC ci_recomendar_pruebas_pheme:', error.message);
    return fallbackLocal(palabras);
  }

  const pruebas: PruebaPhemeSugerida[] = (Array.isArray(data) ? data : []).map((row) => {
    const r = row as Record<string, unknown>;
    const rolRaw = r.rol_examen_sugerido == null ? null : String(r.rol_examen_sugerido);
    return {
      id_prueba: Number(r.id_prueba),
      nombre_prueba: String(r.nombre_prueba ?? ''),
      categoria: String(r.categoria ?? ''),
      descripcion: String(r.descripcion ?? ''),
      objetivo_evaluacion: String(r.objetivo_evaluacion ?? ''),
      es_clinico: Boolean(r.es_clinico),
      rol_examen_sugerido: esRolExamenPheme(rolRaw) ? rolRaw : null,
    };
  });

  return {
    palabras_clave: palabras,
    pruebas,
    rol_examen_sugerido: elegirRolExamenSugerido(pruebas),
    fuente: 'rpc',
  };
}

/** Mapea rol Pheme al `rol_examen` aceptado por generar-link (programador|tecnico). */
export function rolExamenParaGenerarLink(rol: RolExamenPheme | null): 'programador' | 'tecnico' {
  if (rol === 'programador') return 'programador';
  return 'tecnico';
}
