/**
 * Evaluación de talento — personal de campo (obrero).
 * DISC por colores (pares forzados), razonamiento lógico contextual, confiabilidad operativa.
 */

export type ColorPerfilObrero = 'Rojo' | 'Amarillo' | 'Verde' | 'Azul';

export type ParDiscObrero = {
  id: string;
  a: { texto: string; color: ColorPerfilObrero };
  b: { texto: string; color: ColorPerfilObrero };
};

export type PreguntaLogicaObrero = {
  id: string;
  texto: string;
  opciones: [string, string, string, string];
  correcta: 0 | 1 | 2 | 3;
};

export type PreguntaConfObrero = {
  id: string;
  texto: string;
  opciones: [string, string, string];
  /** Índice de la respuesta más alineada con protocolo / integridad. */
  mejor: 0 | 1 | 2;
};

export const PARES_DISC_OBRERO: ParDiscObrero[] = [
  {
    id: 'd01',
    a: { texto: 'Priorizo terminar la tarea del día aunque implique decidir rápido.', color: 'Rojo' },
    b: { texto: 'Prefiero validar medidas y materiales antes de seguir, aunque tarde un poco más.', color: 'Azul' },
  },
  {
    id: 'd02',
    a: { texto: 'Motivo al equipo con buen ánimo cuando la carga es pesada.', color: 'Amarillo' },
    b: { texto: 'Mantengo el ritmo constante y cumplo el paso a paso del encargado.', color: 'Verde' },
  },
  {
    id: 'd03',
    a: { texto: 'Si hay retraso, presiono para recuperar tiempo y cumplir la meta.', color: 'Rojo' },
    b: { texto: 'Si hay retraso, consulto y ajusto el plan con calma para no cometer errores.', color: 'Verde' },
  },
  {
    id: 'd04',
    a: { texto: 'Explico en voz alta lo que haré para que todos estén alineados.', color: 'Amarillo' },
    b: { texto: 'Me concentro en ejecutar con precisión lo acordado por escrito.', color: 'Azul' },
  },
  {
    id: 'd05',
    a: { texto: 'Tomo decisiones en el momento sin esperar muchas reuniones.', color: 'Rojo' },
    b: { texto: 'Prefiero acordar el procedimiento y luego no desviarme.', color: 'Verde' },
  },
  {
    id: 'd06',
    a: { texto: 'Disfruto coordinar gente y resolver conflictos con diálogo.', color: 'Amarillo' },
    b: { texto: 'Disfruto dejar la obra impecable: alineación, limpieza y detalle.', color: 'Azul' },
  },
  {
    id: 'd07',
    a: { texto: 'Ante una duda de seguridad, paro y exijo criterio antes de avanzar.', color: 'Azul' },
    b: { texto: 'Ante una duda de seguridad, busco la forma más rápida de no frenar la obra.', color: 'Rojo' },
  },
  {
    id: 'd08',
    a: { texto: 'Prefiero que el equipo se sienta cómodo aunque el ritmo sea moderado.', color: 'Amarillo' },
    b: { texto: 'Prefiero que cada quien cumpla su parte sin rodeos.', color: 'Rojo' },
  },
  {
    id: 'd09',
    a: { texto: 'Sigo fielmente la instrucción aunque tenga una idea distinta.', color: 'Verde' },
    b: { texto: 'Propongo mejoras si veo un atajo seguro y eficiente.', color: 'Rojo' },
  },
  {
    id: 'd10',
    a: { texto: 'Me energiza el ambiente social en la cuadrilla.', color: 'Amarillo' },
    b: { texto: 'Me energiza terminar filas perfectas de acabados o instalación.', color: 'Azul' },
  },
  {
    id: 'd11',
    a: { texto: 'Prefiero resultados visibles hoy, aunque queden pendientes detalles menores.', color: 'Rojo' },
    b: { texto: 'Prefiero cerrar bien los detalles aunque el avance del día sea menor.', color: 'Azul' },
  },
  {
    id: 'd12',
    a: { texto: 'Escucho todas las opiniones antes de actuar.', color: 'Amarillo' },
    b: { texto: 'Avanzo con paciencia sin quejas aunque la tarea sea repetitiva.', color: 'Verde' },
  },
  {
    id: 'd13',
    a: { texto: 'Me enorgullece ser referente de calidad y normas en el frente.', color: 'Azul' },
    b: { texto: 'Me enorgullece ser quien despierta ánimo cuando el clima es adverso.', color: 'Amarillo' },
  },
  {
    id: 'd14',
    a: { texto: 'Me adapto al ritmo del grupo sin chocar.', color: 'Verde' },
    b: { texto: 'Impulso al grupo a subir el ritmo cuando hay que entregar.', color: 'Rojo' },
  },
];

