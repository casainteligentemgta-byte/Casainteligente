'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiUrl } from '@/lib/http/apiUrl';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const ROLES_SUGERIDOS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'pm_obra', label: 'Project manager / coordinador' },
  { value: 'contador', label: 'Contador / contabilidad' },
  { value: 'comprador', label: 'Comprador / procura' },
  { value: 'almacen_central', label: 'Almacén central' },
  { value: 'rrhh', label: 'RRHH' },
  { value: 'solo_lectura', label: 'Solo lectura' },
] as const;

const campoClase =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/15 disabled:opacity-50';

type EntidadOpcion = { id: string; nombre: string; rif: string | null };

type Props = {
  className?: string;
  /** Preselecciona entidad al abrir (p. ej. desde fila de patrono). */
  entidadIdInicial?: string;
  onAsignado?: (payload: { usuario_id: string; email: string; registro: unknown }) => void;
};

export default function AsignarRolUsuario({ className, entidadIdInicial, onAsignado }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<string>(ROLES_SUGERIDOS[0].value);
  const [rolPersonalizado, setRolPersonalizado] = useState('');
  const [entidadId, setEntidadId] = useState(entidadIdInicial ?? '');
  const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
  const [cargandoEntidades, setCargandoEntidades] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [ultimoOk, setUltimoOk] = useState<{ email: string; rol: string } | null>(null);

  const rolEfectivo = rol === '__otro__' ? rolPersonalizado.trim() : rol;

  const cargarEntidades = useCallback(async () => {
    setCargandoEntidades(true);
    const { data, error } = await supabase
      .from('ci_entidades')
      .select('id,nombre,rif')
      .order('nombre', { ascending: true });

    if (error) {
      toast.error(error.message ?? 'No se pudieron cargar las entidades');
      setEntidades([]);
    } else {
      setEntidades((data ?? []) as EntidadOpcion[]);
    }
    setCargandoEntidades(false);
  }, [supabase]);

  useEffect(() => {
    void cargarEntidades();
  }, [cargarEntidades]);

  useEffect(() => {
    if (entidadIdInicial) setEntidadId(entidadIdInicial);
  }, [entidadIdInicial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailTrim = email.trim();
    if (!emailTrim) {
      toast.error('Indica el correo del usuario');
      return;
    }
    if (!rolEfectivo) {
      toast.error('Indica el rol');
      return;
    }
    if (!entidadId) {
      toast.error('Selecciona una entidad / patrono');
      return;
    }

    setEnviando(true);
    setUltimoOk(null);
    try {
      const res = await fetch(apiUrl('/api/usuarios-roles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: emailTrim,
          rol: rolEfectivo,
          entidadId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        ok?: boolean;
        usuario_id?: string;
        email?: string;
        registro?: unknown;
      };

      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'No se pudo asignar el rol');
        return;
      }

      setUltimoOk({ email: data.email ?? emailTrim, rol: rolEfectivo });
      toast.success('Rol asignado correctamente');
      onAsignado?.({
        usuario_id: data.usuario_id ?? '',
        email: data.email ?? emailTrim,
        registro: data.registro,
      });
      setEmail('');
    } catch {
      toast.error('Error de red al asignar el rol');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card
      className={cn(
        'border-[#FF9500]/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950/90 to-[#0A0A0F] text-zinc-100 shadow-[0_0_48px_rgba(255,149,0,0.06)] backdrop-blur-xl',
        className,
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10">
            <UserCog className="h-5 w-5 text-[#FFD60A]" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-white">Asignar rol a usuario</CardTitle>
            <CardDescription className="mt-1 text-zinc-500">
              Vincula un correo de Supabase Auth con un rol dentro de una entidad patrono. Requiere sesión activa.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={(ev) => void handleSubmit(ev)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asignar-rol-email" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Correo del usuario
            </Label>
            <Input
              id="asignar-rol-email"
              type="email"
              autoComplete="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
              className="h-11 border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-[#FF9500]/40"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="asignar-rol-rol" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Rol
              </Label>
              <select
                id="asignar-rol-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                disabled={enviando}
                className={campoClase}
              >
                {ROLES_SUGERIDOS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
                <option value="__otro__">Otro (personalizado)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="asignar-rol-entidad"
                className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
              >
                Entidad / patrono
              </Label>
              <select
                id="asignar-rol-entidad"
                value={entidadId}
                onChange={(e) => setEntidadId(e.target.value)}
                disabled={enviando || cargandoEntidades}
                className={campoClase}
              >
                <option value="">{cargandoEntidades ? 'Cargando…' : 'Seleccionar entidad'}</option>
                {entidades.map((en) => (
                  <option key={en.id} value={en.id}>
                    {en.nombre}
                    {en.rif ? ` · ${en.rif}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rol === '__otro__' ? (
            <div className="space-y-2">
              <Label
                htmlFor="asignar-rol-custom"
                className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
              >
                Nombre del rol personalizado
              </Label>
              <Input
                id="asignar-rol-custom"
                value={rolPersonalizado}
                onChange={(e) => setRolPersonalizado(e.target.value)}
                placeholder="ej. supervisor_obra"
                disabled={enviando}
                className="h-10 border-white/10 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-[#FF9500]/40"
              />
            </div>
          ) : null}

          {ultimoOk ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-3 py-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
              <span className="text-emerald-100/90">
                Asignado: <strong className="font-semibold">{ultimoOk.email}</strong>
              </span>
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15">
                {ultimoOk.rol}
              </Badge>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
          <Button
            type="submit"
            variant="elitePrimary"
            disabled={enviando || cargandoEntidades}
            className="min-w-[160px] rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 font-bold shadow-lg shadow-orange-900/20 hover:opacity-95"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Asignar rol'
            )}
          </Button>
          <Button
            type="button"
            variant="elite"
            disabled={enviando}
            onClick={() => {
              setEmail('');
              setRol(ROLES_SUGERIDOS[0].value);
              setRolPersonalizado('');
              setUltimoOk(null);
            }}
            className="rounded-xl border-white/15 text-zinc-300"
          >
            Limpiar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
