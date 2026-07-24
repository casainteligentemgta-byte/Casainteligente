import type { ExamenGenerado } from '@/types/talento';
import { ESCALA_FRECUENCIA_PERSONALIDAD } from '@/lib/talento/escalaFrecuenciaPersonalidad';
import { esPreguntaSituacionalObra } from '@/lib/talento/preguntasActitudObraObrero';

export type PasoExamenTalento = {
  id: string;
  pregunta: string;
  bloque?: string;
  seccion: 'personalidad' | 'logica';
  opciones: ReadonlyArray<{ texto: string; valor: number }>;
};

/** Lista plana de preguntas (conducta + lógica) para UI paso a paso. */
export function examenGeneradoAPasos(examen: ExamenGenerado): PasoExamenTalento[] {
  const pasos: PasoExamenTalento[] = [];

  for (const p of examen.personalidad) {
    if (esPreguntaSituacionalObra(p)) {
      pasos.push({
        id: p.id,
        pregunta: p.texto,
        bloque: p.bloque,
        seccion: 'personalidad',
        opciones: p.opciones.map((texto, idx) => ({ texto, valor: idx })),
      });
    } else {
      pasos.push({
        id: p.id,
        pregunta: p.texto,
        bloque: p.bloque,
        seccion: 'personalidad',
        opciones: ESCALA_FRECUENCIA_PERSONALIDAD.map((op) => ({
          texto: op.etiqueta,
          valor: op.valor,
        })),
      });
    }
  }

  for (const q of examen.logica) {
    pasos.push({
      id: q.id,
      pregunta: q.texto,
      bloque: 'Lógica',
      seccion: 'logica',
      opciones: q.opciones.map((texto, idx) => ({ texto, valor: idx })),
    });
  }

  return pasos;
}
