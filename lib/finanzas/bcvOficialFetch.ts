/**
 * Fetch TLS a www.bcv.org.ve con el intermedio empaquetado.
 * Solo servidor (node:https). El parser vive en bcvOficial.ts para poder usarlo en el cliente.
 */
import https from 'node:https';
import tls from 'node:tls';
import { BCV_ORG_VE_EXTRA_CA_PEMS } from '@/lib/finanzas/certs/sectigoBcvOrgVeCa';
import {
  BCV_OFICIAL_HOSTS,
  BCV_OFICIAL_URL,
  parseBcvHomepageHtml,
  type ParseoBcvOficial,
} from '@/lib/finanzas/bcvOficial';

export function createBcvHttpsAgent(): https.Agent {
  return new https.Agent({
    ca: [...tls.rootCertificates, ...BCV_ORG_VE_EXTRA_CA_PEMS],
    rejectUnauthorized: true,
  });
}

function esUrlBcv(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && BCV_OFICIAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export async function fetchBcvHomepageHtml(opts?: {
  url?: string;
  timeoutMs?: number;
  agent?: https.Agent;
}): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const agent = opts?.agent ?? createBcvHttpsAgent();
  const startUrl = opts?.url ?? BCV_OFICIAL_URL;

  const once = (url: string, hops: number): Promise<string> =>
    new Promise((resolve, reject) => {
      if (hops > 4) {
        reject(new Error('Demasiadas redirecciones en bcv.org.ve'));
        return;
      }
      if (!esUrlBcv(url)) {
        reject(new Error(`Redirección fuera de bcv.org.ve: ${url}`));
        return;
      }
      const req = https.get(
        url,
        {
          agent,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'CasaInteligente/1.0 (sync tasa BCV oficial)',
          },
        },
        (res) => {
          const loc = res.headers.location;
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
            res.resume();
            const next = new URL(loc, url).toString();
            resolve(once(next, hops + 1));
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume();
            reject(new Error(`BCV HTTP ${res.statusCode ?? 'sin estado'}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        },
      );
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Timeout al leer www.bcv.org.ve'));
      });
      req.on('error', reject);
    });

  return once(startUrl, 0);
}

export async function obtenerTasaOficialBcv(opts?: {
  timeoutMs?: number;
}): Promise<ParseoBcvOficial> {
  const html = await fetchBcvHomepageHtml({ timeoutMs: opts?.timeoutMs });
  const parsed = parseBcvHomepageHtml(html);
  if (!parsed) {
    throw new Error('No se pudo leer USD / Fecha Valor en la portada de bcv.org.ve');
  }
  return parsed;
}
