import type { MinutaPheme } from '@/lib/pheme/types';

/** Formato obligatorio de salida Pheme (minuta accionable). */
export function formatearMinutaMarkdown(minuta: MinutaPheme): string {
  const puntos =
    minuta.puntos_clave.length > 0
      ? minuta.puntos_clave.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '_Sin puntos clave identificados._';

  const filas =
    minuta.acuerdos.length > 0
      ? minuta.acuerdos
          .map((a) => {
            const fecha = a.fecha_limite?.trim() || '—';
            return `| ${escaparCelda(a.tarea)} | ${escaparCelda(a.responsable)} | ${escaparCelda(fecha)} |`;
          })
          .join('\n')
      : '| — | — | — |';

  const alertas =
    minuta.alertas_pendientes.length > 0
      ? minuta.alertas_pendientes.map((a) => `- ${a}`).join('\n')
      : '_Ninguna alerta crítica registrada._';

  return [
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
