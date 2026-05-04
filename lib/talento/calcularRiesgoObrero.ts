/**
 * Calificación de riesgo de contratación para personal de campo (obrero),
 * a partir de `ci_empleados`: perfil_color, puntuacion_logica, tiempo_respuesta (segundos).
 * Lógica determinística; usable en API Route y en cliente.
 */

export type NivelRiesgoContratacion = 'verde' | 'amarillo' | 'rojo';

export type ResultadoRiesgoObrero = {
  nivel: NivelRiesgoContratacion | 'sin_datos';
  etiqueta: string;
  /** Texto corto para tooltip / UI */
  tooltip: string;
  detalles: {
    puntuacion_logica: number | null;
    perfil_color: string | null;
    tiempo_respuesta: number | null;
  };
};

/** Ventana “promedio” deseable: 5–10 minutos. */
const T_VERDE_MIN = 5 * 60;
const T_VERDE_MAX = 10 * 60;
/** Por debajo: posible azar; por encima del examen típico: posible dificultad (15 min límite UI). */
const T_EXTREMO_BAJO = 2 * 60;
const T_EXTREMO_ALTO = 15 * 60;

function normPerfil(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (['Rojo', 'Amarillo', 'Verde', 'Azul'].includes(cap)) return cap;
  return s;
}

/**
 * Evalúa riesgo operativo / contratación según reglas de producto (semáforo ejecutivo).
 */
export function calcularRiesgoObrero(entrada: {
  perfil_color?: string | null;
  puntuacion_logica?: number | null;
  tiempo_respuesta?: number | null;
}): ResultadoRiesgoObrero {
  const perfil_color = normPerfil(entrada.perfil_color);
  const puntuacion_logica =
    typeof entrada.puntuacion_logica === 'number' && Number.isFinite(entrada.puntuacion_logica)
      ? entrada.puntuacion_logica
      : null;
  const tiempo_respuesta =
    typeof entrada.tiempo_respuesta === 'number' &&
    Number.isFinite(entrada.tiempo_respuesta) &&
    entrada.tiempo_respuesta >= 0
      ? Math.floor(entrada.tiempo_respuesta)
      : null;

  const detalles = {
    puntuacion_logica,
    perfil_color,
    tiempo_respuesta,
  };

  if (puntuacion_logica == null || perfil_color == null || tiempo_respuesta == null) {
    return {
      nivel: 'sin_datos',
      etiqueta: 'Sin evaluar',
      tooltip: 'Faltan perfil_color, puntuacion_logica o tiempo_respuesta para calcular el riesgo.',
      detalles,
    };
  }

  const perfilVeAz = perfil_color === 'Verde' || perfil_color === 'Azul';
  const perfilAmRo = perfil_color === 'Amarillo' || perfil_color === 'Rojo';

  const tiempoEnVentanaVerde =
    tiempo_respuesta >= T_VERDE_MIN && tiempo_respuesta <= T_VERDE_MAX;
  const tiempoExtremo =
    tiempo_respuesta < T_EXTREMO_BAJO || tiempo_respuesta > T_EXTREMO_ALTO;
  const tiempoModeradoFuera =
    !tiempoEnVentanaVerde &&
    !tiempoExtremo &&
    tiempo_respuesta >= T_EXTREMO_BAJO &&
    tiempo_respuesta <= T_EXTREMO_ALTO;

  // —— Rojo (alerta) ——
  if (puntuacion_logica < 50) {
    return {
      nivel: 'rojo',
      etiqueta: 'Alto riesgo',
      tooltip: `Lógica: ${puntuacion_logica}% — Riesgo de seguridad industrial.`,
      detalles,
    };
  }

  if (tiempoExtremo) {
    const parte =
      tiempo_respuesta < T_EXTREMO_BAJO
        ? 'Tiempo extremadamente bajo (posible respuesta al azar)'
        : 'Tiempo extremadamente alto (posible dificultad de comprensión)';
    return {
      nivel: 'rojo',
      etiqueta: 'Alto riesgo',
      tooltip: `${parte}: ${Math.round(tiempo_respuesta / 60)} min.`,
      detalles,
    };
  }

  if (perfil_color === 'Rojo' && puntuacion_logica < 75) {
    return {
      nivel: 'rojo',
      etiqueta: 'Alto riesgo',
      tooltip: `Perfil dominante sin balance lógico suficiente (lógica ${puntuacion_logica}%).`,
      detalles,
    };
  }

  // —— Verde (bajo riesgo / recomendado) ——
  if (puntuacion_logica > 75 && perfilVeAz && tiempoEnVentanaVerde) {
    return {
      nivel: 'verde',
      etiqueta: 'Bajo riesgo',
      tooltip: `Recomendado: lógica ${puntuacion_logica}%, perfil ${perfil_color}, tiempo en rango 5–10 min.`,
      detalles,
    };
  }

  // —— Amarillo (moderado / supervisión) ——
  const motivos: string[] = [];
  if (puntuacion_logica >= 50 && puntuacion_logica <= 75) {
    motivos.push(`Lógica moderada (${puntuacion_logica}%)`);
  }
  if (puntuacion_logica > 75 && perfilAmRo) {
    motivos.push(`Perfil ${perfil_color}: conviene entrevista / supervisión`);
  }
  if (puntuacion_logica > 75 && perfilVeAz && !tiempoEnVentanaVerde) {
    motivos.push('Tiempo fuera del rango óptimo (5–10 min)');
  }
  if (tiempoModeradoFuera) {
    motivos.push('Tiempo ligeramente rápido o lento respecto al promedio');
  }
  if (motivos.length === 0) {
    motivos.push('Señales mixtas: revisión humana recomendada');
  }

  return {
    nivel: 'amarillo',
    etiqueta: 'Riesgo moderado',
    tooltip: motivos.join(' · '),
    detalles,
  };
}
