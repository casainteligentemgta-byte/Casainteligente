import { NextResponse } from 'next/server';
import { notificarDeployLogBotAsync } from '@/lib/telegram/notificarDeployLogBot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VercelDeployPayload = {
  type?: string;
  payload?: {
    deployment?: {
      url?: string;
      meta?: { githubCommitRef?: string; githubCommitSha?: string; gitCommitMessage?: string };
      name?: string;
    };
    project?: { name?: string };
    target?: string;
    links?: { deployment?: string };
  };
};

function validarSecreto(req: Request): boolean {
  const secret = process.env.VERCEL_DEPLOY_NOTIFY_SECRET?.trim();
  // Sin clave configurada no se acepta ningún aviso: antes cualquiera podía hacer que el
  // bot anunciara un despliegue que no ocurrió.
  if (!secret) return false;
  const auth = req.headers.get('authorization')?.trim();
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get('x-deploy-notify-secret')?.trim();
  return header === secret;
}

export async function POST(req: Request) {
  if (!validarSecreto(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: VercelDeployPayload | Record<string, unknown> = {};
  try {
    body = (await req.json()) as VercelDeployPayload;
  } catch {
    return NextResponse.json({ ok: true, skipped: 'invalid_json' });
  }

  const tipo = String(body.type ?? '').toLowerCase();
  const payload = (body as VercelDeployPayload).payload;
  const deployment = payload?.deployment;
  const url =
    deployment?.url?.trim() ||
    payload?.links?.deployment?.trim() ||
    'https://casainteligente.company';
  const rama = deployment?.meta?.githubCommitRef?.trim() || null;
  const commit = deployment?.meta?.githubCommitSha?.trim()?.slice(0, 12) || null;
  const mensaje = deployment?.meta?.gitCommitMessage?.trim() || null;
  const proyecto = payload?.project?.name?.trim() || deployment?.name?.trim() || null;

  if (tipo.includes('error') || tipo.includes('canceled') || tipo.includes('failed')) {
    notificarDeployLogBotAsync({
      estado: 'error',
      url,
      rama,
      commit,
      mensaje: mensaje ?? tipo,
      origen: proyecto ? `Vercel · ${proyecto}` : 'Vercel',
    });
    return NextResponse.json({ ok: true, notified: 'error' });
  }

  if (tipo.includes('created') || tipo.includes('building')) {
    notificarDeployLogBotAsync({
      estado: 'inicio',
      url,
      rama,
      commit,
      origen: proyecto ? `Vercel · ${proyecto}` : 'Vercel',
    });
    return NextResponse.json({ ok: true, notified: 'inicio' });
  }

  if (
    tipo.includes('succeeded') ||
    tipo.includes('ready') ||
    tipo === '' ||
    payload?.target === 'production'
  ) {
    notificarDeployLogBotAsync({
      estado: 'ok',
      url: url.startsWith('http') ? url : `https://${url}`,
      rama,
      commit,
      mensaje,
      origen: proyecto ? `Vercel · ${proyecto}` : 'Vercel',
    });
    return NextResponse.json({ ok: true, notified: 'ok' });
  }

  return NextResponse.json({ ok: true, skipped: tipo || 'unknown_type' });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    activo: Boolean(process.env.VERCEL_DEPLOY_NOTIFY_SECRET?.trim()),
    hint: 'POST con payload de Vercel y Authorization: Bearer VERCEL_DEPLOY_NOTIFY_SECRET. Sin esa variable no se acepta ningún aviso.',
  });
}
