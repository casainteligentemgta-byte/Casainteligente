import { useState, type CSSProperties, type FormEvent } from 'react';
import {
  CANALES_CONTACTO_CLIENTE,
  etiquetaCanalContacto,
  type CanalContactoCliente,
  type ContactoCliente,
} from '@/lib/clientes/contactosCliente';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

function fechaTxt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '—';
  return d.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' });
}

export default function HistorialContactosCliente({
  contactos,
  loading,
  error,
  card,
  onRegistrar,
  registrando,
}: {
  contactos: ContactoCliente[];
  loading: boolean;
  error: string | null;
  card: CSSProperties;
  onRegistrar: (input: { canal: CanalContactoCliente; nota: string }) => Promise<void>;
  registrando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [canal, setCanal] = useState<CanalContactoCliente>('whatsapp');
  const [nota, setNota] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onRegistrar({ canal, nota: nota.trim() });
    setNota('');
    setAbierto(false);
  }

  return (
    <div style={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--label-primary)' }}>
            Historial de WhatsApp
          </h2>
          <p className="mt-1 text-sm" style={{ color: tintaTexto(0.5) }}>
            Contactos con este cliente (WhatsApp, llamada u otra nota).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="rounded-full px-3 py-2 text-[13px] font-semibold"
          style={{
            border: '1px solid rgba(37,211,102,0.35)',
            background: 'rgba(37,211,102,0.12)',
            color: 'var(--tono-whatsapp, #25D366)',
          }}
        >
          Registrar contacto
        </button>
      </div>

      {abierto ? (
        <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
          <label className="block text-sm" style={{ color: tintaTexto(0.7) }}>
            Canal
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value as CanalContactoCliente)}
              className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
              style={{ background: 'var(--superficie)', borderColor: tinta(0.12), color: 'var(--label-primary)' }}
            >
              {CANALES_CONTACTO_CLIENTE.map((c) => (
                <option key={c} value={c}>
                  {etiquetaCanalContacto(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm" style={{ color: tintaTexto(0.7) }}>
            Nota (opcional)
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Ej: confirmó visita, pidió presupuesto…"
              className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
              style={{ background: 'var(--superficie)', borderColor: tinta(0.12), color: 'var(--label-primary)' }}
            />
          </label>
          <button
            type="submit"
            disabled={registrando}
            className="w-full rounded-2xl px-4 py-3 text-[15px] font-bold disabled:opacity-60"
            style={{ background: 'rgba(0,122,255,0.2)', color: 'var(--tono-azul)', border: '1px solid rgba(0,122,255,0.4)' }}
          >
            {registrando ? 'Guardando…' : 'Guardar contacto'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
          Cargando contactos…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : contactos.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: tintaTexto(0.5) }}>
          Todavía no hay contactos. Al pulsar WhatsApp se registra solo.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {contactos.map((c) => (
            <li
              key={c.id}
              className="rounded-xl p-3"
              style={{ border: `1px solid ${tinta(0.1)}`, background: tinta(0.03) }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--label-primary)' }}>
                {etiquetaCanalContacto(c.canal)} · {fechaTxt(c.fecha)}
              </p>
              {c.nota ? (
                <p className="mt-1 text-sm" style={{ color: tintaTexto(0.7) }}>
                  {c.nota}
                </p>
              ) : null}
              {c.usuario_nombre ? (
                <p className="mt-1 text-xs" style={{ color: tintaTexto(0.4) }}>
                  {c.usuario_nombre}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
