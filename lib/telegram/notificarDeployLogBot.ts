import { notifyErrorBotAsync } from '@/lib/telegram/notifyErrorBot';

export type NotificarDeployLogParams = {
  estado?: 'ok' | 'error' | 'inicio';
  url?: string | null;
  rama?: string | null;
  commit?: string | null;
  mensaje?: string | null;
  origen?: string | null;
};

function truncar(s: string, max = 120): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Anuncia deploy en el bot de logs (infraestructura). */
export function notificarDeployLogBotAsync(params: NotificarDeployLogParams = {}): void {
  const estado = params.estado ?? 'ok';
  const icono = estado === 'error' ? '❌' : estado === 'inicio' ? '🚀' : '✅';
  const titulo =
    estado === 'error'
      ? 'Deploy fallido'
      : estado === 'inicio'
        ? 'Deploy iniciado'
        : 'Deploy en producción';

  const lineas = [
    `${icono} ${titulo}`,
    `Origen: ${params.origen?.trim() || 'Vercel'}`,
  ];
  if (params.rama?.trim()) lineas.push(`Rama: ${truncar(params.rama)}`);
  if (params.commit?.trim()) lineas.push(`Commit: ${truncar(params.commit, 40)}`);
  if (params.url?.trim()) lineas.push(`URL: ${params.url.trim()}`);
  if (params.mensaje?.trim()) lineas.push(`Detalle: ${truncar(params.mensaje, 300)}`);

  notifyErrorBotAsync(lineas.join('\n'), { origen: 'Deploy · Casa Inteligente' });
}
