'use client';
import { useState } from 'react';
import { MessageSquare, Link as LinkIcon, User, Briefcase, Phone, Sparkles, CheckCircle2, Copy, X, FileText, Mail, QrCode } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import { mensajeWhatsAppHvYEvaluacion } from '@/lib/talento/flujoHvEvaluacion';
import { leerProyectoRrhhContexto } from '@/lib/rrhh/proyectoRrhhContexto';

export default function GeneradorHojaVida({ onClose }: { onClose?: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('Albañil de 1ra');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ link: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInvitation = async () => {
    if (!name || !phone) {
      setError('Por favor completa el nombre y teléfono');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const proyectoModuloId = leerProyectoRrhhContexto();
      const res = await fetch(apiUrl('/api/talento/generar-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: name.trim(),
          whatsapp: phone.trim(),
          rol_buscado: cargo.trim(),
          rol_examen: 'obrero',
          proyecto_modulo_id: proyectoModuloId || undefined,
          public_base_url: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        onboarding_url?: string;
        error?: string;
        hint?: string;
      };
      if (!res.ok || !j.onboarding_url) {
        throw new Error([j.error, j.hint].filter(Boolean).join(' — ') || 'No se pudo generar el enlace');
      }

      const link = j.onboarding_url;
      const messageTemplate = mensajeWhatsAppHvYEvaluacion({
        nombre: name.trim(),
        cargo: cargo.trim(),
        link,
      });
      setSuccess({ link, message: messageTemplate });
    } catch (err: unknown) {
      console.error('Error saving invitation:', err);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError('Error al generar la invitación: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!success) return;
    navigator.clipboard.writeText(success.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const digits = phone.replace(/\D/g, '');
  const waPhone = digits.startsWith('0') ? `58${digits.slice(1)}` : digits.length <= 10 ? `58${digits}` : digits;
  const whatsappUrl = success
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(success.message)}`
    : '#';
  const emailSubject = `Invitación HV + evaluación - Casa Inteligente`;
  const emailBody = success
    ? `Hola ${name},\n\nTe invitamos a completar tu hoja de vida y tu evaluación (tipo de color y prueba de admisión) en un solo enlace:\n\n${success.link}\n\nAl finalizar la hoja de vida pasarás automáticamente a la evaluación.\n\nSaludos,\nEquipo de RRHH`
    : '';
  const emailUrl = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="glass p-6 rounded-[32px] border border-white/10 shadow-2xl max-w-md mx-auto fade-in overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <div className="p-2 bg-blue-500/20 rounded-xl">
            <FileText className="text-blue-500" size={20} />
          </div>
          Invitar hoja de vida
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {!success ? (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            El obrero recibe un solo enlace: completa la hoja de vida y, al terminar, continúa automáticamente con la
            evaluación (tipo de color y prueba de admisión).
          </p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5 mb-1.5">
              <User size={12} /> Nombre
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del candidato"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5 mb-1.5">
              <Phone size={12} /> WhatsApp
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0412..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5 mb-1.5">
              <Mail size={12} /> Correo (opcional)
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5 mb-1.5">
              <Briefcase size={12} /> Cargo / oficio
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="button"
            onClick={() => void generateInvitation()}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 text-sm font-bold text-white flex items-center justify-center gap-2"
          >
            {loading ? (
              'Generando…'
            ) : (
              <>
                <Sparkles size={16} /> Generar enlace de hoja de vida
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 size={18} /> Enlace listo para enviar
          </div>
          <p className="text-xs break-all text-zinc-300 bg-black/30 rounded-xl p-3 border border-white/10">{success.link}</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5"
            >
              <MessageSquare size={14} /> WhatsApp
            </a>
            <a
              href={email ? emailUrl : undefined}
              onClick={(e) => {
                if (!email) {
                  e.preventDefault();
                  setError('Agrega un correo para enviar por email');
                }
              }}
              className="rounded-xl bg-white/10 hover:bg-white/15 py-2.5 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5"
            >
              <Mail size={14} /> Email
            </a>
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5 hover:bg-white/5"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar mensaje'}
          </button>
          <a
            href={success.link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-center text-xs font-bold text-blue-200 flex items-center justify-center gap-1.5 hover:bg-blue-500/20"
          >
            <LinkIcon size={14} /> Abrir hoja de vida
          </a>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setError(null);
            }}
            className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Generar otra invitación
          </button>
          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600">
            <QrCode size={12} /> El candidato completa HV y evaluación en el mismo enlace
          </div>
        </div>
      )}
    </div>
  );
}
