'use client';
import { useState } from 'react';
import { MessageSquare, Link as LinkIcon, User, Briefcase, Phone, Sparkles, CheckCircle2, Copy, X, FileText, Mail, QrCode } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
    const token = `hv_${Math.random().toString(36).substring(2, 11)}`;
    const link = `${window.location.origin}/onboarding/hoja-de-vida/${token}`;
    const messageTemplate = `¡Hola ${name}! 👋 Te saluda el equipo de Reclutamiento de Casa Inteligente. Te invitamos a completar tu Hoja de Vida oficial para el cargo de ${cargo} aquí: ${link}`;

    try {
        const supabase = createClient();
        // El estado debe ser 'prospecto_invitado' según el CHECK constraint de la base de datos
        const { error: insertError } = await supabase.from('ci_empleados').insert({
            nombres: name,
            nombre_completo: name,
            celular: phone,
            telefono: phone,
            email: email,
            cargo,
            rol_buscado: cargo,
            token,
            token_registro: token,
            estado_proceso: 'prospecto_invitado',
            fecha_invitacion: new Date().toISOString()
        });

        if (insertError) throw insertError;

        setSuccess({ link, message: messageTemplate });
    } catch (err: any) {
        console.error('Error saving invitation:', err);
        setError('Error al generar la invitación: ' + (err.message || 'Error desconocido'));
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

  // Preparar URLs para botones
  const whatsappUrl = success ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(success.message)}` : '#';
  const emailSubject = `Invitación a Proceso de Selección - Casa Inteligente`;
  const emailBody = success ? `Hola ${name},\n\nTe invitamos a completar tu Hoja de Vida oficial para el cargo de ${cargo} en el siguiente enlace:\n\n${success.link}\n\nSaludos,\nEquipo de RRHH` : '';
  const emailUrl = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="glass p-6 rounded-[32px] border border-white/10 shadow-2xl max-w-md mx-auto fade-in overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-xl">
                <FileText className="text-blue-500" size={20} /> 
            </div>
            Generar Invitación
        </h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>
      
      {!success ? (
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-shake">
                <X size={14} /> {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1 block">Candidato</label>
            <div className="relative group">
                <User className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Nombre Completo"
                    value={name}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-11 py-3.5 text-white outline-none focus:border-blue-500 transition-all text-sm"
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1 block">WhatsApp (con código de país)</label>
                <div className="relative group">
                    <Phone className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Ej: 584120000000"
                        value={phone}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-11 py-3.5 text-white outline-none focus:border-blue-500 transition-all text-sm"
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1 block">Email (Opcional)</label>
                <div className="relative group">
                    <Mail className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                        type="email" 
                        placeholder="correo@ejemplo.com"
                        value={email}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-11 py-3.5 text-white outline-none focus:border-blue-500 transition-all text-sm"
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1 block">Cargo</label>
            <div className="relative group">
                <Briefcase className="absolute left-3.5 top-3.5 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                <select 
                    value={cargo}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-11 py-3.5 text-white outline-none focus:border-blue-500 transition-all text-sm appearance-none cursor-pointer"
                    onChange={(e) => setCargo(e.target.value)}
                >
                    <option value="Albañil de 1ra" className="bg-[#1C1C1E]">Albañil de 1ra</option>
                    <option value="Electricista" className="bg-[#1C1C1E]">Electricista</option>
                    <option value="Plomero" className="bg-[#1C1C1E]">Plomero</option>
                    <option value="Ayudante" className="bg-[#1C1C1E]">Ayudante</option>
                    <option value="Supervisor" className="bg-[#1C1C1E]">Supervisor</option>
                    <option value="Vendedor" className="bg-[#1C1C1E]">Vendedor</option>
                    <option value="Administrador" className="bg-[#1C1C1E]">Administrador</option>
                </select>
            </div>
          </div>

          <button 
            onClick={generateInvitation}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-95 shadow-xl shadow-blue-600/20 mt-4 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    <Sparkles size={20} />
                    Generar Acceso
                </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6 slide-up">
            <div className="flex flex-col items-center">
                <a 
                    href={success.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-4 bg-white rounded-3xl shadow-2xl mb-4 border-4 border-blue-500/20 hover:scale-105 transition-transform cursor-pointer block"
                    title="Click para abrir enlace"
                >
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(success.link)}`} 
                        alt="QR Code"
                        className="w-[140px] h-[140px]"
                    />
                </a>
                <div className="text-center">
                    <h3 className="text-white font-black text-lg">¡Acceso Listo!</h3>
                    <p className="text-gray-500 text-xs mt-1">Escanea el QR o usa los botones de abajo</p>
                </div>
            </div>

            <div className="flex gap-2">
                <a 
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-[2] bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#25D366]/20 no-underline"
                >
                    <MessageSquare size={20} />
                    WhatsApp
                </a>
                <a 
                    href={emailUrl}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all border border-white/10 active:scale-95 no-underline"
                >
                    <Mail size={20} />
                    Email
                </a>
            </div>

            <button 
                onClick={copyToClipboard}
                className="w-full bg-white/5 text-gray-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-sm border border-white/5"
            >
                {copied ? <CheckCircle2 className="text-green-500" size={18} /> : <Copy size={18} />}
                {copied ? '¡Copiado!' : 'Copiar Mensaje'}
            </button>

            <button 
                onClick={() => { setSuccess(null); setName(''); setPhone(''); setError(null); }}
                className="w-full text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] py-2 hover:text-white transition-colors"
            >
                Generar Nueva Invitación
            </button>
        </div>
      )}
    </div>
  );
}

