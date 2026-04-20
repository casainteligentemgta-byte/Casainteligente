import type {
  ExamenGenerado,
  PreguntaExamenMovil,
  PreguntaLogica,
  PreguntaPersonalidad,
  RolExamen,
} from '@/types/talento';

/** 20 ítems fijos (Likert 1–5): estabilidad emocional, trabajo en equipo, integridad operativa. */
export const PREGUNTAS_PERSONALIDAD: PreguntaPersonalidad[] = [
  { id: 'p01', bloque: 'Conducta', texto: 'Mantengo la calidad del trabajo bajo presión de plazos ajustados.' },
  { id: 'p02', bloque: 'Conducta', texto: 'Prefiero aclarar requisitos antes de ejecutar tareas ambiguas.' },
  { id: 'p03', bloque: 'Equipo', texto: 'Comparto información relevante con el equipo sin esperar que me lo pidan.' },
  { id: 'p04', bloque: 'Equipo', texto: 'Acepto feedback constructivo sin ponerse a la defensiva.' },
  { id: 'p05', bloque: 'Integridad', texto: 'Reporto errores propios aunque puedan generar retrabajo.' },
  { id: 'p06', bloque: 'Integridad', texto: 'Evito comprometer plazos que sé que no son realistas.' },
  { id: 'p07', bloque: 'Aprendizaje', texto: 'Investigo documentación oficial antes de improvisar soluciones.' },
  { id: 'p08', bloque: 'Aprendizaje', texto: 'Documento lo que aprendo para reutilizarlo en futuros proyectos.' },
  { id: 'p09', bloque: 'Cliente', texto: 'Priorizo la seguridad del usuario sobre la velocidad de entrega.' },
  { id: 'p10', bloque: 'Cliente', texto: 'Explico riesgos técnicos en lenguaje comprensible para el cliente.' },
  { id: 'p11', bloque: 'Operación', texto: 'Mantengo orden en herramientas, cables y entorno de trabajo.' },
  { id: 'p12', bloque: 'Operación', texto: 'Verifico checklist antes de dar por cerrada una instalación.' },
  { id: 'p13', bloque: 'Resolución', texto: 'Divido problemas grandes en pasos verificables.' },
  { id: 'p14', bloque: 'Resolución', texto: 'Midó el resultado antes de declarar éxito (pruebas / validación).' },
  { id: 'p15', bloque: 'Autonomía', texto: 'Pido ayuda cuando llevo más de un umbral razonable bloqueado.' },
  { id: 'p16', bloque: 'Autonomía', texto: 'Propongo alternativas cuando el plan original no es viable.' },
  { id: 'p17', bloque: 'Estrés', texto: 'Mantengo tono profesional ante reclamos o urgencias.' },
  { id: 'p18', bloque: 'Estrés', texto: 'Evito culpar a terceros en incidentes; busco causa raíz.' },
  { id: 'p19', bloque: 'Valores', texto: 'Cumplo normas de la empresa aunque no haya supervisión directa.' },
  { id: 'p20', bloque: 'Valores', texto: 'Trato a compañeros y subcontratistas con respeto constante.' },
];

const LOGICA_PROGRAMADOR: PreguntaLogica[] = [
  {
    id: 'lp1',
    texto: '¿Qué estructura permite búsqueda O(1) promedio en un conjunto de claves únicas?',
    opciones: ['Lista enlazada', 'Tabla hash (hash map)', 'Array ordenado sin índice', 'Cola FIFO'],
    correcta: 1,
  },
  {
    id: 'lp2',
    texto: 'En HTTP REST, ¿qué verbo es idempotente y suele usarse para lecturas sin efectos secundarios?',
    opciones: ['POST', 'PATCH', 'GET', 'CONNECT'],
    correcta: 2,
  },
  {
    id: 'lp3',
    texto: 'Un bug solo ocurre en producción. ¿Cuál es la primera acción más sensata?',
    opciones: [
      'Desplegar un hotfix sin revisar logs',
      'Reproducir o correlacionar con logs/métricas y aislar el cambio',
      'Reiniciar servidores indefinidamente',
      'Deshacer todos los commits del mes',
    ],
    correcta: 1,
  },
  {
    id: 'lp4',
    texto: '¿Qué patrón separa la construcción de un objeto complejo paso a paso?',
    opciones: ['Singleton', 'Builder', 'Adapter', 'Flyweight'],
    correcta: 1,
  },
  {
    id: 'lp5',
    texto: 'SQL: ¿qué cláusula restringe filas antes de agrupar?',
    opciones: ['HAVING', 'WHERE', 'ORDER BY', 'WINDOW'],
    correcta: 1,
  },
];

