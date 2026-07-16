'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileCode,
  FileText,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { uploadProjectAsset } from '@/lib/supabase/project-media';
import SeccionTituloHover from '@/components/proyectos/SeccionTituloHover';

type EstatusPlano = 'revision' | 'aprobado_construccion' | 'obsoleto';

type PlanoRow = {
  id: string;
  codigo: string;
  nombre: string;
  version: number;
  estatus: EstatusPlano;
  fecha: string;
  pdfUrl: string | null;
  cadUrl: string | null;
};

type PlanoProps = {
  proyectoId: string;
  className?: string;
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function etiquetaEstatus(estatus: EstatusPlano): string {
  return estatus === 'aprobado_construccion'
    ? 'aprobado construcción'
    : estatus === 'obsoleto'
      ? 'obsoleto'
      : 'revisión';
}

export default function ControlPlanosObra({ proyectoId, className = '' }: PlanoProps) {
  const supabase = useMemo(() => createClient(), []);
  const [planos, setPlanos] = useState<PlanoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [version, setVersion] = useState('1');
  const [estatus, setEstatus] = useState<EstatusPlano>('revision');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [cadFile, setCadFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!proyectoId.trim()) {
      setPlanos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('ci_proyecto_archivos')
      .select(
        'id, titulo, codigo_plano, version_plano, estatus_plano, public_url, cad_public_url, created_at, updated_at',
      )
      .eq('proyecto_id', proyectoId)
      .eq('tipo', 'plano')
      .order('codigo_plano', { ascending: true })
      .order('version_plano', { ascending: false });

    if (error) {
      toast.error(`No se pudieron cargar los planos: ${error.message}`);
      setPlanos([]);
      setLoading(false);
      return;
    }

    const rows: PlanoRow[] = (data ?? []).map((r) => {
      const est = (r.estatus_plano as EstatusPlano) || 'revision';
      return {
        id: r.id,
        codigo: (r.codigo_plano as string)?.trim() || 'S/C',
        nombre: (r.titulo as string)?.trim() || 'Sin nombre',
        version: Number(r.version_plano ?? 1),
        estatus: est === 'aprobado_construccion' || est === 'obsoleto' ? est : 'revision',
        fecha: fmtFecha((r.updated_at as string) || (r.created_at as string)),
        pdfUrl: (r.public_url as string) || null,
        cadUrl: (r.cad_public_url as string) || null,
      };
    });
    setPlanos(rows);
    setLoading(false);
  }, [proyectoId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setCodigo('');
    setNombre('');
    setVersion('1');
    setEstatus('revision');
    setPdfFile(null);
    setCadFile(null);
  };

  const sugerirVersion = (cod: string) => {
    const c = cod.trim().toUpperCase();
    if (!c) return;
    const max = planos.filter((p) => p.codigo.toUpperCase() === c).reduce((m, p) => Math.max(m, p.version), 0);
    setVersion(String(max + 1));
  };

  const handleUpload = async () => {
    const cod = codigo.trim().toUpperCase();
    const nom = nombre.trim();
    if (!cod || !nom) {
      toast.error('Código y nombre del plano son obligatorios');
      return;
    }
    if (!pdfFile) {
      toast.error('Sube el PDF para obra');
      return;
    }

    setUploading(true);
    try {
      const pdfUp = await uploadProjectAsset(supabase, pdfFile, {
        proyectoId,
        category: 'plano',
        folderHint: `${cod}/pdf`,
      });
      if (pdfUp.error || !pdfUp.publicUrl) {
        throw new Error(pdfUp.error ?? 'No se pudo subir el PDF');
      }

      let cadBucket: string | null = null;
      let cadPath: string | null = null;
      let cadUrl: string | null = null;
      if (cadFile) {
        const cadUp = await uploadProjectAsset(supabase, cadFile, {
          proyectoId,
          category: 'plano',
          folderHint: `${cod}/cad`,
        });
        if (cadUp.error || !cadUp.publicUrl) {
          throw new Error(cadUp.error ?? 'No se pudo subir el archivo CAD');
        }
        cadBucket = cadUp.bucket;
        cadPath = cadUp.path;
        cadUrl = cadUp.publicUrl;
      }

      const ver = Math.max(1, Number(version) || 1);
      const { error: insErr } = await supabase.from('ci_proyecto_archivos').insert({
        proyecto_id: proyectoId,
        tipo: 'plano',
        titulo: nom,
        codigo_plano: cod,
        version_plano: ver,
        estatus_plano: estatus,
        storage_bucket: pdfUp.bucket,
        storage_path: pdfUp.path,
        public_url: pdfUp.publicUrl,
        mime_type: pdfFile.type || 'application/pdf',
        cad_storage_bucket: cadBucket,
        cad_storage_path: cadPath,
        cad_public_url: cadUrl,
        updated_at: new Date().toISOString(),
      });

      if (insErr) throw insErr;

      toast.success(`Plano ${cod} v${ver} registrado`);
      setUploadOpen(false);
      resetForm();
      void load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const panelSubir = (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => {
            setUploadOpen((v) => !v);
            if (uploadOpen) resetForm();
          }}
          className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors"
        >
          <UploadCloud className="h-3.5 w-3.5 text-[#007AFF]" />
          {uploadOpen ? 'Cancelar' : 'Subir nueva revisión'}
        </button>
      </div>
      {uploadOpen ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-300">Nueva revisión</p>
            <button
              type="button"
              onClick={() => {
                setUploadOpen(false);
                resetForm();
              }}
              className="text-zinc-500 hover:text-white"
              aria-label="Cerrar formulario"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              onBlur={() => sugerirVersion(codigo)}
              placeholder="Código (ARQ-01)"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
            />
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Versión"
              type="number"
              min={1}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
            />
          </div>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del plano"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none"
          />
          <select
            value={estatus}
            onChange={(e) => setEstatus(e.target.value as EstatusPlano)}
            style={{ colorScheme: 'dark' }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
          >
            <option value="revision">En revisión</option>
            <option value="aprobado_construccion">Aprobado para construcción</option>
            <option value="obsoleto">Obsoleto</option>
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] text-zinc-500 uppercase font-bold">PDF obra *</label>
            <label className="text-[10px] text-zinc-500 uppercase font-bold">CAD (opcional)</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white"
            />
            <input
              type="file"
              accept=".dwg,.dxf,.dwf,application/octet-stream"
              onChange={(e) => setCadFile(e.target.files?.[0] ?? null)}
              className="text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white"
            />
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => void handleUpload()}
            className="w-full bg-[#007AFF] hover:bg-[#0062CC] disabled:opacity-50 text-white font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar revisión'}
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={`bg-[#0A0A0F] border border-white/10 rounded-xl p-5 text-white w-full ${className}`.trim()}
    >
      <SeccionTituloHover
        titulo="Planos y especificaciones técnicas"
        tituloClassName="text-sky-300/90"
        hint="Pasa el cursor sobre el título para subir una revisión"
        descripcion="Control de versiones de ingeniería y arquitectura."
        panelOculto={panelSubir}
      >
      {loading ? (
        <p className="text-xs text-zinc-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando planos…
        </p>
      ) : planos.length === 0 ? (
        <p className="text-xs text-zinc-500">No hay planos registrados. Sube la primera revisión.</p>
      ) : (
        <div className="space-y-2">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-lg text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 font-mono font-bold shrink-0">
                  {plano.codigo}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-zinc-200 truncate">{plano.nombre}</div>
                  <div className="text-zinc-500 mt-0.5">
                    Versión {plano.version} · Actualizado el {plano.fecha}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium text-[10px] uppercase flex items-center gap-1 ${
                    plano.estatus === 'aprobado_construccion'
                      ? 'bg-emerald-500/10 text-[#34C759]'
                      : plano.estatus === 'obsoleto'
                        ? 'bg-zinc-500/10 text-zinc-400'
                        : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {plano.estatus === 'aprobado_construccion' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {etiquetaEstatus(plano.estatus)}
                </span>

                <div className="flex items-center gap-1.5">
                  {plano.cadUrl ? (
                    <a
                      href={plano.cadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
                      title="Descargar CAD"
                    >
                      <FileCode className="h-4 w-4 text-[#007AFF]" />
                    </a>
                  ) : (
                    <span
                      className="p-1.5 text-zinc-700"
                      title="Sin archivo CAD"
                    >
                      <FileCode className="h-4 w-4" />
                    </span>
                  )}
                  {plano.pdfUrl ? (
                    <a
                      href={plano.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
                      title="Ver PDF en obra"
                    >
                      <FileText className="h-4 w-4 text-red-400" />
                    </a>
                  ) : (
                    <span className="p-1.5 text-zinc-700" title="Sin PDF">
                      <FileText className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </SeccionTituloHover>
    </div>
  );
}
