import { createServer } from 'node:http';
import { requireWorkerAuth } from './auth.js';
import { runReconstructJob } from './pipeline/reconstruct.js';
import type { ReconstructRequest } from './types.js';

const PORT = Number(process.env.PORT ?? process.env.OBRA_TOURS_WORKER_PORT ?? '8787');

const inflight = new Set<string>();

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

async function readJson(req: Request): Promise<unknown> {
  return req.json();
}

function parseReconstructBody(raw: unknown): ReconstructRequest | string {
  if (!raw || typeof raw !== 'object') return 'JSON inválido';
  const b = raw as Record<string, unknown>;
  const job_id = String(b.job_id ?? '').trim();
  const proyecto_id = String(b.proyecto_id ?? '').trim();
  const video_url = String(b.video_url ?? '').trim();
  const fuente_captura = String(b.fuente_captura ?? '').trim();
  const calidad = String(b.calidad ?? 'rapida').trim();
  const callback_url = String(b.callback_url ?? '').trim();
  const callback_token = String(b.callback_token ?? '').trim();

  if (!job_id) return 'Falta job_id';
  if (!proyecto_id) return 'Falta proyecto_id';
  if (!video_url || !/^https?:\/\//i.test(video_url)) return 'video_url inválida';
  if (fuente_captura !== 'dron' && fuente_captura !== 'celular') {
    return 'fuente_captura debe ser dron o celular';
  }
  if (calidad !== 'rapida' && calidad !== 'detallada') {
    return 'calidad debe ser rapida o detallada';
  }
  if (!callback_url || !/^https?:\/\//i.test(callback_url)) return 'callback_url inválida';
  if (!callback_token) return 'Falta callback_token';

  return {
    job_id,
    proyecto_id,
    video_url,
    fuente_captura,
    calidad,
    callback_url,
    callback_token,
  };
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '') || '/';

  if (req.method === 'GET' && (path === '/' || path === '/health')) {
    return json(200, {
      ok: true,
      service: 'obra-tours-worker',
      version: '1.0.0',
      pipeline: process.env.OBRA_TOURS_PIPELINE ?? 'frames_glb',
      inflight: inflight.size,
    });
  }

  if (req.method === 'POST' && path === '/v1/reconstruct') {
    const denied = requireWorkerAuth(req);
    if (denied) return denied;

    let raw: unknown;
    try {
      raw = await readJson(req);
    } catch {
      return json(400, { error: 'JSON inválido' });
    }

    const parsed = parseReconstructBody(raw);
    if (typeof parsed === 'string') {
      return json(400, { error: parsed });
    }

    if (inflight.has(parsed.job_id)) {
      return json(202, { accepted: true, job_id: parsed.job_id, duplicate: true });
    }

    inflight.add(parsed.job_id);
    void runReconstructJob(parsed).finally(() => inflight.delete(parsed.job_id));

    return json(202, {
      accepted: true,
      job_id: parsed.job_id,
      pipeline: process.env.OBRA_TOURS_PIPELINE ?? 'frames_glb',
    });
  }

  return json(404, { error: 'Not found' });
}

createServer(async (nodeReq, nodeRes) => {
  try {
    const host = nodeReq.headers.host ?? `127.0.0.1:${PORT}`;
    const url = `http://${host}${nodeReq.url ?? '/'}`;
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bodyBuf = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(nodeReq.headers)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else headers.set(k, v);
    }
    const request = new Request(url, {
      method: nodeReq.method,
      headers,
      body: ['GET', 'HEAD'].includes(nodeReq.method ?? 'GET') ? undefined : bodyBuf,
    });
    const response = await handler(request);
    nodeRes.statusCode = response.status;
    response.headers.forEach((value, key) => {
      nodeRes.setHeader(key, value);
    });
    const ab = await response.arrayBuffer();
    nodeRes.end(Buffer.from(ab));
  } catch (e) {
    nodeRes.statusCode = 500;
    nodeRes.setHeader('Content-Type', 'application/json');
    nodeRes.end(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Error interno' }),
    );
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[obra-tours-worker] listening on :${PORT}`);
});