export const PREGUNTAS_LOGICA_OBRERO: PreguntaLogicaObrero[] = [
  {
    id: 'l01',
    texto:
      'Un muro rectangular mide 3 m de alto por 4 m de ancho. Si cada metro cuadrado lleva 12 ladrillos, ¿cuántos ladrillos se estiman en total?',
    opciones: ['144', '120', '168', '132'],
    correcta: 0,
  },
  {
    id: 'l02',
    texto: 'Una escalera apoya en la pared. Si la base queda muy lejos de la pared, el riesgo principal es:',
    opciones: [
      'Que la escalera se vea más bonita',
      'Que el ángulo sea inestable y pueda resbalar o voltear',
      'Que suba más rápido',
      'Que use menos material',
    ],
    correcta: 1,
  },
  {
    id: 'l03',
    texto: 'Secuencia de trozos de varilla: 1 m, 2 m, 3 m, 4 m. ¿Qué longitud sigue en el patrón?',
    opciones: ['4,5 m', '5 m', '6 m', '4 m'],
    correcta: 1,
  },
  {
    id: 'l04',
    texto: 'Hay 48 bloques y cada fila del muro usa 8 bloques. ¿Cuántas filas completas se pueden armar?',
    opciones: ['5', '6', '7', '8'],
    correcta: 1,
  },
  {
    id: 'l05',
    texto: 'Dos obreros cargan la misma viga por los extremos. Si uno suelta de golpe, el otro siente el peso casi doble por un instante. Lo más sensato es:',
    opciones: [
      'Soltar al mismo tiempo sin avisar',
      'Contar «1-2-3» y coordinar la bajada',
      'Cargar solo una persona para ir más rápido',
      'Apoyar la viga en el aire sin apoyo intermedio',
    ],
    correcta: 1,
  },
  {
    id: 'l06',
    texto: 'Una mezcla lleva 2 sacos de cemento y 6 de arena. La razón cemento : arena es:',
    opciones: ['1 : 4', '1 : 3', '2 : 8', '1 : 6'],
    correcta: 1,
  },
];

export const PREGUNTAS_CONFIABILIDAD_OBRERO: PreguntaConfObrero[] = [
  {
    id: 'c01',
    texto: 'Encuentras en la obra un paquete de material caro que no es de tu cuadrilla y nadie lo reclama. ¿Qué haces?',
    opciones: [
      'Aviso al encargado o supervisor y dejo constancia por escrito o chat oficial.',
      'Lo guardo en mi casa hasta que alguien pregunte.',
      'Lo reparto o vendo entre compañeros para sacar provecho.',
    ],
    mejor: 0,
  },
  {
    id: 'c02',
    texto: 'Te piden firmar asistencia de un día en que no trabajaste. Tú:',
    opciones: [
      'No firmo y aclaro la situación con honestidad.',
      'Firmo solo si todos lo hacen.',
      'Firmo para no quedar mal con nadie.',
    ],
    mejor: 0,
  },
  {
    id: 'c03',
    texto: 'Se te ocurre un atajo que viola una norma de seguridad pero ahorra tiempo. Tú:',
    opciones: [
      'No lo uso; propongo una alternativa segura al encargado.',
      'Lo uso solo si nadie mira.',
      'Lo uso siempre que sea más rápido.',
    ],
    mejor: 0,
  },
  {
    id: 'c04',
    texto: 'Cometes un error que puede afectar calidad. Lo mejor es:',
    opciones: [
      'Reportarlo de inmediato para corregirlo con supervisión.',
      'Ocultarlo si nadie se ha dado cuenta.',
      'Culpar al proveedor aunque no tengas evidencia.',
    ],
    mejor: 0,
  },
];

const ORDEN_DESEMPATE: ColorPerfilObrero[] = ['Azul', 'Verde', 'Amarillo', 'Rojo'];

export function colorPredominanteDisc(respuestas: Record<string, 'a' | 'b'>): ColorPerfilObrero {
  const cont: Record<ColorPerfilObrero, number> = {
    Rojo: 0,
    Amarillo: 0,
    Verde: 0,
    Azul: 0,
  };
  for (const par of PARES_DISC_OBRERO) {
    const r = respuestas[par.id];
    if (r === 'a') cont[par.a.color] += 1;
    else if (r === 'b') cont[par.b.color] += 1;
  }
  let max = -1;
  const candidatos: ColorPerfilObrero[] = [];
  for (const c of ['Rojo', 'Amarillo', 'Verde', 'Azul'] as const) {
    if (cont[c] > max) {
      max = cont[c];
      candidatos.length = 0;
      candidatos.push(c);
    } else if (cont[c] === max && max >= 0) {
      candidatos.push(c);
    }
  }
  if (candidatos.length === 1) return candidatos[0]!;
  for (const c of ORDEN_DESEMPATE) {
    if (candidatos.includes(c)) return c;
  }
  return 'Verde';
}

