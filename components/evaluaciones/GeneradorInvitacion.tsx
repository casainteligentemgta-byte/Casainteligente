'use client';
import { useState } from 'react';
import { MessageSquare, Link as LinkIcon, User, Briefcase, Phone, Sparkles, CheckCircle2, Copy, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function GeneradorInvitacion({ onClose }: { onClose?: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cargo, setCargo] = useState('Albañil de 1ra');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ link: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInvitation = async () => {
    if (!name || !phone) {
        alert('Por favor completa el nombre y teléfono');
        return;
    }
    
    setLoading(true);
    const token = `tk_${Math.random().toString(36).substring(2, 11)}`;
    const link = `${window.location.origin}/onboarding/${token}`;
    const messageTemplate = `¡Hola ${name}! 👋 Te saluda el equipo de Casa Inteligente. Te invitamos a postularte para el cargo de ${cargo}. Por favor, completa tu Hoja de Vida y evaluación inicial aquí: ${link}`;

    const supabase = createClient();
    const { error } = await supabase.from('ci_prospectos').insert({
        nombres: name,
        celular: phone,
        cargo,
        token,
        estado: 'invitado',
        fecha_invitacion: new Date().toISOString()
    });

    if (error) {
        console.error('Error saving invitation:', error);
        alert('Error al generar la invitación: ' + error.message);
        setLoading(false);
        return;
    }

    setSuccess({ link, message: messageTemplate });
    setLoading(false);
  };

  const sendWhatsApp = () => {
    if (!success) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(success.message)}`;
    window.open(url, '_blank');
  };

  const copyToClipboard = () => {
    if (!success) return;
    navigator.clipboard.writeText(success.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass p-6 rounded-3xl border border-white/10 shadow-2xl max-w-md mx-auto fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="text-orange-500" size={24} /> 
          Invitar Candidato
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
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Nombre Completo</label>
            <div className="relative">
                <User className="absolute left-3 top-3.5 text-gray-500" size={18} />
                <input 
                type="text" 
                placeholder="Juan Pérez"
                value={name}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-10 py-3 text-white outline-none focus:border-orange-500 transition-all text-sm"
                onChange={(e) => setName(e.target.value)}
                />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">WhatsApp (con código)</label>
            <div className="relative">
                <Phone className="absolute left-3 top-3.5 text-gray-500" size={18} />
                <input 
                type="text" 
                placeholder="584120000000"
                value={phone}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-10 py-3 text-white outline-none focus:border-orange-500 transition-all text-sm"
                onChange={(e) => setPhone(e.target.value)}
                />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Cargo a Postular</label>
            <div className="relative">
                <Briefcase className="absolute left-3 top-3.5 text-gray-500" size={18} />
                <select 
                    value={cargo}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-10 py-3 text-white outline-none focus:border-orange-500 transition-all text-sm appearance-none"
                    onChange={(e) => setCargo(e.target.value)}
                >
                    <option value="Albañil de 1ra" className="bg-[#1C1C1E]">Albañil de 1ra</option>
                    <option value="Electricista" className="bg-[#1C1C1E]">Electricista</option>
                    <option value="Plomero" className="bg-[#1C1C1E]">Plomero</option>
                    <option value="Ayudante" className="bg-[#1C1C1E]">Ayudante</option>
                    <option value="Supervisor" className="bg-[#1C1C1E]">Supervisor</option>
                </select>
            </div>
          </div>

          <button 
            onClick={generateInvitation}
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-orange-500/20 mt-2"
          >
            {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
                <>
                    <LinkIcon size={20} />
                    Generar Invitación
                </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4 slide-up">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex flex-col items-center text-center">
                <CheckCircle2 className="text-green-500 mb-2" size={32} />
                <h3 className="text-white font-bold text-sm">¡Link Generado!</h3>
                <p className="text-gray-400 text-xs mt-1">Listo para enviar por WhatsApp</p>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-white/80 text-xs leading-relaxed italic">
                    "{success.message}"
                </p>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={copyToClipboard}
                    className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all text-sm"
                >
                    {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button 
                    onClick={sendWhatsApp}
                    className="flex-[2] bg-[#25D366] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95 text-sm"
                >
                    <MessageSquare size={18} />
                    WhatsApp
                </button>
            </div>

            <button 
                onClick={() => { setSuccess(null); setName(''); setPhone(''); }}
                className="w-full text-gray-500 text-xs font-medium py-2 hover:text-white transition-colors"
            >
                Crear otra invitación
            </button>
        </div>
      )}
    </div>
  );
}
