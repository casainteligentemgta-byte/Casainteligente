'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { createClient } from '@/lib/supabase/client';
import {
  LEGAL_TIPOS_DOCUMENTO,
  aplicarVariablesPlantilla,
  type LegalPlantillaVariable,
} from '@/lib/legal/documentosCatalogo';
import {
  LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO,
  parseDocumentoEstructurado,
} from '@/lib/legal/documentoEstructurado';
import { etiquetaCliente } from '@/lib/clientes/etiquetaCliente';

type Plantilla = {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  descripcion: string | null;
  variables: LegalPlantillaVariable[] | null;
  cuerpo_markdown: string | null;
};

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

export default function DocumentoNuevoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      }
    >
      <DocumentoNuevoForm />
    </Suspense>
  );
}

function DocumentoNuevoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plantillaQuery = searchParams.get('plantilla')?.trim() || '';
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [entidades, setEntidades] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [plantillaId, setPlantillaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('contrato');
  
  const [contraparte, setContraparte] = useState('');
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState('');
  
  const [entidadSeleccionadaId, setEntidadSeleccionadaId] = useState('');
  const [empleadoSeleccionadoId, setEmpleadoSeleccionadoId] = useState('');
  const [nuevaEntidad, setNuevaEntidad] = useState({
    nombre: '',
    rif: '',
    domicilio: '',
    registro_mercantil: '',
    representante_legal: '',
    representante_cedula: '',
    representante_estado_civil: '',
    representante_profesion: '',
  });

  const [valores, setValores] = useState<Record<string, string>>({});
  const [jsonEstructurado, setJsonEstructurado] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const [resDoc, { data: resCli }, { data: resEnt }, { data: resEmp }] = await Promise.all([
          fetch(apiUrl('/api/legal/documentos'), {
            credentials: 'include',
            cache: 'no-store',
          }),
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase.from('ci_entidades').select('*').order('nombre', { ascending: true }),
          supabase.from('ci_empleados').select('id, nombre_completo, cedula, documento, cargo_convencion, rol_examen, fecha_ingreso').order('nombre_completo', { ascending: true }),
        ]);

        if (resCli) setClientes(resCli);
        if (resEnt) setEntidades(resEnt);
        if (resEmp) setEmpleados(resEmp);

        const data = (await resDoc.json()) as {
          plantillas?: Plantilla[];
          error?: string;
          hint?: string;
        };
        if (!resDoc.ok) {
          toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
          return;
        }
        const list = data.plantillas ?? [];
        setPlantillas(list);
        if (plantillaQuery && list.some((p) => p.id === plantillaQuery)) {
          setPlantillaId(plantillaQuery);
        }
      } catch {
        toast.error('Error de red');
      } finally {
        setLoading(false);
      }
    })();
  }, [plantillaQuery]);

  const plantilla = useMemo(
    () => plantillas.find((p) => p.id === plantillaId) ?? null,
    [plantillas, plantillaId],
  );

  const variables = (plantilla?.variables ?? []) as LegalPlantillaVariable[];

  useEffect(() => {
    if (!plantilla) return;
    setTitulo((t) => t || plantilla.titulo);
    setTipo(plantilla.tipo || 'contrato');
  }, [plantilla]);

  function handleSeleccionarCliente(id: string) {
    setClienteSeleccionadoId(id);
    const cliente = clientes.find((c) => String(c.id) === id);
    if (!cliente) {
      if (id === '') setContraparte('');
      return;
    }
    
    setContraparte(etiquetaCliente(cliente));

    setValores((prev) => {
      const next = { ...prev };
      variables.forEach((v) => {
        const key = v.key.toLowerCase();
        
        if (key.includes('nombre') || key.includes('razon_social') || key.includes('cliente')) {
          if (!next[v.key]) next[v.key] = cliente.nombre || cliente.razon_social || '';
        }
        if (key.includes('cedula') || key.includes('c_i') || key.includes('ci')) {
          if (!next[v.key]) next[v.key] = cliente.cedula || '';
        }
        if (key.includes('rif')) {
          if (!next[v.key]) next[v.key] = cliente.rif || '';
        }
        if (key.includes('direccion') || key.includes('domicilio')) {
          if (!next[v.key]) next[v.key] = cliente.direccion || '';
        }
        if (key.includes('telefono') || key.includes('movil') || key.includes('celular')) {
          if (!next[v.key]) next[v.key] = cliente.telefono || cliente.movil || '';
        }
        if (key.includes('email') || key.includes('correo')) {
          if (!next[v.key]) next[v.key] = cliente.email || '';
        }
        if (key.includes('representante') || key.includes('rep_legal')) {
          if (!next[v.key]) next[v.key] = cliente.representante_legal || '';
        }
        if (key.includes('nacionalidad')) {
          if (!next[v.key]) next[v.key] = cliente.nacionalidad || '';
        }
        if (key.includes('estado_civil') || key.includes('civil')) {
          if (!next[v.key]) next[v.key] = cliente.estado_civil || '';
        }
        if (key.includes('profesion') || key.includes('oficio')) {
          if (!next[v.key]) next[v.key] = cliente.profesion || '';
        }
      });
      return next;
    });
  }

  function handleSeleccionarEntidad(id: string) {
    setEntidadSeleccionadaId(id);
    if (id === 'nueva' || id === '') return;

    const entidad = entidades.find((e) => String(e.id) === id);
    if (!entidad) return;

    setValores((prev) => {
      const next = { ...prev };
      variables.forEach((v) => {
        const key = v.key.toLowerCase();
        
        if (key.includes('contratista_empresa') || key.includes('entidad_nombre')) {
          if (!next[v.key]) next[v.key] = entidad.nombre || '';
        }
        if (key.includes('contratista_rif') || key.includes('entidad_rif')) {
          if (!next[v.key]) next[v.key] = entidad.rif || '';
        }
        if (key.includes('contratista_domicilio') || key.includes('entidad_domicilio')) {
          if (!next[v.key]) next[v.key] = entidad.domicilio || '';
        }
        if (key.includes('contratista_registro') || key.includes('entidad_registro')) {
          if (!next[v.key]) next[v.key] = entidad.registro_mercantil || '';
        }
        if (key.includes('contratista_rep_nombre') || key.includes('entidad_rep_nombre')) {
          if (!next[v.key]) next[v.key] = entidad.representante_legal || '';
        }
        if (key.includes('contratista_rep_cedula') || key.includes('entidad_rep_cedula')) {
          if (!next[v.key]) next[v.key] = entidad.representante_cedula || '';
        }
        if (key.includes('contratista_rep_estado_civil') || key.includes('entidad_rep_estado_civil')) {
          if (!next[v.key]) next[v.key] = entidad.representante_estado_civil || '';
        }
        if (key.includes('contratista_rep_profesion') || key.includes('entidad_rep_profesion')) {
          if (!next[v.key]) next[v.key] = entidad.representante_profesion || '';
        }
      });
      return next;
    });
  }

  function handleSeleccionarEmpleado(id: string) {
    setEmpleadoSeleccionadoId(id);
    if (id === '') return;

    const emp = empleados.find((e) => String(e.id) === id);
    if (!emp) return;

    setValores((prev) => {
      const next = { ...prev };
      variables.forEach((v) => {
        const key = v.key.toLowerCase();
        
        if (key.includes('trabajador') || key.includes('empleado')) {
          if (key.includes('nombre')) {
            if (!next[v.key]) next[v.key] = emp.nombre_completo || '';
          }
          if (key.includes('cedula') || key.includes('c_i') || key.includes('ci_')) {
            if (!next[v.key]) next[v.key] = emp.cedula || emp.documento || '';
          }
          if (key.includes('cargo') || key.includes('puesto')) {
            if (!next[v.key]) next[v.key] = emp.cargo_convencion || emp.rol_examen || '';
          }
          if (key.includes('fecha_ingreso')) {
            if (!next[v.key]) next[v.key] = emp.fecha_ingreso ? emp.fecha_ingreso.split('T')[0] : '';
          }
        }
      });
      return next;
    });
  }

  // Sincronizar nueva entidad con los valores de la plantilla si el usuario está tipeando en los campos de "Nueva Entidad"
  useEffect(() => {
    if (entidadSeleccionadaId !== 'nueva') return;

    setValores((prev) => {
      const next = { ...prev };
      variables.forEach((v) => {
        const key = v.key.toLowerCase();
        if (key.includes('contratista_empresa') || key.includes('entidad_nombre')) next[v.key] = nuevaEntidad.nombre;
        if (key.includes('contratista_rif') || key.includes('entidad_rif')) next[v.key] = nuevaEntidad.rif;
        if (key.includes('contratista_domicilio') || key.includes('entidad_domicilio')) next[v.key] = nuevaEntidad.domicilio;
        if (key.includes('contratista_registro') || key.includes('entidad_registro')) next[v.key] = nuevaEntidad.registro_mercantil;
        if (key.includes('contratista_rep_nombre') || key.includes('entidad_rep_nombre')) next[v.key] = nuevaEntidad.representante_legal;
        if (key.includes('contratista_rep_cedula') || key.includes('entidad_rep_cedula')) next[v.key] = nuevaEntidad.representante_cedula;
        if (key.includes('contratista_rep_estado_civil') || key.includes('entidad_rep_estado_civil')) next[v.key] = nuevaEntidad.representante_estado_civil;
        if (key.includes('contratista_rep_profesion') || key.includes('entidad_rep_profesion')) next[v.key] = nuevaEntidad.representante_profesion;
      });
      return next;
    });
  }, [nuevaEntidad, entidadSeleccionadaId, variables]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() && !jsonEstructurado.trim()) {
      toast.error('Indica el título o pega un JSON estructurado');
      return;
    }
    setEnviando(true);
    try {
      let cuerpo_estructurado: unknown = null;
      if (jsonEstructurado.trim()) {
        try {
          const raw = JSON.parse(jsonEstructurado) as unknown;
          cuerpo_estructurado = parseDocumentoEstructurado(raw);
          if (!cuerpo_estructurado) {
            toast.error('JSON inválido: document_title + blocks');
            setEnviando(false);
            return;
          }
        } catch {
          toast.error('JSON estructurado inválido');
          setEnviando(false);
          return;
        }
      }

      // Guardar nueva entidad contratista si se solicitó
      if (entidadSeleccionadaId === 'nueva' && nuevaEntidad.nombre.trim()) {
        const supabase = createClient();
        const { error: errorEntidad } = await supabase.from('ci_entidades').insert({
          nombre: nuevaEntidad.nombre.trim(),
          rif: nuevaEntidad.rif.trim(),
          domicilio: nuevaEntidad.domicilio.trim(),
          registro_mercantil: nuevaEntidad.registro_mercantil.trim(),
          representante_legal: nuevaEntidad.representante_legal.trim(),
          representante_cedula: nuevaEntidad.representante_cedula.trim(),
          representante_estado_civil: nuevaEntidad.representante_estado_civil.trim(),
          representante_profesion: nuevaEntidad.representante_profesion.trim(),
        });
        if (errorEntidad) {
          toast.error('Error guardando la nueva entidad: ' + errorEntidad.message);
          // Opcional: permitir que continúe y guarde el documento igual
        } else {
          toast.success('Nueva entidad registrada exitosamente');
        }
      }

      const cuerpo = plantilla?.cuerpo_markdown
        ? aplicarVariablesPlantilla(plantilla.cuerpo_markdown, valores)
        : '';
      const res = await fetch(apiUrl('/api/legal/documentos'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim() || 'Documento',
          tipo,
          contraparte: contraparte.trim() || null,
          plantilla_id: plantillaId || null,
          variables_valores: valores,
          cuerpo_markdown: cuerpo,
          ...(cuerpo_estructurado ? { cuerpo_estructurado } : {}),
        }),
      });
      const data = (await res.json()) as {
        documento?: { id: string };
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      toast.success('Documento creado');
      router.push(`/legal/documentos/${data.documento!.id}`);
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-white">Nuevo documento</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Elige una plantilla (contrato, finiquito, poder, carta) y completa las
          variables. Luego podrás editar el texto completo.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-[#0c1018] p-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Plantilla
          <select
            className={campo}
            value={plantillaId}
            onChange={(e) => {
              setPlantillaId(e.target.value);
              setValores({});
            }}
          >
            <option value="">En blanco</option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo} ({p.tipo})
              </option>
            ))}
          </select>
        </label>
        {plantilla?.descripcion && (
          <p className="text-xs text-zinc-500">{plantilla.descripcion}</p>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Título
          <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tipo
          <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {LEGAL_TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Empresa Contratista (Emisor)
          <select
            className={campo}
            value={entidadSeleccionadaId}
            onChange={(e) => handleSeleccionarEntidad(e.target.value)}
          >
            <option value="">-- Seleccionar --</option>
            {entidades.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.nombre} {ent.rif ? `(${ent.rif})` : ''}
              </option>
            ))}
            <option value="nueva">+ Crear nueva entidad contratista</option>
          </select>
        </label>

        {entidadSeleccionadaId === 'nueva' && (
          <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
              Datos de la Nueva Entidad
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs text-zinc-400">
                Razón Social *
                <input
                  className={campo}
                  value={nuevaEntidad.nombre}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, nombre: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-zinc-400">
                RIF
                <input
                  className={campo}
                  value={nuevaEntidad.rif}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, rif: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-zinc-400 sm:col-span-2">
                Domicilio
                <input
                  className={campo}
                  value={nuevaEntidad.domicilio}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, domicilio: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-zinc-400 sm:col-span-2">
                Registro Mercantil
                <input
                  className={campo}
                  value={nuevaEntidad.registro_mercantil}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, registro_mercantil: e.target.value }))}
                  placeholder="Ej: Tomo X, Número Y del Registro Z..."
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Representante Legal
                <input
                  className={campo}
                  value={nuevaEntidad.representante_legal}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, representante_legal: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Cédula Representante
                <input
                  className={campo}
                  value={nuevaEntidad.representante_cedula}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, representante_cedula: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Estado Civil Representante
                <input
                  className={campo}
                  value={nuevaEntidad.representante_estado_civil}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, representante_estado_civil: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Profesión Representante
                <input
                  className={campo}
                  value={nuevaEntidad.representante_profesion}
                  onChange={(e) => setNuevaEntidad((prev) => ({ ...prev, representante_profesion: e.target.value }))}
                />
              </label>
            </div>
            <p className="text-[11px] text-amber-200/60">
              Al guardar el documento, esta entidad quedará registrada en el sistema y autocompletará las variables de contratista en la plantilla.
            </p>
          </div>
        )}

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Trabajador (Nómina)
          <select
            className={campo}
            value={empleadoSeleccionadoId}
            onChange={(e) => handleSeleccionarEmpleado(e.target.value)}
          >
            <option value="">-- Seleccionar o escribir manualmente abajo --</option>
            {empleados.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre_completo} {emp.cedula || emp.documento ? `(${emp.cedula || emp.documento})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Contraparte (Cliente CRM)
          <select
            className={campo}
            value={clienteSeleccionadoId}
            onChange={(e) => handleSeleccionarCliente(e.target.value)}
          >
            <option value="">-- Seleccionar o escribir manualmente --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetaCliente(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Nombre de Contraparte (Texto Libre)
          <input
            className={campo}
            value={contraparte}
            onChange={(e) => setContraparte(e.target.value)}
            placeholder="Si no está en la lista o quieres ajustarlo, escríbelo aquí"
          />
        </label>

        {variables.length > 0 && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/70">
              Variables de la plantilla
            </p>
            {variables.map((v) => {
              const isCombo = v.key === 'descuento_fase1' || v.key === 'porcentaje_inicial_fase1' || v.key === 'porcentaje_entrega_fase1' || v.key === 'fee_administracion_fase2';
              const isDatePart = v.key === 'fecha_firma_dia' || v.key === 'fecha_firma_mes' || v.key === 'fecha_firma_anio';
              const isDateFull = v.key === 'fecha_ingreso' || v.key === 'fecha_ultimo_dia' || v.key === 'fecha_emision';

              if (isDatePart) {
                // Ocultar los inputs individuales de la fecha, ya que mostraremos un solo calendario unificado al final de este bloque
                return null;
              }

              if (isDateFull) {
                return (
                  <label
                    key={v.key}
                    className="block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {v.label}
                    <input
                      type="date"
                      className={campo}
                      style={{ colorScheme: 'dark' }}
                      value={valores[v.key] ?? ''}
                      onChange={(e) =>
                        setValores((prev) => ({ ...prev, [v.key]: e.target.value }))
                      }
                    />
                  </label>
                );
              }

              if (isCombo) {
                return (
                  <ComboVariableInput
                    key={v.key}
                    v={v}
                    valor={valores[v.key] ?? ''}
                    onChange={(val) => setValores((prev) => ({ ...prev, [v.key]: val }))}
                  />
                );
              }

              return (
                <label
                  key={v.key}
                  className="block text-xs font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {v.label}
                  <input
                    className={campo}
                    value={valores[v.key] ?? ''}
                    onChange={(e) =>
                      setValores((prev) => ({ ...prev, [v.key]: e.target.value }))
                    }
                  />
                </label>
              );
            })}

            {/* Renderizar un único DatePicker si la plantilla incluye las variables de fecha_firma */}
            {(variables.some((v) => v.key === 'fecha_firma_dia' || v.key === 'fecha_firma_mes' || v.key === 'fecha_firma_anio')) && (
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Fecha de Firma
                <input
                  type="date"
                  className={campo}
                  style={{ colorScheme: 'dark' }}
                  onChange={(e) => {
                    const dateStr = e.target.value; // YYYY-MM-DD
                    if (!dateStr) {
                      setValores((prev) => ({ ...prev, fecha_firma_dia: '', fecha_firma_mes: '', fecha_firma_anio: '' }));
                      return;
                    }
                    
                    const [yyyy, mm, dd] = dateStr.split('-');
                    
                    const meses = [
                      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                    ];
                    
                    const mesNombre = meses[parseInt(mm, 10) - 1] || '';

                    setValores((prev) => ({
                      ...prev,
                      fecha_firma_dia: dd,
                      fecha_firma_mes: mesNombre,
                      fecha_firma_anio: yyyy,
                    }));
                  }}
                />
              </label>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/70">
              O JSON estructurado (bloques)
            </p>
            <button
              type="button"
              className="text-xs text-amber-300 hover:underline"
              onClick={() =>
                setJsonEstructurado(
                  JSON.stringify(LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO, null, 2),
                )
              }
            >
              Cargar ejemplo
            </button>
          </div>
          <textarea
            className={`${campo} min-h-[180px] font-mono text-[12px]`}
            placeholder='{"document_title":"...","blocks":[{"type":"title","content":"..."}]}'
            value={jsonEstructurado}
            onChange={(e) => setJsonEstructurado(e.target.value)}
            spellCheck={false}
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear borrador
        </button>
      </form>
    </div>
  );
}

function ComboVariableInput({
  v,
  valor,
  onChange,
}: {
  v: LegalPlantillaVariable;
  valor: string;
  onChange: (val: string) => void;
}) {
  const defaultModo = v.key === 'fee_administracion_fase2' ? 'porcentaje' : 'monto';
  
  const [modo, setModo] = useState<'monto' | 'porcentaje'>(
    valor.includes('%') || v.label.includes('%') || v.key.includes('porcentaje')
      ? 'porcentaje'
      : defaultModo
  );

  const displayValue = modo === 'porcentaje' ? valor.replace(/%/g, '').trim() : valor;

  function handleChangeMode(e: React.ChangeEvent<HTMLSelectElement>) {
    const newModo = e.target.value as 'monto' | 'porcentaje';
    setModo(newModo);
    const numRaw = valor.replace(/[%]/g, '').trim();
    if (newModo === 'porcentaje') {
      onChange(numRaw ? `${numRaw}%` : '');
    } else {
      onChange(numRaw);
    }
  }

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (modo === 'porcentaje') {
      onChange(val ? `${val}%` : '');
    } else {
      onChange(val);
    }
  }

  return (
    <div className="block">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {v.label}
      </label>
      <div className="flex gap-2">
        <select
          className="w-1/3 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40"
          value={modo}
          onChange={handleChangeMode}
        >
          <option value="monto">Cantidad</option>
          <option value="porcentaje">Porcentaje (%)</option>
        </select>
        <input
          className="w-2/3 rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40"
          value={displayValue}
          onChange={handleNumberChange}
          placeholder={modo === 'porcentaje' ? 'Ej. 10' : 'Ej. USD 1.500'}
        />
      </div>
    </div>
  );
}
