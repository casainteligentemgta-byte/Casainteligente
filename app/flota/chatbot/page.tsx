'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatbotMecanico from '@/components/flota/chatbot/ChatbotMecanico';
import CargaManual from '@/components/flota/chatbot/CargaManual';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { FlotaManual, FragmentoManual } from '@/lib/flota/chatbot';

export default function FlotaChatbotPage() {
  const router = useRouter();
  const [manuales, setManuales] = useState<FlotaManual[]>([]);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl('/api/flota/chatbot'), { credentials: 'include' });
    if (res.status === 401) {
      router.push('/login?next=/flota/chatbot');
      return;
    }
    const json = await parseFetchJson<{ manuales?: FlotaManual[]; hint?: string; error?: string }>(res);
    if (!res.ok) throw new Error(formatApiErrorBody(json));
    setManuales(json.manuales ?? []);
    setHint(json.hint ?? null);
  }, [router]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Mecánico</h2>
        <p className="text-sm text-zinc-500">Preguntas de taller con contexto de los manuales cargados.</p>
      </div>
      {hint ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <ChatbotMecanico
        sending={sending}
        onAsk={async (pregunta) => {
          setSending(true);
          try {
            const res = await fetch(apiUrl('/api/flota/chatbot'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pregunta }),
            });
            const json = await parseFetchJson<{
              respuesta?: string;
              fuentes?: FragmentoManual[];
              error?: string;
            }>(res);
            if (!res.ok) throw new Error(formatApiErrorBody(json));
            return { respuesta: json.respuesta ?? 'Sin respuesta', fuentes: json.fuentes ?? [] };
          } finally {
            setSending(false);
          }
        }}
      />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Manuales</h3>
        <CargaManual
          manuales={manuales}
          saving={saving}
          onUpload={async (fd) => {
            setSaving(true);
            setError(null);
            try {
              const res = await fetch(apiUrl('/api/flota/chatbot/upload-manual'), {
                method: 'POST',
                credentials: 'include',
                body: fd,
              });
              const json = await parseFetchJson<{ error?: string }>(res);
              if (!res.ok) throw new Error(formatApiErrorBody(json));
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo cargar el manual');
            } finally {
              setSaving(false);
            }
          }}
          onDelete={async (id) => {
            await fetch(apiUrl(`/api/flota/chatbot/upload-manual?id=${id}`), {
              method: 'DELETE',
              credentials: 'include',
            });
            await load();
          }}
        />
      </section>
    </div>
  );
}
