'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PhemeAnalisisRow, PhemeEmbeddingHit, ReunionRow } from '@/types/pheme';

type ReunionListItem = Pick<
  ReunionRow,
  | 'id'
  | 'titulo'
  | 'estado'
  | 'file_name'
  | 'mime_type'
  | 'file_size_bytes'
  | 'duracion_segundos'
  | 'created_at'
  | 'updated_at'
  | 'error_message'
>;

type DetalleResponse = {
  reunion: ReunionRow;
  analisis: PhemeAnalisisRow | null;
  embeddings_count: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PhemePage() {
  const router = useRouter();
  const [reuniones, setReuniones] = useState<ReunionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<PhemeEmbeddingHit[]>([]);
  const [searching, setSearching] = useState(false);

  const loadReuniones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pheme/reuniones');
      if (res.status === 401) {
        router.push('/login?next=/pheme');
        return;
      }
      const json = (await res.json()) as { data?: ReunionListItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar reuniones');
      setReuniones(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadDetalle = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/pheme/reuniones/${id}`);
        if (res.status === 401) {
          router.push('/login?next=/pheme');
          return;
        }
        const json = (await res.json()) as { data?: DetalleResponse; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Error al cargar detalle');
        setDetalle(json.data ?? null);
        setSelectedId(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar detalle');
      }
    },
    [router],
  );

  useEffect(() => {
    void loadReuniones();
  }, [loadReuniones]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (titulo.trim()) form.append('titulo', titulo.trim());
      const res = await fetch('/api/pheme/reuniones', { method: 'POST', body: form });
      const json = (await res.json()) as {
        data?: { reunionId: string };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Error al subir');
      setTitulo('');
      await loadReuniones();
      if (json.data?.reunionId) {
        await loadDetalle(json.data.reunionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir audio');
    } finally {
      setUploading(false);
    }
  }

  async function onProcess(id: string) {
    setProcessingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/pheme/reuniones/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredSttProvider: 'auto' }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al procesar');
      await loadReuniones();
      await loadDetalle(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar');
      await loadReuniones();
    } finally {
      setProcessingId(null);
    }
  }

  async function onSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch('/api/pheme/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          reunionId: selectedId || undefined,
          matchCount: 6,
        }),
      });
      const json = (await res.json()) as { data?: PhemeEmbeddingHit[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error en búsqueda');
      setSearchHits(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en búsqueda');
    } finally {
      setSearching(false);
    }
  }

  const informe = detalle?.analisis;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '24px 16px 96px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        color: '#111827',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          <Link href="/" style={{ color: '#2563eb' }}>
            Inicio
          </Link>
          {' / '}
          Pheme
        </p>
        <h1 style={{ margin: '8px 0 4px', fontSize: 28, fontWeight: 700 }}>Pheme</h1>
        <p style={{ margin: 0, color: '#4b5563', maxWidth: 640 }}>
          Asistente de reuniones: sube audio, transcribe con Whisper, genera informe
          estructurado y consulta por búsqueda semántica.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      <section
        style={{
          marginBottom: 28,
          padding: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Nueva grabación</h2>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Título</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej. Comité de obra — avance semanal"
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            marginBottom: 12,
          }}
        />
        <div>
          <input
            type="file"
            accept="audio/*,video/webm,.mp3,.m4a,.wav,.webm,.ogg,.flac"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onUpload(f);
              e.target.value = '';
            }}
          />
          {uploading ? (
            <span style={{ marginLeft: 12, fontSize: 13, color: '#6b7280' }}>Subiendo…</span>
          ) : null}
        </div>
      </section>

      <div
        className="pheme-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 340px) 1fr',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <style>{`
          @media (max-width: 800px) {
            .pheme-layout { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Reuniones</h2>
            <button
              type="button"
              onClick={() => void loadReuniones()}
              style={{
                border: '1px solid #d1d5db',
                background: '#fff',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Actualizar
            </button>
          </div>
          {loading ? (
            <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando…</p>
          ) : reuniones.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14 }}>Aún no hay reuniones.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {reuniones.map((r) => (
                <li key={r.id} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => void loadDetalle(r.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 10,
                      border:
                        selectedId === r.id ? '1px solid #2563eb' : '1px solid #e5e7eb',
                      background: selectedId === r.id ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.titulo}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      {r.estado} · {formatDate(r.created_at)}
                    </div>
                    {r.error_message ? (
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
                        {r.error_message}
                      </div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          {!detalle ? (
            <p style={{ color: '#6b7280' }}>Seleccione una reunión para ver el análisis.</p>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>{detalle.reunion.titulo}</h2>
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: '#f3f4f6',
                  }}
                >
                  {detalle.reunion.estado}
                </span>
                {detalle.reunion.estado !== 'listo' &&
                detalle.reunion.estado !== 'transcribiendo' &&
                detalle.reunion.estado !== 'analizando' &&
                detalle.reunion.estado !== 'indexando' ? (
                  <button
                    type="button"
                    disabled={processingId === detalle.reunion.id}
                    onClick={() => void onProcess(detalle.reunion.id)}
                    style={{
                      border: 'none',
                      background: '#111827',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {processingId === detalle.reunion.id
                      ? 'Procesando…'
                      : 'Procesar con Pheme'}
                  </button>
                ) : null}
              </div>

              {detalle.reunion.transcripcion_raw ? (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    Transcripción ({detalle.reunion.stt_provider}/{detalle.reunion.stt_model})
                  </summary>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      background: '#f9fafb',
                      padding: 12,
                      borderRadius: 8,
                      maxHeight: 280,
                      overflow: 'auto',
                    }}
                  >
                    {detalle.reunion.transcripcion_raw}
                  </pre>
                </details>
              ) : null}

              {informe ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Objetivo</h3>
                    <p style={{ margin: 0, fontSize: 14 }}>
                      {informe.resumen_ejecutivo.objetivo_principal}
                    </p>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Acuerdos</h3>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                      {(informe.resumen_ejecutivo.acuerdos_clave || []).map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Tareas</h3>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                      {(informe.resumen_ejecutivo.tareas_pendientes || []).map((t, i) => (
                        <li key={`${t.tarea}-${i}`}>
                          {t.tarea} — {t.responsable} ({t.fecha_limite})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Viabilidad</h3>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                      {(informe.matriz_viabilidad.ideas_analizadas || []).map((idea) => (
                        <li key={idea.idea} style={{ marginBottom: 8 }}>
                          <strong>{idea.idea}</strong> [{idea.viabilidad}]: {idea.dictamen}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Comunicación</h3>
                    <p style={{ margin: '0 0 6px', fontSize: 14 }}>
                      Tono: {informe.analisis_comunicacion.tono_general}
                    </p>
                    <p style={{ margin: 0, fontSize: 14 }}>
                      Seguimiento: {informe.analisis_comunicacion.recomendacion_seguimiento}
                    </p>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>Mapa mental (Mermaid)</h3>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: 12,
                        background: '#111827',
                        color: '#e5e7eb',
                        padding: 12,
                        borderRadius: 8,
                        overflow: 'auto',
                      }}
                    >
                      {informe.mapa_mental_mermaid}
                    </pre>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                    Embeddings indexados: {detalle.embeddings_count}
                  </p>
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontSize: 14 }}>
                  Sin análisis todavía. Pulse «Procesar con Pheme».
                </p>
              )}

              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Búsqueda semántica</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ej. acuerdos de presupuesto"
                    style={{
                      flex: '1 1 240px',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                    }}
                  />
                  <button
                    type="button"
                    disabled={searching}
                    onClick={() => void onSearch()}
                    style={{
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '10px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    {searching ? 'Buscando…' : 'Buscar'}
                  </button>
                </div>
                {searchHits.length > 0 ? (
                  <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13 }}>
                    {searchHits.map((h) => (
                      <li key={h.id} style={{ marginBottom: 10 }}>
                        <div style={{ color: '#6b7280' }}>
                          chunk {h.chunk_index} · similitud {h.similarity.toFixed(3)}
                        </div>
                        <div>{h.content.slice(0, 320)}{h.content.length > 320 ? '…' : ''}</div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