const LOGICA_TECNICO: PreguntaLogica[] = [
  {
    id: 'lt1',
    texto: 'Antes de trabajar en un circuito alimentado, ¿qué debe verificarse primero?',
    opciones: [
      'Solo el color del cable',
      'Orden de fase en tablero',
      'Ausencia de tensión (puesta a tierra / bloqueo LOTO cuando aplique)',
      'Temperatura ambiente',
    ],
    correcta: 2,
  },
  {
    id: 'lt2',
    texto: 'En instalación de cámaras IP en exterior, ¿qué factor es crítico además de la resolución?',
    opciones: ['Solo el precio del monitor', 'Índice de protección (IP) y sellado', 'Color del empaque', 'Número de ventiladores RGB'],
    correcta: 1,
  },
  {
    id: 'lt3',
    texto: 'Un cable UTP para Gigabit en canal horizontal típico debería ser como mínimo:',
    opciones: ['Cat5 (sin más)', 'Cat5e o superior según norma del proyecto', 'Cable coaxial RG59', 'Par telefónico plano'],
    correcta: 1,
  },
  {
    id: 'lt4',
    texto: 'Medición de tierra de protección: buscamos resistencia:',
    opciones: ['Infinita', 'La más baja posible dentro de norma', 'Igual a la fase', 'Aleatoria'],
    correcta: 1,
  },
  {
    id: 'lt5',
    texto: 'Señal débil en punto de acceso inalámbrico. ¿Qué hipótesis revisar primero?',
    opciones: [
      'Cambiar logo de la empresa',
      'Fuente de alimentación PoE, canal RF, obstáculos y orientación de antenas',
      'Solo reiniciar el router del vecino',
      'Pintar la pared',
    ],
    correcta: 1,
  },
];

/**
 * Genera el examen de 25 preguntas: 20 personalidad fijas + 5 lógica según rol.
 */
export function generarExamenAdaptativo(rol: RolExamen): ExamenGenerado {
  const logica = rol === 'programador' ? LOGICA_PROGRAMADOR : LOGICA_TECNICO;
  return {
    rol,
    personalidad: PREGUNTAS_PERSONALIDAD,
    logica,
  };
}

/** Convierte ítems de lógica del examen al formato de `ExamenMovil` (opciones con `{ texto }`). */
export function logicaAPreguntasMovil(logica: PreguntaLogica[]): PreguntaExamenMovil[] {
  return logica.map((q) => ({
    id: q.id,
    pregunta: q.texto,
    opciones: q.opciones.map((texto) => ({ texto })),
  }));
}

/** Convierte respuestas por texto de vuelta a índices de opción (para `respuestas_logica`). */
export function respuestasMovilALogica(
  logica: PreguntaLogica[],
  porTexto: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of logica) {
    const t = porTexto[q.id];
    if (typeof t !== 'string') continue;
    const idx = q.opciones.indexOf(t);
    if (idx >= 0) out[q.id] = idx;
  }
  return out;
}

export function puntajePersonalidad(respuestas: Record<string, number>): number {
  const ids = PREGUNTAS_PERSONALIDAD.map((p) => p.id);
  let sum = 0;
  let n = 0;
  for (const id of ids) {
    const v = respuestas[id];
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      sum += v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const avg = sum / n;
  return ((avg - 1) / 4) * 100;
}

export function puntajeLogica(
  rol: RolExamen,
  respuestas: Record<string, number>,
): { puntaje: number; correctas: number; gma0a5: number } {
  const qs = rol === 'programador' ? LOGICA_PROGRAMADOR : LOGICA_TECNICO;
  let correctas = 0;
  for (const q of qs) {
    const r = respuestas[q.id];
    if (typeof r === 'number' && r === q.correcta) correctas += 1;
  }
  const gma0a5 = correctas;
  return { puntaje: (correctas / qs.length) * 100, correctas, gma0a5 };
}

/** Ítems de personalidad usados para riesgo integridad (1–5 Likert; baja respuesta ⇒ más riesgo). */
const IDS_INTEGRIDAD_RIESGO = ['p05', 'p06', 'p09', 'p17', 'p18', 'p19'] as const;

/**
 * Nivel de riesgo de integridad 0–10 (mayor = peor).
 * Basado en respuestas bajas en ítems de ética, seguridad y conducta bajo presión.
 */
export function nivelIntegridadRiesgo(respuestas: Record<string, number>): number {
  let suma = 0;
  let n = 0;
  for (const id of IDS_INTEGRIDAD_RIESGO) {
    const v = respuestas[id];
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      suma += 5 - v;
      n += 1;
    } else {
      suma += 3;
      n += 1;
    }
  }
  const maxRaw = IDS_INTEGRIDAD_RIESGO.length * 4;
  return Math.round(((suma / maxRaw) * 10 + Number.EPSILON) * 100) / 100;
}

/** Combinación lineal simple (ajustable). */
export function puntajeTotal(pers: number, log: number): number {
  return pers * 0.45 + log * 0.55;
}
