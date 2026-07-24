/**
 * Motor de verificación de regulaciones públicas (SAREN, INTT, BANAVIH).
 */

export type VerificacionVehiculo = {
  viable: boolean;
  dias_restantes: number;
  dias_transcurridos: number;
  alertas: string[];
};

export type VerificacionBanavih = {
  dias_transcurridos: number;
  vencido: boolean;
  alerta: string;
  plazo_limite_dias: number;
};

const PLAZO_INTT_DIAS = 30;
/** Aprox. 30 días hábiles ≈ 42 días corridos. */
const PLAZO_BANAVIH_DIAS_CORRIDOS = 42;

function parseFecha(input: string | Date): Date {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new Error('Fecha inválida');
    return input;
  }
  const d = new Date(input.includes('T') ? input : `${input}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida (use AAAA-MM-DD)');
  return d;
}

function diasEntre(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function verificarVehiculo(params: {
  fechaNotaria: string | Date;
  titularCoincideIntt: boolean;
  ahora?: Date;
}): VerificacionVehiculo {
  const fecha = parseFecha(params.fechaNotaria);
  const hoy = params.ahora ?? new Date();
  const diasTranscurridos = diasEntre(fecha, hoy);
  const alertas: string[] = [];

  if (!params.titularCoincideIntt) {
    alertas.push(
      'BLOQUEO SAREN: El vendedor no es el dueño registrado ante el INTT (Circular 00068).',
    );
  }
  if (diasTranscurridos > PLAZO_INTT_DIAS) {
    alertas.push(
      'SANCIÓN INTT: Plazo de 30 días para transferencia vencido. Aplica multa de 3 U.T.',
    );
  }

  return {
    viable: params.titularCoincideIntt,
    dias_restantes: Math.max(0, PLAZO_INTT_DIAS - diasTranscurridos),
    dias_transcurridos: Math.max(0, diasTranscurridos),
    alertas,
  };
}

export function verificarBanavih(params: {
  fechaConstitucion: string | Date;
  ahora?: Date;
}): VerificacionBanavih {
  const fecha = parseFecha(params.fechaConstitucion);
  const hoy = params.ahora ?? new Date();
  const diasTranscurridos = Math.max(0, diasEntre(fecha, hoy));
  const vencido = diasTranscurridos > PLAZO_BANAVIH_DIAS_CORRIDOS;

  return {
    dias_transcurridos: diasTranscurridos,
    vencido,
    plazo_limite_dias: PLAZO_BANAVIH_DIAS_CORRIDOS,
    alerta: vencido
      ? 'ALERTA: Plazo de inscripción de 30 días hábiles en BANAVIH vencido (riesgo de multa).'
      : 'En lapso de inscripción.',
  };
}
