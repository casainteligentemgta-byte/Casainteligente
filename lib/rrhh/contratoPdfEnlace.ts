import { apiUrl } from '@/lib/http/apiUrl';



const CI_EXPRESS_PREFIX = 'ci-express-';



export type ContratoPdfResuelto = {

  url: string | null;

  error: string | null;

  /** URL firmada de Supabase (WhatsApp / copiar enlace externo). */

  signedUrl?: string | null;

  source?: 'storage' | 'generate';

};



export function expressIdDesdeFilaEmpleado(empleadoRowId: string): string | null {

  const id = empleadoRowId.trim();

  if (!id.startsWith(CI_EXPRESS_PREFIX)) return null;

  const rest = id.slice(CI_EXPRESS_PREFIX.length).trim();

  return rest || null;

}



export function urlPdfContratoEmpleadoRrhh(empleadoId: string): string {

  return apiUrl(

    `/api/rrhh/contrato-pdf/stream?empleado_id=${encodeURIComponent(empleadoId.trim())}`,

  );

}



function empleadoRowIdFromArg(empleadoRowId: string): string {

  return empleadoRowId.trim();

}



export async function resolverUrlPdfContratoFila(empleadoRowId: string): Promise<ContratoPdfResuelto> {

  const expressId = expressIdDesdeFilaEmpleado(empleadoRowId);

  const q = expressId

    ? `express_id=${encodeURIComponent(expressId)}`

    : `empleado_id=${encodeURIComponent(empleadoRowIdFromArg(empleadoRowId))}`;



  const resolverPath = `/api/rrhh/contrato-pdf/resolver?${q}`;



  try {

    const res = await fetch(apiUrl(resolverPath), { credentials: 'include' });

    const j = (await res.json().catch(() => ({}))) as {

      url?: string;

      signed_url?: string;

      error?: string;

      source?: 'storage' | 'generate';

    };



    if (!res.ok) {

      return {

        url: null,

        error: j.error ?? `No se pudo obtener el PDF (${res.status}).`,

      };

    }



    const rel = (j.url ?? '').trim();

    if (!rel) {

      return { url: null, error: j.error ?? 'No hay PDF del contrato.' };

    }



    const viewUrl = rel.startsWith('http') ? rel : apiUrl(rel);

    const signed = (j.signed_url ?? '').trim() || null;



    return {

      url: viewUrl,

      signedUrl: signed,

      source: j.source,

      error: null,

    };

  } catch (e) {

    const msg = e instanceof Error ? e.message : 'Error de red';

    let hint = '';
    if (/unable to verify|certificate/i.test(msg)) {
      hint =
        ' En Windows: añada SUPABASE_DEV_INSECURE_TLS=1 en .env.local y reinicie, o ejecute npm run dev:tls. Ver docs/ERROR-FETCH-FAILED-SUPABASE.md';
    } else if (msg.includes('fetch failed') || msg === 'Failed to fetch') {
      hint =
        ' Compruebe que el servidor de desarrollo está en marcha (npm run dev) y que abre la app con http://localhost:3000.';
    }

    return { url: null, error: `${msg}.${hint}` };

  }

}



export function urlCompartirContratoPdf(resuelto: ContratoPdfResuelto): string | null {

  if (resuelto.signedUrl) return resuelto.signedUrl;

  return resuelto.url;

}



export function mensajeWhatsAppContratoPdf(nombreObrero: string, pdfUrl: string): string {

  const nom = nombreObrero.trim() || 'trabajador/a';

  return `Hola, te enviamos el contrato de trabajo de Casa Inteligente (${nom}).\n\nPDF:\n${pdfUrl}`;

}


