'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Employee {
    id: string;
    nombres: string;
    apellidos: string;
    cedula: string;
    cargo: string;
    departamento: string;
    celular: string;
    email: string;
    foto_url: string | null;
    estatus: string;
    fecha_ingreso: string;
    tipo_sangre: string;
    ciudad: string;
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
    activo:    { bg: 'rgba(52,199,89,0.12)',  text: '#34C759', dot: '#34C759' },
    inactivo:  { bg: 'rgba(255,59,48,0.12)',  text: '#FF3B30', dot: '#FF3B30' },
    permiso:   { bg: 'rgba(255,149,0,0.12)',  text: '#FF9500', dot: '#FF9500' },
    vacaciones:{ bg: 'rgba(0,174,239,0.12)',  text: '#00AEEF', dot: '#00AEEF' },
};

export default function EmpleadosPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        fetchEmployees();
    }, []);

    async function fetchEmployees() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('employees')
            .select('id,nombres,apellidos,cedula,cargo,departamento,celular,email,foto_url,estatus,fecha_ingreso,tipo_sangre,ciudad')
            .order('apellidos', { ascending: true });
        if (!error && data) setEmployees(data);
        setLoading(false);
    }

    const filtered = employees.filter(e => {
        const q = search.toLowerCase();
        const matchSearch = !q || `${e.nombres} ${e.apellidos} ${e.cedula} ${e.cargo}`.toLowerCase().includes(q);
        const matchStatus = filterStatus === 'all' || e.estatus === filterStatus;
        return matchSearch && matchStatus;
    });

    const glass = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        backdropFilter: 'blur(20px)',
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary, #0A0A0F)', fontFamily: 'Inter, -apple-system, sans-serif', color: 'white', padding: '24px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.6) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Empleados
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '4px 0 0 0' }}>
                        {employees.length} empleado{employees.length !== 1 ? 's' : ''} registrado{employees.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <Link href="/empleados/nuevo" style={{ textDecoration: 'none' }}>
                    <button style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '12px 20px', borderRadius: '14px', border: 'none',
                        background: 'linear-gradient(135deg, #00AEEF, #0077D4)',
                        color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(0,174,239,0.35)',
                    }}>
                        <span style={{ fontSize: '18px' }}>+</span> Nuevo Empleado
                    </button>
                </Link>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '240px', ...glass, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, C.I., cargo…"
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: '14px', fontFamily: 'inherit', width: '100%' }}
                    />
                </div>
                {['all','activo','inactivo','permiso','vacaciones'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{
                        padding: '12px 18px', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                        background: filterStatus === s ? 'rgba(0,174,239,0.2)' : 'rgba(255,255,255,0.04)',
                        color: filterStatus === s ? '#00AEEF' : 'rgba(255,255,255,0.5)',
                        border: filterStatus === s ? '1px solid rgba(0,174,239,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                        {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>

            {/* Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'Activos', count: employees.filter(e => e.estatus === 'activo').length, color: '#34C759' },
                    { label: 'Inactivos', count: employees.filter(e => e.estatus === 'inactivo').length, color: '#FF3B30' },
                    { label: 'Permiso', count: employees.filter(e => e.estatus === 'permiso').length, color: '#FF9500' },
                    { label: 'Vacaciones', count: employees.filter(e => e.estatus === 'vacaciones').length, color: '#00AEEF' },
                ].map(stat => (
                    <div key={stat.label} style={{ ...glass, padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.count}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Employee Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    Cargando empleados…
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ ...glass, padding: '60px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                    <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                        {search ? 'No se encontraron resultados' : 'No hay empleados registrados aún'}
                    </p>
                    {!search && (
                        <Link href="/empleados/nuevo" style={{ textDecoration: 'none' }}>
                            <button style={{ marginTop: '16px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#00AEEF', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                                Registrar primer empleado
                            </button>
                        </Link>
                    )}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {filtered.map(emp => {
                        const sc = statusColors[emp.estatus] ?? statusColors.activo;
                        const initials = `${(emp.nombres || '?')[0]}${(emp.apellidos || '?')[0]}`.toUpperCase();
                        return (
                            <Link key={emp.id} href={`/empleados/${emp.id}`} style={{ textDecoration: 'none' }}>
                                <div style={{
                                    ...glass, padding: '20px', cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                   onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>

                                    {/* Top row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                        {emp.foto_url ? (
                                            <img src={emp.foto_url} alt={emp.nombres} style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                                        ) : (
                                            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #00AEEF, #0055CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                                {initials}
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '15px', fontWeight: 700, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {emp.apellidos}, {emp.nombres}
                                            </p>
                                            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '2px 0 0 0' }}>
                                                C.I. {emp.cedula}
                                            </p>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px', background: sc.bg, color: sc.text, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                                            {emp.estatus}
                                        </span>
                                    </div>

                                    {/* Info rows */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
                                        {[
                                            { icon: '💼', val: emp.cargo || '—', label: 'Cargo' },
                                            { icon: '📍', val: emp.ciudad || '—', label: 'Ciudad' },
                                            { icon: '🩸', val: emp.tipo_sangre || '—', label: 'Sangre' },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '12px' }}>{row.icon}</span>
                                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{row.label}:</span>
                                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{row.val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