export function puntajeLogicaObrero(respuestas: Record<string, number>): {
  correctas: number;
  total: number;
  porcentaje: number;
} {
  let correctas = 0;
  for (const q of PREGUNTAS_LOGICA_OBRERO) {
    const v = respuestas[q.id];
    if (typeof v === 'number' && v === q.correcta) correctas += 1;
  }
  const total = PREGUNTAS_LOGICA_OBRERO.length;
  return {
    correctas,
    total,
    porcentaje: total === 0 ? 0 : Math.round((correctas / total) * 10000) / 100,
  };
}

/** 0–100: 100 si elige la mejor opción, 50 si la intermedia, 0 si la peor. */
export function puntajeConfiabilidadObrero(respuestas: Record<string, number>): {
  porcentaje: number;
  puntosSuma: number;
} {
  let suma = 0;
  const maxPorPregunta = 100;
  for (const q of PREGUNTAS_CONFIABILIDAD_OBRERO) {
    const v = respuestas[q.id];
    if (typeof v !== 'number' || v < 0 || v > 2) continue;
    const dist = Math.abs(v - q.mejor);
    const p = dist === 0 ? 100 : dist === 1 ? 50 : 0;
    suma += p;
  }
  const n = PREGUNTAS_CONFIABILIDAD_OBRERO.length;
  const porcentaje = n === 0 ? 0 : Math.round((suma / (n * maxPorPregunta)) * 10000) / 100;
  return { porcentaje, puntosSuma: suma };
}

export function idsDiscObrero(): string[] {
  return PARES_DISC_OBRERO.map((p) => p.id);
}

export function idsLogicaObrero(): string[] {
  return PREGUNTAS_LOGICA_OBRERO.map((p) => p.id);
}

export function idsConfObrero(): string[] {
  return PREGUNTAS_CONFIABILIDAD_OBRERO.map((p) => p.id);
}

export function totalPasosEvaluacionObrero(): number {
  return PARES_DISC_OBRERO.length + PREGUNTAS_LOGICA_OBRERO.length + PREGUNTAS_CONFIABILIDAD_OBRERO.length;
}

export function validarRespuestasCompletasObrero(body: {
  disc?: Record<string, string>;
  logica?: Record<string, number>;
  confiabilidad?: Record<string, number>;
}): string | null {
  for (const id of idsDiscObrero()) {
    const v = body.disc?.[id];
    if (v !== 'a' && v !== 'b') return `Falta respuesta DISC (${id})`;
  }
  for (const id of idsLogicaObrero()) {
    const v = body.logica?.[id];
    if (typeof v !== 'number' || v < 0 || v > 3) return `Falta respuesta lógica (${id})`;
  }
  for (const id of idsConfObrero()) {
    const v = body.confiabilidad?.[id];
    if (typeof v !== 'number' || v < 0 || v > 2) return `Falta respuesta confiabilidad (${id})`;
  }
  return null;
}

export function procesarEvaluacionObrero(body: {
  disc: Record<string, 'a' | 'b'>;
  logica: Record<string, number>;
  confiabilidad: Record<string, number>;
}): {
  perfil_color: ColorPerfilObrero;
  puntuacion_logica: number;
  puntuacion_confiabilidad: number;
  gma_0_5: number;
  nivel_integridad_riesgo: number;
} {
  const perfil_color = colorPredominanteDisc(body.disc);
  const { porcentaje: puntuacion_logica, correctas } = puntajeLogicaObrero(body.logica);
  const { porcentaje: puntuacion_confiabilidad } = puntajeConfiabilidadObrero(body.confiabilidad);
  const totalL = PREGUNTAS_LOGICA_OBRERO.length;
  const gma_0_5 =
    totalL === 0 ? 0 : Math.min(5, Math.max(0, Math.round((correctas / totalL) * 5)));
  const nivel_integridad_riesgo = Math.round(10 * (1 - puntuacion_confiabilidad / 100) * 100) / 100;
  return {
    perfil_color,
    puntuacion_logica,
    puntuacion_confiabilidad,
    gma_0_5,
    nivel_integridad_riesgo,
  };
}
