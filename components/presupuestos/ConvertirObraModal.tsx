'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SELECT_NOMBRE_ENTIDAD, conNombreEntidad } from '@/lib/entidades/nombreEntidad';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

export default function ConvertirObraModal({
  open,
  budgetId,
  nombreSugerido,
  onClose,
  onCreada,
}: {
  open: boolean;
  budgetId: string | null;
  nombreSugerido: string;
  onClose: () => void;
  onCreada: (opts: { proyectoId: string; nombre: string; yaExistia: boolean }) => void;
}) {
  const [entidades, setEntidades] = useState<Array<{ id: string; nombre: string }>>([]);
  const [entidadId, setEntidadId] = useState('');
  const [nombre, setNombre] = useState(nombreSugerido);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(nombreSugerido);
    setEntidadId('');
    setError(null);
    const supabase = createClient();
    void supabase
      .from('ci_entidades')
      .select(SELECT_NOMBRE_ENTIDAD)
      .then(({ data, error: e }) => {
        if (e) {
          setError(e.message);
          setEntidades([]);
          return;
        }
        setEntidades(conNombreEntidad(data).map((r) => ({ id: String(r.id), nombre: r.nombre })));
      });
  }, [open, nombreSugerido]);

  if (!open || !budgetId) return null;

  async function convertir() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/budgets/${budgetId}/convertir-obra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entidad_id: entidadId, nombre }),
      });
      const body = (await res.json()) as {
        error?: string;
        proyectoId?: string;
        nombre?: string;
        yaExistia?: boolean;
      };
      if (!res.ok) {
        setError(body.error || 'No se pudo crear la obra.');
        return;
      }
      onCreada({
        proyectoId: String(body.proyectoId),
        nombre: String(body.nombre ?? nombre),
        yaExistia: Boolean(body.yaExistia),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la obra.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="convertir-obra-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--superficie-alta, #fff)',
          borderRadius: 16,
          padding: 20,
          boxShadow: 'var(--sombra-tarjeta-alta)',
        }}
      >
        <h2 id="convertir-obra-titulo" style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>
          Convertir en obra
        </h2>
        <p style={{ fontSize: 13, color: tintaTexto(0.7), margin: '0 0 16px' }}>
          Se crea un proyecto con este presupuesto vinculado. El almacén de la obra se abre
          automáticamente.
        </p>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6, color: tintaTexto(0.55) }}>
          Entidad
        </label>
        <select
          value={entidadId}
          onChange={(e) => setEntidadId(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${tinta(0.12)}`,
            background: tinta(0.04),
            color: 'var(--label-primary)',
          }}
        >
          <option value="">Elige la entidad que ejecuta la obra</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6, color: tintaTexto(0.55) }}>
          Nombre de la obra
        </label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${tinta(0.12)}`,
            background: tinta(0.04),
            color: 'var(--label-primary)',
          }}
        />
        {error ? (
          <p style={{ color: 'var(--tono-rojo)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: tinta(0.08), fontWeight: 700 }}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={cargando || !entidadId.trim() || !nombre.trim()}
            onClick={() => void convertir()}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#007AFF',
              color: '#fff',
              fontWeight: 700,
              opacity: cargando ? 0.7 : 1,
            }}
          >
            {cargando ? 'Creando…' : 'Crear obra'}
          </button>
        </div>
      </div>
    </div>
  );
}
