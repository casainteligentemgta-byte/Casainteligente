import type { MinutaPheme } from '@/lib/pheme/types';

/** Formato de minuta accionable Pheme. */
export function formatearMinutaMarkdown(minuta: MinutaPheme, tituloReunion?: string): string {
  const puntos =
    minuta.puntos_clave.length > 0
      ? minuta.puntos_clave.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '_Sin puntos clave identificados._';

  const filas =
    minuta.acuerdos.length > 0
      ? minuta.acuerdos
          .map((a) => {
            const fecha = a.fecha_limite?.trim() || 'N/A';
            return `| ${escaparCelda(a.tarea)} | ${escaparCelda(a.responsable)} | ${escaparCelda(fecha)} |`;
          })
          .join('\n')
      : '| — | — | N/A |';

  const alertas =
    minuta.pendientes_o_alertas.length > 0
      ? minuta.pendientes_o_alertas.map((a) => `- ${a}`).join('\n')
      : '_Ninguna alerta crítica registrada._';

  const titulo = (tituloReunion ?? '').trim();
  const cabecera = titulo ? [`# ${titulo}`, ''] : [];

  return [
    ...cabecera,
    '## 1. RESUMEN EJECUTIVO',
    '',
    minuta.resumen_ejecutivo.trim() || '_Sin resumen._',
    '',
    '## 2. PUNTOS CLAVE TRATADOS',
    '',
    puntos,
    '',
    '## 3. TABLA DE ACUERDOS Y COMPROMISOS',
    '',
    '| Tarea / Compromiso | Responsable | Fecha Límite (si se mencionó) |',
    '| --- | --- | --- |',
    filas,
    '',
    '## 4. ALERTAS O TEMAS PENDIENTES',
    '',
    alertas,
    '',
  ].join('\n');
}

function escaparCelda(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}
