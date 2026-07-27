'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Loader2,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type Obligacion = {
  id: string;
  titulo: string;
  descripcion: string;
  base_legal: string | null;
  categoria: string;
  frecuencia: string;
  estado: string;
};

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

export default function BibliotecaLegalClient() {
  const [obligaciones, setObligaciones] = useState<Obligacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [baseLegal, setBaseLegal] = useState('');
  const [categoria, setCategoria] = useState('laboral');
  const [frecuencia, setFrecuencia] = useState('permanente');

  const supabase = createClient();

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ci_legal_obligaciones')
        .select('*')
        .eq('estado', 'activo')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error(error.message);
        return;
      }
      setObligaciones(data || []);
    } catch {
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function resetForm() {
    setEditId(null);
    setTitulo('');
    setDescripcion('');
    setBaseLegal('');
    setCategoria('laboral');
    setFrecuencia('permanente');
  }

  function editar(o: Obligacion) {
    setEditId(o.id);
    setTitulo(o.titulo);
    setDescripcion(o.descripcion);
    setBaseLegal(o.base_legal || '');
    setCategoria(o.categoria);
    setFrecuencia(o.frecuencia);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !descripcion.trim()) {
      toast.error('Indica un título y descripción');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase
          .from('ci_legal_obligaciones')
          .update({
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            base_legal: baseLegal.trim() || null,
            categoria,
            frecuencia,
          })
          .eq('id', editId);

        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Obligación actualizada');
      } else {
        const { error } = await supabase
          .from('ci_legal_obligaciones')
          .insert({
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            base_legal: baseLegal.trim() || null,
            categoria,
            frecuencia,
          });

        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Obligación agregada');
      }
      resetForm();
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  }

  async function desactivar(id: string) {
    if (!confirm('¿Desactivar esta obligación?')) return;
    const { error } = await supabase
      .from('ci_legal_obligaciones')
      .update({ estado: 'inactivo' })
      .eq('id', id);

    if (error) {
      toast.error(error.message || 'No se pudo desactivar');
      return;
    }
    toast.success('Obligación desactivada');
    void cargar();
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <BookOpen className="h-4 w-4" />
          Biblioteca · Obligaciones del Patrono
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Guía de Obligaciones</h2>
      </header>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="rounded-2xl border border-amber-500/20 bg-[#0c1018] p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-white">
            {editId ? 'Editar Obligación' : 'Agregar Nueva Obligación'}
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
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Título
            </label>
            <input
              className={campo}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Emisión de recibos de nómina"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Descripción / Requisito
            </label>
            <textarea
              className={campo}
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿Qué debe cumplir el patrono?"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Base Legal
            </label>
            <input
              className={campo}
              value={baseLegal}
              onChange={(e) => setBaseLegal(e.target.value)}
              placeholder="Ej. Art. 104 LOTTT"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Categoría
            </label>
            <select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="laboral">Laboral (LOTTT, etc.)</option>
              <option value="sso">Seguridad Social (IVSS, INCES, FAOV)</option>
              <option value="tributario">Tributario</option>
              <option value="mercantil">Mercantil</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Frecuencia de Auditoría
            </label>
            <select className={campo} value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
              <option value="permanente">Permanente / Continua</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
              <option value="ingreso">Al ingreso del trabajador</option>
              <option value="egreso">Al egreso del trabajador</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar Obligación'}
        </button>
      </form>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white">Obligaciones Registradas</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : obligaciones.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay obligaciones registradas aún.</p>
        ) : (
          <ul className="space-y-2">
            {obligaciones.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{o.titulo}</p>
                  <p className="mt-0.5 text-xs font-medium text-amber-200/80">
                    {o.base_legal} • {o.categoria.toUpperCase()} • Frecuencia: {o.frecuencia}
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-400 whitespace-pre-line">{o.descripcion}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editar(o)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void desactivar(o.id)}
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
    </div>
  );
}
