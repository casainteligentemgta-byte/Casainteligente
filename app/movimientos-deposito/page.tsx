'use client';

import { useEffect, useState } from 'react';

/**
 * Mini App de Telegram: movimientos de la obra del depositario, solo lectura.
 * Se abre desde el botón del bot. No pide usuario: el servidor valida la firma de Telegram.
 */

type Linea = { descripcion: string; cantidad: number; unidad: string };
type Movimiento = {
  id: string;
  fecha: string;
  tipo: 'entrada' | 'salida' | 'pendiente';
  obra: string;
  titulo: string;
  estado: string;
  lineas: Linea[];
};
type Respuesta = {
  nombre?: string;
  obras?: Array<{ id: string; nombre: string }>;
  generado_at?: string;
  movimientos?: Movimiento[];
  error?: string;
};

type TelegramWebApp = { initData?: string; ready?: () => void; expand?: () => void };
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const ETIQUETA_TIPO: Record<Movimiento['tipo'], string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  pendiente: 'Pendiente',
};

const COLOR_TIPO: Record<Movimiento['tipo'], string> = {
  entrada: '#15803d',
  salida: '#b45309',
  pendiente: '#1d4ed8',
};

function cargarScriptTelegram(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) return resolve();
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export default function MovimientosDepositarioPage() {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [mensaje, setMensaje] = useState<string>('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      await cargarScriptTelegram();
      const wa = window.Telegram?.WebApp;
      wa?.ready?.();
      wa?.expand?.();
      const initData = wa?.initData ?? '';
      if (!initData) {
        if (!vivo) return;
        setMensaje('Abra esta página desde el botón «Ver movimientos» del bot de Telegram.');
        setEstado('error');
        return;
      }
      try {
        const res = await fetch('/api/telegram/movimientos-deposito', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
          cache: 'no-store',
        });
        const json = (await res.json()) as Respuesta;
        if (!vivo) return;
        if (!res.ok) {
          setMensaje(json.error ?? 'No se pudo cargar.');
          setEstado('error');
          return;
        }
        setDatos(json);
        setEstado('listo');
      } catch {
        if (!vivo) return;
        setMensaje('Sin conexión. Intente de nuevo.');
        setEstado('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '16px',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        boxSizing: 'border-box',
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Movimientos de obra</h1>
      {estado === 'listo' && datos && (
        <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 14 }}>
          {datos.nombre ? `${datos.nombre} · ` : ''}
          {(datos.obras ?? []).map((o) => o.nombre).join(', ')}
        </p>
      )}

      {estado === 'cargando' && <p style={{ color: '#475569' }}>Cargando…</p>}
      {estado === 'error' && (
        <p style={{ color: '#b91c1c', fontSize: 15 }}>{mensaje}</p>
      )}

      {estado === 'listo' && datos && (datos.movimientos ?? []).length === 0 && (
        <p style={{ color: '#475569' }}>No hay movimientos registrados todavía.</p>
      )}

      {estado === 'listo' &&
        (datos?.movimientos ?? []).map((m) => (
          <section
            key={m.id}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
              <strong style={{ color: COLOR_TIPO[m.tipo] }}>{ETIQUETA_TIPO[m.tipo]}</strong>
              <span style={{ color: '#64748b' }}>{m.fecha}</span>
            </div>
            <div style={{ fontSize: 15, marginTop: 4, overflowWrap: 'anywhere' }}>{m.titulo}</div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              {m.obra} · {m.estado}
            </div>
            {m.lineas.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14 }}>
                {m.lineas.map((l, i) => (
                  <li key={`${m.id}-${i}`} style={{ overflowWrap: 'anywhere' }}>
                    {l.descripcion} — <strong>{l.cantidad}</strong> {l.unidad}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </main>
  );
}
