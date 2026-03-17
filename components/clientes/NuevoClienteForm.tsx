'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type PersonType = 'personal' | 'empresa';
type RifPrefix = 'V' | 'E' | 'J';
type EstadoCivil = 'soltero' | 'casado' | 'divorciado' | 'viudo' | 'union_estable';

const estadoCivilOptions: { value: EstadoCivil; label: string }[] = [
    { value: 'soltero', label: 'Soltero/a' },
    { value: 'casado', label: 'Casado/a' },
    { value: 'divorciado', label: 'Divorciado/a' },
    { value: 'viudo', label: 'Viudo/a' },
    { value: 'union_estable', label: 'Unión Estable' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="font-semibold uppercase tracking-widest mb-3"
            style={{ fontSize: '11px', color: 'var(--label-tertiary)', letterSpacing: '0.08em' }}
        >
            {children}
        </p>
    );
}

function FormField({
    label,
    children,
    required,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
}) {
    return (
        <div className="space-y-2">
            <label
                className="block font-medium"
                style={{ fontSize: '14px', color: 'var(--label-secondary)' }}
            >
                {label}
                {required && <span style={{ color: '#FF3B30', marginLeft: '3px' }}>*</span>}
            </label>
            {children}
        </div>
    );
}

function IOSInput({
    placeholder,
    type = 'text',
    value,
    onChange,
    prefix,
}: {
    placeholder: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    prefix?: string;
}) {
    const [focused, setFocused] = useState(false);

    return (
        <div
            className="flex items-center rounded-2xl overflow-hidden transition-all duration-200"
            style={{
                background: focused ? '#FFFFFF' : 'rgba(116, 116, 128, 0.08)',
                border: `1.5px solid ${focused ? '#007AFF' : 'transparent'}`,
                boxShadow: focused ? '0 0 0 4px rgba(0,122,255,0.10)' : 'none',
            }}
        >
            {prefix && (
                <span
                    className="pl-4 pr-2 font-semibold"
                    style={{ color: 'var(--label-secondary)', fontSize: '16px', flexShrink: 0 }}
                >
                    {prefix}
                </span>
            )}
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="flex-1 bg-transparent outline-none py-4 px-4 transition-colors duration-200"
                style={{
                    fontSize: '16px',
                    color: focused ? '#000000' : 'var(--label-primary)',
                    fontFamily: 'inherit',
                    paddingLeft: prefix ? '0' : '16px',
                }}
            />
        </div>
    );
}

function IOSSelect({
    value,
    onChange,
    options,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    const [focused, setFocused] = useState(false);

    return (
        <div
            className="relative rounded-2xl overflow-hidden transition-all duration-200"
            style={{
                background: focused ? '#FFFFFF' : 'rgba(116, 116, 128, 0.08)',
                border: `1.5px solid ${focused ? '#007AFF' : 'transparent'}`,
                boxShadow: focused ? '0 0 0 4px rgba(0,122,255,0.10)' : 'none',
            }}
        >
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="w-full bg-transparent outline-none py-4 px-4 appearance-none transition-colors duration-200"
                style={{
                    fontSize: '16px',
                    color: focused ? '#000000' : (value ? 'var(--label-primary)' : 'var(--label-tertiary)'),
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                }}
            >
                <option value="" disabled style={{ color: '#8E8E93' }}>{placeholder}</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ color: '#000000' }}>{opt.label}</option>
                ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                    <path d="M1 1l5 5 5-5" stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </div>
    );
}

