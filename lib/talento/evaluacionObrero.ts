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

/** Situaciones de obra: frase corta + dos acciones (sin jerga de oficina). */
export const PARES_DISC_OBRERO: ParDiscObrero[] = [
  {
    id: 'd01',
    a: { texto: 'Termino lo del día aunque tenga que decidir al momento.', color: 'Rojo' },
    b: { texto: 'Mido y reviso material antes de seguir.', color: 'Azul' },
  },
  {
    id: 'd02',
    a: { texto: 'Animo a la cuadrilla cuando el día pesa.', color: 'Amarillo' },
    b: { texto: 'Hago lo que dijo el encargado, paso a paso.', color: 'Verde' },
  },
  {
    id: 'd03',
    a: { texto: 'Si vamos atrasados, apuro para alcanzar.', color: 'Rojo' },
    b: { texto: 'Si vamos atrasados, pregunto y sigo con calma.', color: 'Verde' },
  },
  {
    id: 'd04',
    a: { texto: 'Digo en voz alta qué voy a hacer.', color: 'Amarillo' },
    b: { texto: 'Me concentro y hago bien lo acordado.', color: 'Azul' },
  },
  {
    id: 'd05',
    a: { texto: 'Decido ya, sin tanta reunión.', color: 'Rojo' },
    b: { texto: 'Espero la orden y no me salgo de ella.', color: 'Verde' },
  },
  {
    id: 'd06',
    a: { texto: 'Hablo con la gente y calmo los líos.', color: 'Amarillo' },
    b: { texto: 'Dejo el trabajo limpio y parejo.', color: 'Azul' },
  },
  {
    id: 'd07',
    a: { texto: 'Si hay duda de seguridad, paro y pregunto.', color: 'Azul' },
    b: { texto: 'Si hay duda de seguridad, busco cómo seguir.', color: 'Rojo' },
  },
  {
    id: 'd08',
    a: { texto: 'Que la cuadrilla esté a gusto, aunque vayamos más lento.', color: 'Amarillo' },
    b: { texto: 'Que cada quien haga lo suyo, sin vuelta.', color: 'Rojo' },
  },
  {
    id: 'd09',
    a: { texto: 'Hago lo que me mandan, aunque piense otra cosa.', color: 'Verde' },
    b: { texto: 'Si veo una forma más rápida y segura, la digo.', color: 'Rojo' },
  },
  {
    id: 'd10',
    a: { texto: 'Me lleva el ambiente: hablar y reír con la cuadrilla.', color: 'Amarillo' },
    b: { texto: 'Me lleva dejar filas o instalación bien hechas.', color: 'Azul' },
  },
  {
    id: 'd11',
    a: { texto: 'Quiero ver avance hoy, aunque falten detalles.', color: 'Rojo' },
    b: { texto: 'Quiero cerrar bien los detalles, aunque avance menos.', color: 'Azul' },
  },
  {
    id: 'd12',
    a: { texto: 'Oigo a todos antes de actuar.', color: 'Amarillo' },
    b: { texto: 'Sigo con paciencia aunque el oficio se repita.', color: 'Verde' },
  },
  {
    id: 'd13',
    a: { texto: 'Me importa que el trabajo quede bien hecho.', color: 'Azul' },
    b: { texto: 'Me importa levantar el ánimo cuando el día está feo.', color: 'Amarillo' },
  },
  {
    id: 'd14',
    a: { texto: 'Me acomodo al ritmo del grupo.', color: 'Verde' },
    b: { texto: 'Empujo para ir más rápido cuando hay que entregar.', color: 'Rojo' },
  },
];

export const PREGUNTAS_LOGICA_OBRERO: PreguntaLogicaObrero[] = [
  {
    id: 'l01',
    texto: 'Muro de 3 m de alto × 4 m de ancho. Van 12 ladrillos por m². ¿Cuántos ladrillos?',
    opciones: ['144', '120', '168', '132'],
    correcta: 0,
  },
  {
    id: 'l02',
    texto: 'Escalera contra la pared: la pata quedó muy lejos. ¿Qué riesgo hay?',
    opciones: [
      'Se ve más bonita',
      'Puede resbalar o voltearse',
      'Subes más rápido',
      'Gastas menos material',
    ],
    correcta: 1,
  },
  {
    id: 'l03',
    texto: 'Varillas: 1 m, 2 m, 3 m, 4 m. ¿Cuál sigue?',
    opciones: ['4,5 m', '5 m', '6 m', '4 m'],
    correcta: 1,
  },
  {
    id: 'l04',
    texto: '48 bloques. Cada fila usa 8. ¿Cuántas filas completas?',
    opciones: ['5', '6', '7', '8'],
    correcta: 1,
  },
  {
    id: 'l05',
    texto: 'Dos cargan una viga. Uno suelta de golpe. ¿Qué hacer?',
    opciones: [
      'Soltar los dos sin avisar',
      'Contar 1-2-3 y bajar juntos',
      'Que cargue uno solo',
      'Dejarla en el aire',
    ],
    correcta: 1,
  },
  {
    id: 'l06',
    texto: 'Mezcla: 2 sacos de cemento y 6 de arena. ¿Qué proporción es?',
    opciones: [
      '1 cemento por 4 arena',
      '1 cemento por 3 arena',
      '2 cemento por 8 arena',
      '1 cemento por 6 arena',
    ],
    correcta: 1,
  },
];

export const PREGUNTAS_CONFIABILIDAD_OBRERO: PreguntaConfObrero[] = [
  {
    id: 'c01',
    texto: 'Hallaste un paquete caro que no es de tu cuadrilla. ¿Qué haces?',
    opciones: [
      'Se lo aviso al encargado.',
      'Me lo llevo a la casa.',
      'Lo vendo o lo reparto entre nosotros.',
    ],
    mejor: 0,
  },
  {
    id: 'c02',
    texto: 'Te piden firmar asistencia de un día que no viniste. ¿Qué haces?',
    opciones: [
      'No firmo. Digo la verdad.',
      'Firmo si todos firman.',
      'Firmo para no quedar mal.',
    ],
    mejor: 0,
  },
  {
    id: 'c03',
    texto: 'Hay un atajo peligroso que ahorra tiempo. ¿Qué haces?',
    opciones: [
      'No lo uso. Aviso al encargado.',
      'Lo uso si nadie me ve.',
      'Lo uso siempre que sea más rápido.',
    ],
    mejor: 0,
  },
  {
    id: 'c04',
    texto: 'Cometiste un error que puede dañar el trabajo. ¿Qué haces?',
    opciones: [
      'Aviso de una vez al encargado.',
      'Callo si nadie se dio cuenta.',
      'Le echo la culpa a otro.',
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
