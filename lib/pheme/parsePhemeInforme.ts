import type {
  PhemeAnalisisComunicacion,
  PhemeIdeaViabilidad,
  PhemeInforme,
  PhemeMatrizViabilidad,
  PhemeResumenEjecutivo,
  PhemeTareaPendiente,
  PhemeViabilidad,
} from '@/types/pheme';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? '').trim()).filter(Boolean);
}

function normalizeViabilidad(raw: unknown): PhemeViabilidad {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'alta') return 'Alta';
  if (v === 'media') return 'Media';
  if (v === 'baja') return 'Baja';
  if (v === 'inviable') return 'Inviable';
  return 'Media';
}

function parseTareas(raw: unknown): PhemeTareaPendiente[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      tarea: asString(row.tarea, 'Tarea sin descripción'),
      responsable: asString(row.responsable, 'No especificado'),
      fecha_limite: asString(row.fecha_limite, 'Pendiente'),
    };
  });
}

function parseIdeas(raw: unknown): PhemeIdeaViabilidad[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      idea: asString(row.idea, 'Idea sin nombre'),
      viabilidad: normalizeViabilidad(row.viabilidad),
      pros: asStringArray(row.pros),
      contras_riesgos: asStringArray(row.contras_riesgos),
      dictamen: asString(row.dictamen, 'Sin dictamen'),
    };
  });
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('La respuesta del LLM no contiene JSON válido');
  }
}

export function parsePhemeInforme(rawText: string): PhemeInforme {
  const parsed = extractJsonObject(rawText) as Record<string, unknown>;
  const resumenRaw = (parsed.resumen_ejecutivo ?? {}) as Record<string, unknown>;
  const matrizRaw = (parsed.matriz_viabilidad ?? {}) as Record<string, unknown>;
  const comunicacionRaw = (parsed.analisis_comunicacion ?? {}) as Record<string, unknown>;

  const resumen_ejecutivo: PhemeResumenEjecutivo = {
    objetivo_principal: asString(resumenRaw.objetivo_principal, 'No especificado'),
    acuerdos_clave: asStringArray(resumenRaw.acuerdos_clave),
    tareas_pendientes: parseTareas(resumenRaw.tareas_pendientes),
  };

  const matriz_viabilidad: PhemeMatrizViabilidad = {
    ideas_analizadas: parseIdeas(matrizRaw.ideas_analizadas),
  };

  const analisis_comunicacion: PhemeAnalisisComunicacion = {
    tono_general: asString(comunicacionRaw.tono_general, 'Profesional'),
    objeciones_detectadas: asStringArray(comunicacionRaw.objeciones_detectadas),
    puntos_de_duda_o_vacilacion: asStringArray(comunicacionRaw.puntos_de_duda_o_vacilacion),
    recomendacion_seguimiento: asString(
      comunicacionRaw.recomendacion_seguimiento,
      'Agendar seguimiento con los responsables de las tareas pendientes.',
    ),
  };

  return {
    resumen_ejecutivo,
    matriz_viabilidad,
    mapa_mental_mermaid: asString(parsed.mapa_mental_mermaid, 'graph TD\n  A[Reunión]'),
    analisis_comunicacion,
  };
}