function ImageUploader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => onChange(reader.result as string);
        reader.readAsDataURL(file);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
            <div style={{
                width: '110px', height: '110px', borderRadius: '30px',
                background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
                {value ? (
                    <img src={value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </svg>
                )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{ padding: '10px 18px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    📁 Archivo <input type="file" accept="image/*" onChange={handleFile} hidden />
                </label>
                <label style={{ padding: '10px 18px', borderRadius: '14px', background: 'rgba(0,122,255,0.2)', color: '#007AFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    📸 Cámara <input type="file" accept="image/*" capture="user" onChange={handleFile} hidden />
                </label>
            </div>
            {value && <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', color: '#FF3B30', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Quitar foto</button>}
        </div>
    );
}

function MapWidget({
    lat,
    lng,
    onLocationChange
}: {
    lat: number | null,
    lng: number | null,
    onLocationChange: (lat: number | null, lng: number | null) => void
}) {
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert("La geolocalización no es compatible con este navegador.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                onLocationChange(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                alert("Error al obtener la ubicación: " + error.message);
            }
        );
    };

    return (
        <div className="space-y-3">
            <div
                className="relative overflow-hidden rounded-2xl"
                style={{
                    height: '180px',
                    background: lat && lng
                        ? 'linear-gradient(135deg, #E8F4FD 0%, #D4EBF8 50%, #C8E6F5 100%)'
                        : 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)',
                    border: lat && lng ? '1.5px solid rgba(0,122,255,0.3)' : '1.5px solid rgba(255,255,255,0.1)',
                }}
            >
                {/* Visual indicator of GPS state */}
                {!lat && (
                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 p-6 text-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <p style={{ fontSize: '11px', color: 'var(--label-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Ubicación no establecida
                        </p>
                    </div>
                )}

                {lat && lng && (
                    <>
                        {/* Map grid lines */}
                        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#007AFF" strokeWidth="0.5" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>

                        {/* Simulated roads */}
                        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 100 Q150 80 300 100 Q450 120 600 100" stroke="white" strokeWidth="8" fill="none" opacity="0.8" />
                            <path d="M150 0 Q160 100 155 200" stroke="white" strokeWidth="6" fill="none" opacity="0.7" />
                            <rect x="30" y="20" width="100" height="60" rx="4" fill="rgba(255,255,255,0.4)" />
                            <rect x="170" y="20" width="110" height="55" rx="4" fill="rgba(255,255,255,0.35)" />
                        </svg>

                        {/* Pin */}
                        <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -100%)' }}>
                            <div
                                className="flex items-center justify-center rounded-full shadow-lg"
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    background: '#007AFF',
                                    boxShadow: '0 4px 16px rgba(0,122,255,0.5)',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M9 1C6.24 1 4 3.24 4 6c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5z" fill="white" />
                                    <circle cx="9" cy="6" r="2" fill="#007AFF" />
                                </svg>
                            </div>
                        </div>

                        {/* Pulse ring */}
                        <div
                            className="absolute"
                            style={{
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                background: 'rgba(0,122,255,0.15)',
                                animation: 'pulse 2s ease-in-out infinite',
                            }}
                        />
                    </>
                )}

                {/* GPS button inside map */}
                <button
                    onClick={(e) => { e.preventDefault(); handleGetLocation(); }}
                    className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg active:scale-95 transition-all"
                    style={{ background: '#007AFF' }}
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="3" stroke="white" strokeWidth="1.5" />
                        <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {lat ? 'Actualizar GPS' : 'Grabar GPS'}
                    </span>
                </button>

                {lat && lng && (
                    <button
                        onClick={(e) => { e.preventDefault(); onLocationChange(null, null); }}
                        className="absolute top-3 right-3 flex items-center justify-center rounded-full shadow-md active:scale-90 transition-all"
                        style={{ width: '28px', height: '28px', background: 'rgba(255, 59, 48, 0.9)', border: 'none' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}

                <style jsx>{`
                    @keyframes pulse {
                        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
                        50% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
                    }
                `}</style>
            </div>

            {lat && lng && (
                <div className="flex gap-4 px-3 py-2 rounded-xl bg-blue-600/10 border border-blue-600/20">
                    <div>
                        <p style={{ fontSize: '9px', color: 'var(--label-tertiary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Latitud</p>
                        <p style={{ fontSize: '12px', color: '#007AFF', fontWeight: 'font-mono' }}>{lat.toFixed(6)}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '9px', color: 'var(--label-tertiary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Longitud</p>
                        <p style={{ fontSize: '12px', color: '#007AFF', fontWeight: 'font-mono' }}>{lng.toFixed(6)}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function ContactPersonCard() {
    const [nombre, setNombre] = useState('');
    const [cargo, setCargo] = useState('');
    const [telefono, setTelefono] = useState('');

    return (
        <div
            className="rounded-2xl p-5 space-y-4"
            style={{
                background: 'rgba(0, 122, 255, 0.04)',
                border: '1.5px solid rgba(0, 122, 255, 0.15)',
            }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center rounded-xl"
                    style={{ width: '36px', height: '36px', background: 'rgba(0,122,255,0.12)' }}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="6" r="3.5" stroke="#007AFF" strokeWidth="1.6" />
                        <path d="M2 16c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#007AFF" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold" style={{ fontSize: '15px', color: 'var(--label-primary)' }}>
                        Persona de Contacto
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>
                        Representante de la empresa
                    </p>
                </div>
            </div>

            <FormField label="Nombre completo">
                <IOSInput
                    placeholder="Ej: Carlos Rodríguez"
                    value={nombre}
                    onChange={setNombre}
                />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
                <FormField label="Cargo">
                    <IOSInput
                        placeholder="Ej: Gerente"
                        value={cargo}
                        onChange={setCargo}
                    />
                </FormField>
                <FormField label="Teléfono">
                    <IOSInput
                        placeholder="+58 412..."
                        value={telefono}
                        onChange={setTelefono}
                    />
                </FormField>
            </div>
        </div>
    );
}

export default function NuevoClienteForm({ initialData, isEditing }: { initialData?: any; isEditing?: boolean }) {
    const router = useRouter();
    const [personType, setPersonType] = useState<PersonType>(initialData?.tipo === 'Empresa' ? 'empresa' : 'personal');
    const [rifPrefix, setRifPrefix] = useState<RifPrefix>((initialData?.rif?.slice(0, 1) as RifPrefix) || (personType === 'personal' ? 'V' : 'J'));
    const [rifNum, setRifNum] = useState(initialData?.rif?.split('-')[1] || '');

    // Nombres
    const [primerNombre, setPrimerNombre] = useState(initialData?.nombre?.split(' ')[0] || '');
    const [segundoNombre, setSegundoNombre] = useState(''); // No separado en DB actual
    const [primerApellido, setPrimerApellido] = useState(initialData?.nombre?.split(' ').slice(1).join(' ') || '');
    const [segundoApellido, setSegundoApellido] = useState('');

    const [fechaNacimiento, setFechaNacimiento] = useState(initialData?.fecha_nacimiento || '');
    const [estadoCivil, setEstadoCivil] = useState(initialData?.estado_civil || '');
    const [nombreComercial, setNombreComercial] = useState(initialData?.nombre_comercial || initialData?.nombre || '');
    const [razonSocial, setRazonSocial] = useState(initialData?.razon_social || '');
    const [email, setEmail] = useState(initialData?.email || '');
    const [telefono, setTelefono] = useState(initialData?.movil || '');
    const [direccion, setDireccion] = useState(initialData?.direccion || '');
    const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null);
    const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null);
    const [imagen, setImagen] = useState(initialData?.imagen || '');
    const [saving, setSaving] = useState(false);

    const handlePersonTypeChange = (type: PersonType) => {
        setPersonType(type);
        setRifPrefix(type === 'personal' ? 'V' : 'J');
    };

    const handleSave = async () => {
        setSaving(true);
        const supabase = createClient();

        const customerData = {
            tipo: personType === 'personal' ? 'Personal' : 'Empresa',
            rif: `${rifPrefix}-${rifNum}`,
            nombre: personType === 'personal' ? `${primerNombre} ${primerApellido}`.trim() : nombreComercial,
            razon_social: personType === 'empresa' ? razonSocial : null,
            email,
            movil: telefono,
            direccion,
            latitude,
            longitude,
            imagen: imagen || null,
            color: initialData?.color || ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55'][Math.floor(Math.random() * 5)]
        };

        let result;
        if (isEditing && initialData?.id) {
            result = await supabase.from('customers').update(customerData).eq('id', initialData.id);
        } else {
            result = await supabase.from('customers').insert([customerData]);
        }

        if (result.error) {
            alert('Error al guardar: ' + result.error.message);
        } else {
            router.push('/clientes');
            router.refresh();
        }
        setSaving(false);
    };

    const glass = {
        background: 'rgba(28, 28, 30, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            <div className="px-5 pt-6 pb-10 space-y-6">

                {/* Segment Control */}
                <div className="p-1 rounded-2xl flex" style={{ background: 'rgba(116, 116, 128, 0.2)' }}>
                    <button
                        onClick={() => handlePersonTypeChange('personal')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                        style={{
                            background: personType === 'personal' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: 'white', fontWeight: 600
                        }}
                    >
                        Personal
                    </button>
                    <button
                        onClick={() => handlePersonTypeChange('empresa')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                        style={{
                            background: personType === 'empresa' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: 'white', fontWeight: 600
                        }}
                    >
                        Empresa
                    </button>
                </div>

                <div className="space-y-4">
                    <div style={{ ...glass, padding: '20px' }} className="space-y-4">
                        <SectionLabel>Identificación</SectionLabel>
                        <FormField label="RIF / Cédula" required>
                            <div className="flex gap-2">
                                <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    {(personType === 'personal' ? ['V', 'E'] : ['J']).map((prefix) => (
                                        <button
                                            key={prefix}
                                            onClick={() => setRifPrefix(prefix as RifPrefix)}
                                            className="px-4 py-3 font-bold"
                                            style={{
                                                background: rifPrefix === prefix ? '#007AFF' : 'transparent',
                                                color: 'white'
                                            }}
                                        >
                                            {prefix}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1">
                                    <IOSInput placeholder="12345678" value={rifNum} onChange={setRifNum} prefix="-" />
                                </div>
                            </div>
                        </FormField>
                    </div>

                    {personType === 'personal' ? (
                        <div style={{ ...glass, padding: '20px' }} className="space-y-4">
                            <SectionLabel>Datos Personales</SectionLabel>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Nombre" required>
                                    <IOSInput placeholder="Carlos" value={primerNombre} onChange={setPrimerNombre} />
                                </FormField>
                                <FormField label="Apellido" required>
                                    <IOSInput placeholder="Rodríguez" value={primerApellido} onChange={setPrimerApellido} />
                                </FormField>
                            </div>
                            <FormField label="Estado Civil">
                                <IOSSelect value={estadoCivil} onChange={setEstadoCivil} options={estadoCivilOptions} placeholder="Seleccionar..." />
                            </FormField>
                        </div>
                    ) : (
                        <div style={{ ...glass, padding: '20px' }} className="space-y-4">
                            <SectionLabel>Empresa</SectionLabel>
                            <FormField label="Nombre Comercial" required>
                                <IOSInput placeholder="Ej: Bazar Central" value={nombreComercial} onChange={setNombreComercial} />
                            </FormField>
                            <FormField label="Razón Social">
                                <IOSInput placeholder="Ej: Bazar Central C.A." value={razonSocial} onChange={setRazonSocial} />
                            </FormField>
                        </div>
                    )}

                    <div style={{ ...glass, padding: '20px' }} className="space-y-4">
                        <SectionLabel>{personType === 'personal' ? 'Foto de Perfil' : 'Logo de la Empresa'}</SectionLabel>
                        <ImageUploader value={imagen} onChange={setImagen} />
                    </div>

                    <div style={{ ...glass, padding: '20px' }} className="space-y-4">
                        <SectionLabel>Contacto</SectionLabel>
                        <FormField label="Email" required>
                            <IOSInput placeholder="correo@ejemplo.com" type="email" value={email} onChange={setEmail} />
                        </FormField>
                        <FormField label="Teléfono" required>
                            <IOSInput placeholder="+58 412..." type="tel" value={telefono} onChange={setTelefono} />
                        </FormField>
                        <FormField label="Dirección">
                            <IOSInput placeholder="Calle, Av, Ciudad..." value={direccion} onChange={setDireccion} />
                        </FormField>
                        <FormField label="Ubicación Geográfica (GPS)">
                            <MapWidget
                                lat={latitude}
                                lng={longitude}
                                onLocationChange={(lat, lng) => {
                                    setLatitude(lat);
                                    setLongitude(lng);
                                }}
                            />
                        </FormField>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full font-bold active:scale-95 transition-all"
                    style={{
                        background: 'linear-gradient(135deg, #007AFF, #0055CC)',
                        color: 'white', borderRadius: '18px', padding: '18px',
                        fontSize: '17px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        boxShadow: '0 8px 32px rgba(0,122,255,0.3)'
                    }}
                >
                    {saving ? 'Guardando...' : isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}
                </button>
            </div>
        </div>
    );
}

