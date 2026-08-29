'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConductorForm, { type ConductorFormValues } from '@/components/flota/conductores/ConductorForm';
import ConductorTable from '@/components/flota/conductores/ConductorTable';
import DocumentosConductor from '@/components/flota/conductores/DocumentosConductor';
import { FLOTA_INPUT } from '@/components/flota/FlotaShell';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { FlotaConductor, FlotaConductorDocumento } from '@/lib/flota/conductores';
import type { FlotaVehiculo } from '@/lib/flota/utils';

export default function FlotaConductoresPage() {
  const router = useRouter();
  const [items, setItems] = useState<FlotaConductor[]>([]);
  const [vehiculos, setVehiculos] = useState<FlotaVehiculo[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<FlotaConductor | null>(null);
  const [selected, setSelected] = useState<FlotaConductor | null>(null);
  const [docs, setDocs] = useState<FlotaConductorDocumento[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/flota/conductores${q ? `?q=${encodeURIComponent(q)}` : ''}`), {
      credentials: 'include',
    });
    if (res.status === 401) {
      router.push('/login?next=/flota/conductores');
      return;
    }
    const json = await parseFetchJson<{
      conductores?: FlotaConductor[];
      vehiculos?: FlotaVehiculo[];
      hint?: string;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(formatApiErrorBody(json));
    setItems(json.conductores ?? []);
    setVehiculos(json.vehiculos ?? []);
    setHint(json.hint ?? null);
  }, [q, router]);

  const loadDetalle = useCallback(
    async (id: string) => {
      const res = await fetch(apiUrl(`/api/flota/conductores/${id}`), { credentials: 'include' });
      const json = await parseFetchJson<{ conductor?: FlotaConductor }>(res);
      if (res.ok && json.conductor) {
        setSelected(json.conductor);
        setDocs(json.conductor.documentos ?? []);
      }
    },
    [],
  );

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [load]);

  async function guardar(values: ConductorFormValues) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(editing ? `/api/flota/conductores/${editing.id}` : '/api/flota/conductores'),
        {
          method: editing ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Conductores</h2>
        <p className="text-sm text-zinc-500">Licencias, certificados y unidad asignada.</p>
      </div>
      {hint ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <ConductorForm
        key={editing?.id ?? 'nuevo'}
        initial={editing}
        vehiculos={vehiculos}
        saving={saving}
        onSubmit={guardar}
        onCancel={editing ? () => setEditing(null) : undefined}
      />

      <input
        className={FLOTA_INPUT}
        placeholder="Buscar por nombre, cédula o placa…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <ConductorTable
        items={items}
        selectedId={selected?.id}
        onSelect={(c) => void loadDetalle(c.id)}
        onEdit={setEditing}
        onDelete={async (c) => {
          if (!confirm(`¿Eliminar a ${c.nombres} ${c.apellidos}?`)) return;
          const res = await fetch(apiUrl(`/api/flota/conductores/${c.id}`), {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!res.ok) {
            const json = await parseFetchJson<{ error?: string }>(res);
            setError(formatApiErrorBody(json));
            return;
          }
          if (selected?.id === c.id) {
            setSelected(null);
            setDocs([]);
          }
          await load();
        }}
      />

      {selected ? (
        <DocumentosConductor
          documentos={docs}
          saving={saving}
          onAdd={async (payload) => {
            setSaving(true);
            try {
              const res = await fetch(apiUrl(`/api/flota/conductores/${selected.id}`), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'agregar_documento', ...payload }),
              });
              const json = await parseFetchJson<{ error?: string }>(res);
              if (!res.ok) throw new Error(formatApiErrorBody(json));
              await loadDetalle(selected.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo agregar');
            } finally {
              setSaving(false);
            }
          }}
          onDelete={async (id) => {
            const res = await fetch(apiUrl(`/api/flota/conductores/${selected.id}`), {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accion: 'eliminar_documento', documento_id: id }),
            });
            if (res.ok) await loadDetalle(selected.id);
          }}
        />
      ) : (
        <p className="text-sm text-zinc-500">Seleccione un conductor para ver o cargar documentos.</p>
      )}
    </div>
  );
}
