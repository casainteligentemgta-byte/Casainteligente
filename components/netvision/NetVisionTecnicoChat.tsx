'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Send, Wrench } from 'lucide-react'
import {
  TECNICO_HISTORIAL_MAX,
  TECNICO_PREGUNTA_MAX,
  TECNICO_PREGUNTA_MIN,
  type TecnicoTurno,
} from '@/lib/netvision/tecnicoContexto'

const EJEMPLOS = [
  '¿Cuántos W consume la H9c y qué adaptador PoE lleva?',
  '¿Qué switch UniFi necesito para 12 cámaras H3 3K?',
  'Pasos para restablecer de fábrica una C6N',
  '¿Qué diferencia hay entre la H4 Wi-Fi y la H4 PoE?',
]

type Mensaje = TecnicoTurno & { error?: boolean }

/** Chat con el técnico de dispositivos (IA). */
export default function NetVisionTecnicoChat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [pregunta, setPregunta] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, cargando])

  const preguntar = async (texto: string) => {
    const q = texto.trim()
    if (q.length < TECNICO_PREGUNTA_MIN || cargando) return
    const historial = mensajes
      .filter((m) => !m.error)
      .slice(-TECNICO_HISTORIAL_MAX)
      .map(({ role, text }) => ({ role, text }))
    setMensajes((prev) => [...prev, { role: 'user', text: q }])
    setPregunta('')
    setCargando(true)
    try {
      const res = await fetch('/api/netvision/tecnico', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: q, historial }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        respuesta?: string
        error?: string
      }
      if (!res.ok || !data.respuesta) {
        throw new Error(data.error || 'No se pudo consultar al técnico.')
      }
      setMensajes((prev) => [...prev, { role: 'assistant', text: data.respuesta! }])
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          role: 'assistant',
          error: true,
          text: err instanceof Error ? err.message : 'No se pudo consultar al técnico.',
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void preguntar(pregunta)
  }

  return (
    <section className="flex min-h-[60dvh] flex-col rounded-2xl border border-white/10 bg-black/40">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--nexus-cyan)] text-black">
          <Wrench className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white">Técnico de dispositivos</h1>
          <p className="text-[12px] text-[var(--nexus-text-muted)]">
            Cámaras, grabadores, PoE y redes. Responde con el catálogo de NetVision.
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {mensajes.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--nexus-text-muted)]">
              Pregunta por un modelo, un consumo, qué equipo usar o cómo hacer un ajuste. Por
              ejemplo:
            </p>
            <div className="flex flex-wrap gap-2">
              {EJEMPLOS.map((ej) => (
                <button
                  key={ej}
                  type="button"
                  data-nv-tecnico-ejemplo
                  onClick={() => void preguntar(ej)}
                  className="min-h-11 rounded-lg border border-white/15 px-3 py-2 text-left text-[13px] text-white hover:bg-white/10"
                >
                  {ej}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mensajes.map((m, i) => (
          <div
            key={i}
            data-nv-tecnico-msg={m.role}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <p
              className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[var(--nexus-cyan)] text-black'
                  : m.error
                    ? 'border border-amber-300/40 bg-amber-500/10 text-amber-100'
                    : 'border border-white/10 bg-white/[0.04] text-white'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}

        {cargando ? (
          <p className="text-[13px] text-[var(--nexus-text-muted)]">Consultando al técnico…</p>
        ) : null}
        <div ref={finRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-white/10 p-3">
        <label htmlFor="nv-tecnico-pregunta" className="sr-only">
          Pregunta para el técnico
        </label>
        <textarea
          id="nv-tecnico-pregunta"
          rows={2}
          maxLength={TECNICO_PREGUNTA_MAX}
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void preguntar(pregunta)
            }
          }}
          placeholder="Escribe tu pregunta…"
          className="min-h-11 flex-1 resize-none rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={cargando || pregunta.trim().length < TECNICO_PREGUNTA_MIN}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--nexus-cyan)] px-4 text-sm font-bold text-black disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          Enviar
        </button>
      </form>

      <p className="border-t border-white/10 px-4 py-2 text-[11px] text-[var(--nexus-text-dim)]">
        Respuestas generadas por IA. Verifica los datos críticos en la ficha del fabricante. También
        disponible en Telegram con <span className="font-semibold">/tecnico</span>.
      </p>
    </section>
  )
}
