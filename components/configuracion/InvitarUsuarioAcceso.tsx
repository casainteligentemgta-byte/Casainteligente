'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiUrl } from '@/lib/http/apiUrl';
import { ROLES_EMPRESA } from '@/lib/auth/permisosCatalogo';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const campoClase =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/15 disabled:opacity-50';

type EntidadOpcion = { id: string; nombre: string; rif: string | null };

type Props = {
  className?: string;
  entidadIdInicial?: string;
  onListo?: () => void;
};

export default function InvitarUsuarioAcceso({ className, entidadIdInicial, onListo }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<string>('comprador');
  const [entidadId, setEntidadId] = useState(entidadIdInicial ?? '');
  const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
  const [cargandoEntidades, setCargandoEntidades] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [cargo, setCargo] = useState('');
  const [conTelegram, setConTelegram] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [ultimoOk, setUltimoOk] = useState<string | null>(null);

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
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim.includes('@')) {
      toast.error('Indica un correo válido');
      return;
    }
    if (!rol) {
      toast.error('Indica el rol');
      return;
    }
    if (!entidadId) {
      toast.error('Selecciona una entidad / patrono');
      return;
    }
    if (conTelegram && !telegramChatId.trim()) {
      toast.error('Indica el Chat ID de Telegram o desactive acceso bot');
      return;
    }

    setEnviando(true);
    setUltimoOk(null);
    try {
      const res = await fetch(apiUrl('/api/auth/invitar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: emailTrim,
          nombre: nombre.trim() || undefined,
          rol,
          entidadId,
          invitar_web: true,
          telegram_chat_id: conTelegram ? telegramChatId.trim() : null,
          cargo: cargo.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
        ok?: boolean;
        mensaje?: string;
        invite_enviado?: boolean;
      };

      if (!res.ok) {
        toast.error(data.error || 'No se pudo invitar al usuario');
        return;
      }

      if (data.warning) toast.warning(data.warning);
      else toast.success(data.mensaje || 'Acceso configurado');

      setUltimoOk(data.mensaje || `Listo: ${emailTrim}`);
      setEmail('');
      setNombre('');
      setTelegramChatId('');
      setCargo('');
      onListo?.();
    } catch {
      toast.error('Error de red al invitar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card
      className={cn(
        'border-[#FF9500]/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950/90 to-[#0A0A0F] text-zinc-100 shadow-[0_0_48px_rgba(255,149,0,0.06)]',
        className,
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10">
            <UserPlus className="h-5 w-5 text-[#FFD60A]" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-lg font-bold tracking-tight text-white">
              Invitar usuario (web + bot)
            </CardTitle>
            <CardDescription className="mt-1 text-zinc-500">
              Envía invitación por correo (Supabase Auth), asigna rol por entidad y opcionalmente agrega
              el Chat ID a la whitelist de Telegram.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={(ev) => void handleSubmit(ev)}>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invitar-email" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Correo *
              </Label>
              <Input
                id="invitar-email"
                type="email"
                autoComplete="email"
                placeholder="usuario@dimaquinas.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
                className="h-11 border-white/10 bg-zinc-900/80 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitar-nombre" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Nombre
              </Label>
              <Input
                id="invitar-nombre"
                placeholder="Nombre para mostrar"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={enviando}
                className="h-11 border-white/10 bg-zinc-900/80 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitar-rol" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Rol *
              </Label>
              <select
                id="invitar-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                disabled={enviando}
                className={campoClase}
              >
                {ROLES_EMPRESA.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invitar-entidad" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Entidad / patrono *
              </Label>
              <select
                id="invitar-entidad"
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

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <input
                type="checkbox"
                checked={conTelegram}
                onChange={(e) => setConTelegram(e.target.checked)}
                className="rounded border-zinc-600"
              />
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              También acceso al bot Telegram
            </label>
            {conTelegram ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-zinc-500">Chat ID *</Label>
                  <Input
                    placeholder="Ej. 123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    disabled={enviando}
                    className="h-10 border-white/10 bg-zinc-900/80"
                  />
                  <p className="text-[10px] text-zinc-600">
                    El usuario puede obtenerlo con bots como @userinfobot.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-zinc-500">Cargo (opcional)</Label>
                  <Input
                    placeholder="Comprador, PM…"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    disabled={enviando}
                    className="h-10 border-white/10 bg-zinc-900/80"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {ultimoOk ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-3 py-2 text-sm text-emerald-100/90">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {ultimoOk}
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-200">
                <Mail className="mr-1 h-3 w-3" />
                Correo
              </Badge>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
          <Button
            type="submit"
            disabled={enviando || cargandoEntidades}
            className="min-w-[180px] rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 font-bold"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Invitando…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Enviar invitación
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
