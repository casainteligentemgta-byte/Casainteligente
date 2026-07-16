'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  FileText,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { LEGAL_TIPOS_DOCUMENTO } from '@/lib/legal/documentosCatalogo';

type Plantilla = {
  id: string;
  org_id: string | null;
  codigo: string;
  titulo: string;
  tipo: string;
  categoria: string;
  descripcion: string | null;
  activo: boolean;
  archivo_nombre?: string | null;
  archivo_mime?: string | null;
  cuerpo_markdown?: string | null;
  variables?: Array<{ key: string; label: string }> | null;
  updated_at?: string;
};

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

export default function FormatosLegalClient() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState('contrato');
  const [categoria, setCategoria] = useState('general');
  const [descripcion, setDescripcion] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/legal/plantillas?inactivas=1'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        plantillas?: Plantilla[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      setPlantillas(data.plantillas ?? []);
    } catch {
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const propias = useMemo(
    () => plantillas.filter((p) => p.org_id != null && p.activo),
    [plantillas],
  );
  const globales = useMemo(
    () => plantillas.filter((p) => p.org_id == null && p.activo),
    [plantillas],
  );

  function resetForm() {
    setEditId(null);
    setTitulo('');
    setCodigo('');
    setTipo('contrato');
    setCategoria('general');
    setDescripcion('');
    setCuerpo('');
    setFile(null);
  }

  function editar(p: Plantilla) {
    if (!p.org_id) {
      toast.message('Los formatos globales del sistema no se editan aquí.');
      return;
    }
    setEditId(p.id);
    setTitulo(p.titulo);
    setCodigo(p.codigo);
    setTipo(p.tipo || 'contrato');
    setCategoria(p.categoria || 'general');
    setDescripcion(p.descripcion || '');
    setCuerpo(p.cuerpo_markdown || '');
    setFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() && !file) {
      toast.error('Indica un título o sube un archivo');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const res = await fetch(apiUrl(`/api/legal/plantillas/${editId}`), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: titulo.trim(),
            codigo: codigo.trim() || undefined,
            tipo,
            categoria,
            descripcion: descripcion.trim(),
            cuerpo_markdown: cuerpo,
          }),
        });
        const data = (await res.json()) as { error?: string; hint?: string };
        if (!res.ok) {
          toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
          return;
        }
        toast.success('Formato actualizado');
        resetForm();
        void cargar();
        return;
      }

      if (file) {
        const fd = new FormData();
        fd.set('file', file);
        if (titulo.trim()) fd.set('titulo', titulo.trim());
        if (codigo.trim()) fd.set('codigo', codigo.trim());
        fd.set('tipo', tipo);
        fd.set('categoria', categoria);
        if (descripcion.trim()) fd.set('descripcion', descripcion.trim());
        if (cuerpo.trim()) fd.set('cuerpo_markdown', cuerpo.trim());

        const res = await fetch(apiUrl('/api/legal/plantillas/upload'), {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const data = (await res.json()) as {
          error?: string;
          hint?: string;
          warning?: string;
          extraido_con_ia?: boolean;
        };
        if (!res.ok) {
          toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
          return;
        }
        toast.success(
          data.extraido_con_ia
            ? 'Formato subido y texto extraído con IA'
            : 'Formato subido correctamente',
        );
        if (data.warning) toast.message(data.warning);
        resetForm();
        void cargar();
        return;
      }

      if (!cuerpo.trim()) {
        toast.error('Pega el cuerpo en Markdown o sube un archivo');
        return;
      }

      const res = await fetch(apiUrl('/api/legal/plantillas'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          codigo: codigo.trim() || undefined,
          tipo,
          categoria,
          descripcion: descripcion.trim(),
          cuerpo_markdown: cuerpo,
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      toast.success('Formato creado');
      resetForm();
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  async function desactivar(id: string) {
    if (!confirm('¿Desactivar este formato?')) return;
    const res = await fetch(apiUrl(`/api/legal/plantillas/${id}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error || 'No se pudo desactivar');
      return;
    }
    toast.success('Formato desactivado');
    void cargar();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <FileUp className="h-4 w-4" />
          Formatos · plantillas
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Formatos de documentos</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Sube plantillas (MD, TXT, PDF, DOCX) o pega Markdown con variables{' '}
          <code className="text-amber-200/90">{'{{nombre}}'}</code>. Luego úsalas en{' '}
          <Link href="/legal/documentos/nuevo" className="text-amber-300 underline-offset-2 hover:underline">
            Nuevo documento
          </Link>
          .
        </p>
      </header>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="rounded-2xl border border-amber-500/20 bg-[#0c1018] p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-white">
            {editId ? 'Editar formato' : 'Subir / crear formato'}
          </h3>
          {editId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Título
            </label>
            <input
              className={campo}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Contrato de arrendamiento"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Código (opcional)
            </label>
            <input
              className={campo}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="contrato_arrendamiento_ve"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Tipo
            </label>
            <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {LEGAL_TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Categoría
            </label>
            <input
              className={campo}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="laboral / civil / mercantil…"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Descripción
          </label>
          <input
            className={campo}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Uso del formato"
          />
        </div>

        {!editId ? (
          <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
              <Upload className="h-8 w-8 text-amber-300/80" />
              <span className="text-sm font-semibold text-amber-100">
                {file ? file.name : 'Seleccionar archivo de formato'}
              </span>
              <span className="text-xs text-zinc-500">MD, TXT, HTML, PDF o DOCX · máx. 15 MB</span>
              <input
                type="file"
                accept=".md,.txt,.html,.htm,.pdf,.doc,.docx,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        ) : null}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Cuerpo Markdown {file && !editId ? '(opcional — si vacío, se extrae del archivo)' : ''}
          </label>
          <textarea
            className={`${campo} min-h-[180px] font-mono text-xs`}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder={'# Título\n\nEntre {{contraparte_nombre}} y…'}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Guardar formato'}
        </button>
      </form>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white">Tus formatos</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : propias.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no has subido formatos propios.</p>
        ) : (
          <ul className="space-y-2">
            {propias.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{p.titulo}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {p.codigo} · {p.tipo}
                    {p.archivo_nombre ? ` · ${p.archivo_nombre}` : ''}
                    {(p.variables?.length ?? 0) > 0
                      ? ` · ${p.variables!.length} variable(s)`
                      : ''}
                  </p>
                  {p.descripcion ? (
                    <p className="mt-1 text-xs text-zinc-400">{p.descripcion}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/legal/documentos/nuevo?plantilla=${p.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Usar
                  </Link>
                  <button
                    type="button"
                    onClick={() => editar(p)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void desactivar(p.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white">Formatos del sistema</h3>
        <p className="text-xs text-zinc-500">
          Plantillas globales precargadas (solo lectura). Puedes usarlas al crear documentos.
        </p>
        {globales.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin formatos globales activos.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {globales.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <p className="font-semibold text-zinc-200">{p.titulo}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {p.codigo} · {p.tipo}
                </p>
                <Link
                  href={`/legal/documentos/nuevo?plantilla=${p.id}`}
                  className="mt-2 inline-block text-xs font-semibold text-amber-300 hover:underline"
                >
                  Usar plantilla →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
