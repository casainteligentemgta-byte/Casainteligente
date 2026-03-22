'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const SECTIONS = ['Personales', 'Laboral', 'Estudios', 'Experiencia', 'Cursos', 'Conocimientos', 'Médicos', 'Vehículo', 'Referencias'];

const NIVELES = ['Excelente', 'Bueno', 'Regular', 'Bajo', 'Ninguno'];
const SANGRE = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const ESTADOS_CIVIL = ['Soltero/a','Casado/a','Divorciado/a','Viudo/a','Unión Libre'];
const ESTADOS_VE = ['Amazonas','Anzoátegui','Apure','Aragua','Barinas','Bolívar','Carabobo','Cojedes','Delta Amacuro','Distrito Capital','Falcón','Guárico','Lara','Mérida','Miranda','Monagas','Nueva Esparta','Portuguesa','Sucre','Táchira','Trujillo','Vargas','Yaracuy','Zulia'];
const DISPONIBILIDAD = ['Tiempo Completo','Medio Tiempo','Por Horas','A Destajo'];

type Study = { tipo: string; institucion: string; ciudad: string; anio: string; titulo: string };
type Experience = { desde: string; hasta: string; empresa: string; cargo: string; ciudad: string; ultimo_salario: string; supervisor: string; motivo_retiro: string };
type Course = { anio: string; nombre: string; ciudad: string; organizado_por: string };
type Reference = { nexo: string; nombre: string; profesion: string; telefono: string };
type Affiliation = { nro: string; gremio: string; desde_anio: string; ciudad: string };

export default function EditarEmpleadoPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [section, setSection] = useState(0);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // — Personales —
    const [nombres, setNombres] = useState('');
    const [apellidos, setApellidos] = useState('');
    const [cedula, setCedula] = useState('');
    const [fechaNacimiento, setFechaNacimiento] = useState('');
    const [estadoCivil, setEstadoCivil] = useState('');
    const [nacionalidad, setNacionalidad] = useState('Venezolano/a');
    const [hijos, setHijos] = useState('0');
    const [direccion, setDireccion] = useState('');
    const [ciudad, setCiudad] = useState('');
    const [estado, setEstado] = useState('');
    const [telHabitacion, setTelHabitacion] = useState('');
    const [celular, setCelular] = useState('');
    const [email, setEmail] = useState('');
    const [fotoUrl, setFotoUrl] = useState('');
    const [rif, setRif] = useState('');

    // — Laboral —
    const [cargo, setCargo] = useState('');
    const [departamento, setDepartamento] = useState('');
    const [fechaIngreso, setFechaIngreso] = useState('');
    const [salario, setSalario] = useState('');
    const [estatus, setEstatus] = useState('activo');
    const [cuentaBancaria, setCuentaBancaria] = useState('');
    const [banco, setBanco] = useState('');
    const [ivss, setIvss] = useState('');
    const [pretensionSalarial, setPretensionSalarial] = useState('');
    const [disponibilidad, setDisponibilidad] = useState('');
    const [areasInteres, setAreasInteres] = useState<string[]>([]);

    // — Estudios —
    const [estudios, setEstudios] = useState<Study[]>([
        { tipo: 'Primaria', institucion: '', ciudad: '', anio: '', titulo: '' },
        { tipo: 'Secundaria', institucion: '', ciudad: '', anio: '', titulo: '' },
        { tipo: 'Universitaria', institucion: '', ciudad: '', anio: '', titulo: '' },
        { tipo: 'Postgrado', institucion: '', ciudad: '', anio: '', titulo: '' },
    ]);
    const [estudioActualSemestre, setEstudioActualSemestre] = useState('');
    const [estudioActualInstituto, setEstudioActualInstituto] = useState('');
    const [estudioActualCarrera, setEstudioActualCarrera] = useState('');

    // — Experiencia —
    const [experiencia, setExperiencia] = useState<Experience[]>([{ desde: '', hasta: '', empresa: '', cargo: '', ciudad: '', ultimo_salario: '', supervisor: '', motivo_retiro: '' }]);

    // — Cursos —
    const [cursos, setCursos] = useState<Course[]>([{ anio: '', nombre: '', ciudad: '', organizado_por: '' }]);

    // — Conocimientos —
    const [swWindows, setSwWindows] = useState('Ninguno');
    const [swWord, setSwWord] = useState('Ninguno');
    const [swExcel, setSwExcel] = useState('Ninguno');
    const [swPowerPoint, setSwPowerPoint] = useState('Ninguno');
    const [swAdmin, setSwAdmin] = useState('Ninguno');
    const [swInternet, setSwInternet] = useState('Ninguno');
    const [idiomas, setIdiomas] = useState<{ idioma: string; nivel: string }[]>([{ idioma: '', nivel: 'Ninguno' }]);
    const [areasConocimiento, setAreasConocimiento] = useState('');

    // — Médicos —
    const [tipoSangre, setTipoSangre] = useState('');
    const [enfermedades, setEnfermedades] = useState('');
    const [alergias, setAlergias] = useState('');
    const [tratamientos, setTratamientos] = useState('');
    const [certMedicoGrado, setCertMedicoGrado] = useState('');
    const [certMedicoVencimiento, setCertMedicoVencimiento] = useState('');

    // — Vehículo —
    const [vehiculoPropio, setVehiculoPropio] = useState(false);
    const [vehiculoMarca, setVehiculoMarca] = useState('');
    const [vehiculoAnio, setVehiculoAnio] = useState('');
    const [licenciaGrado, setLicenciaGrado] = useState('');
    const [licenciaVencimiento, setLicenciaVencimiento] = useState('');
    const [infracciones, setInfracciones] = useState('');
    const [accidentes, setAccidentes] = useState('');
    const [medioTransporte, setMedioTransporte] = useState('');

    // — Referencias —
    const [referencias, setReferencias] = useState<Reference[]>([{ nexo: '', nombre: '', profesion: '', telefono: '' }]);
    const [afiliaciones, setAfiliaciones] = useState<Affiliation[]>([{ nro: '', gremio: '', desde_anio: '', ciudad: '' }]);

    // ── Cargar datos existentes ──
    useEffect(() => {
        async function load() {
            const supabase = createClient();
            const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
            if (error || !data) { setLoading(false); return; }

            const d = data;
            setNombres(d.nombres || '');
            setApellidos(d.apellidos || '');
            setCedula(d.cedula || '');
            setRif(d.rif || '');
            setFechaNacimiento(d.fecha_nacimiento || '');
            setEstadoCivil(d.estado_civil || '');
            setNacionalidad(d.nacionalidad || 'Venezolano/a');
            setHijos(String(d.hijos || 0));
            setDireccion(d.direccion || '');
            setCiudad(d.ciudad || '');
            setEstado(d.estado || '');
            setTelHabitacion(d.telefono_habitacion || '');
            setCelular(d.celular || '');
            setEmail(d.email || '');
            setFotoUrl(d.foto_url || '');

            setCargo(d.cargo || '');
            setDepartamento(d.departamento || '');
            setFechaIngreso(d.fecha_ingreso || '');
            setSalario(d.salario ? String(d.salario) : '');
            setEstatus(d.estatus || 'activo');
            setCuentaBancaria(d.cuenta_bancaria || '');
            setBanco(d.banco || '');
            setIvss(d.ivss || '');
            setPretensionSalarial(d.pretension_salarial ? String(d.pretension_salarial) : '');
            setDisponibilidad(d.disponibilidad || '');
            setAreasInteres(d.areas_interes || []);

            // Estudios: merge con defaults para mantener los 4 tipos
            const tipoBase = ['Primaria','Secundaria','Universitaria','Postgrado'];
            const estudiosDB: Study[] = d.estudios || [];
            setEstudios(tipoBase.map(tipo => {
                const found = estudiosDB.find((e: Study) => e.tipo === tipo);
                return found || { tipo, institucion: '', ciudad: '', anio: '', titulo: '' };
            }));
            const ea = d.estudios_actuales || {};
            setEstudioActualSemestre(ea.semestre || '');
            setEstudioActualInstituto(ea.instituto || '');
            setEstudioActualCarrera(ea.carrera || '');

            const expDB = d.experiencia || [];
            setExperiencia(expDB.length > 0 ? expDB : [{ desde: '', hasta: '', empresa: '', cargo: '', ciudad: '', ultimo_salario: '', supervisor: '', motivo_retiro: '' }]);

            const cursosDB = d.cursos || [];
            setCursos(cursosDB.length > 0 ? cursosDB : [{ anio: '', nombre: '', ciudad: '', organizado_por: '' }]);

            setSwWindows(d.software_windows || 'Ninguno');
            setSwWord(d.software_word || 'Ninguno');
            setSwExcel(d.software_excel || 'Ninguno');
            setSwPowerPoint(d.software_powerpoint || 'Ninguno');
            setSwAdmin(d.software_admin || 'Ninguno');
            setSwInternet(d.software_internet || 'Ninguno');
            const idiomasDB = d.idiomas || [];
            setIdiomas(idiomasDB.length > 0 ? idiomasDB : [{ idioma: '', nivel: 'Ninguno' }]);
            setAreasConocimiento(d.areas_conocimiento || '');

            setTipoSangre(d.tipo_sangre || '');
            setEnfermedades(d.enfermedades || '');
            setAlergias(d.alergias || '');
            setTratamientos(d.tratamientos || '');
            setCertMedicoGrado(d.certificado_medico_grado || '');
            setCertMedicoVencimiento(d.certificado_medico_vencimiento || '');

            setVehiculoPropio(d.vehiculo_propio || false);
            setVehiculoMarca(d.vehiculo_marca || '');
            setVehiculoAnio(d.vehiculo_anio ? String(d.vehiculo_anio) : '');
            setLicenciaGrado(d.licencia_grado || '');
            setLicenciaVencimiento(d.licencia_vencimiento || '');
            setInfracciones(d.infracciones || '');
            setAccidentes(d.accidentes || '');
            setMedioTransporte(d.medio_transporte || '');

            const refDB = d.referencias || [];
            setReferencias(refDB.length > 0 ? refDB : [{ nexo: '', nombre: '', profesion: '', telefono: '' }]);
            const afilDB = d.afiliaciones || [];
            setAfiliaciones(afilDB.length > 0 ? afilDB : [{ nro: '', gremio: '', desde_anio: '', ciudad: '' }]);

            setLoading(false);
        }
        load();
    }, [id]);

    const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', backdropFilter: 'blur(20px)' };
    const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const };
    const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px', textTransform: 'uppercase' as const, display: 'block', marginBottom: '6px' };
    const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' };
    const toggleArea = (area: string) => setAreasInteres(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);

    async function handleSave() {
        if (!nombres || !apellidos || !cedula) return alert('Nombre, Apellido y C.I. son obligatorios');
        setSaving(true);
        const supabase = createClient();
        const payload = {
            nombres, apellidos, cedula, rif,
            fecha_nacimiento: fechaNacimiento || null,
            estado_civil: estadoCivil, nacionalidad, hijos: parseInt(hijos) || 0,
            direccion, ciudad, estado, telefono_habitacion: telHabitacion, celular, email,
            foto_url: fotoUrl || null,
            cargo, departamento, fecha_ingreso: fechaIngreso || null,
            salario: parseFloat(salario) || null, estatus,
            cuenta_bancaria: cuentaBancaria, banco, ivss,
            pretension_salarial: parseFloat(pretensionSalarial) || null,
            disponibilidad, areas_interes: areasInteres,
            estudios: estudios.filter(e => e.institucion),
            estudios_actuales: estudioActualCarrera ? { semestre: estudioActualSemestre, instituto: estudioActualInstituto, carrera: estudioActualCarrera } : null,
            experiencia: experiencia.filter(e => e.empresa),
            cursos: cursos.filter(c => c.nombre),
            software_windows: swWindows, software_word: swWord, software_excel: swExcel,
            software_powerpoint: swPowerPoint, software_admin: swAdmin, software_internet: swInternet,
            idiomas: idiomas.filter(i => i.idioma),
            areas_conocimiento: areasConocimiento,
            tipo_sangre: tipoSangre || null, enfermedades, alergias, tratamientos,
            certificado_medico_grado: certMedicoGrado,
            certificado_medico_vencimiento: certMedicoVencimiento || null,
            vehiculo_propio: vehiculoPropio,
            vehiculo_marca: vehiculoMarca,
            vehiculo_anio: parseInt(vehiculoAnio) || null,
            licencia_grado: licenciaGrado,
            licencia_vencimiento: licenciaVencimiento || null,
            infracciones, accidentes, medio_transporte: medioTransporte,
            referencias: referencias.filter(r => r.nombre),
            afiliaciones: afiliaciones.filter(a => a.gremio),
        };

        const { error } = await supabase.from('employees').update(payload).eq('id', id);
        setSaving(false);
        if (error) return alert('Error al actualizar: ' + error.message);
        router.push(`/empleados/${id}`);
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif', flexDirection: 'column', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,174,239,0.2)', borderTopColor: '#00AEEF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ margin: 0 }}>Cargando datos del empleado…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary,#0A0A0F)', fontFamily: 'Inter,-apple-system,sans-serif', color: 'white', padding: '24px' }}>

            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: 0, marginBottom: '12px', fontFamily: 'inherit' }}>
                    ← Volver al perfil
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg,#fff,rgba(255,255,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Editar Empleado
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', margin: '4px 0 0 0' }}>
                            {apellidos}, {nombres}
                        </p>
                    </div>
                    {/* Guardar rápido desde header */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: saving ? 'rgba(52,199,89,0.3)' : 'linear-gradient(135deg,#34C759,#30D158)', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 16px rgba(52,199,89,0.3)' }}>
                        {saving ? 'Guardando…' : '✓ Guardar cambios'}
                    </button>
                </div>
            </div>

            {/* Section Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '28px', flexWrap: 'wrap' }}>
                {SECTIONS.map((sec, i) => (
                    <button key={sec} onClick={() => setSection(i)} style={{
                        padding: '8px 14px', borderRadius: '10px', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                        background: section === i ? 'rgba(0,174,239,0.2)' : 'rgba(255,255,255,0.04)',
                        color: section === i ? '#00AEEF' : 'rgba(255,255,255,0.45)',
                        border: section === i ? '1px solid rgba(0,174,239,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    }}>{i + 1}. {sec}</button>
                ))}
            </div>

            <div style={{ ...glass, padding: '28px', marginBottom: '24px' }}>

                {/* ── 0: Personales ── */}
                {section === 0 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Datos Personales</h2>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Apellidos *</label><input style={inputStyle} value={apellidos} onChange={e => setApellidos(e.target.value)} /></div>
                            <div><label style={labelStyle}>Nombres *</label><input style={inputStyle} value={nombres} onChange={e => setNombres(e.target.value)} /></div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Cédula de Identidad *</label><input style={inputStyle} value={cedula} onChange={e => setCedula(e.target.value)} /></div>
                            <div><label style={labelStyle}>RIF</label><input style={inputStyle} value={rif} onChange={e => setRif(e.target.value)} /></div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Fecha de Nacimiento</label><input type="date" style={inputStyle} value={fechaNacimiento} onChange={e => setFechaNacimiento(e.target.value)} /></div>
                            <div><label style={labelStyle}>Estado Civil</label>
                                <select style={{ ...inputStyle }} value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)}>
                                    <option value="">Seleccionar…</option>
                                    {ESTADOS_CIVIL.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Nacionalidad</label><input style={inputStyle} value={nacionalidad} onChange={e => setNacionalidad(e.target.value)} /></div>
                            <div><label style={labelStyle}>Nº de Hijos</label><input type="number" min="0" style={inputStyle} value={hijos} onChange={e => setHijos(e.target.value)} /></div>
                        </div>
                        <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Dirección Actual</label><input style={inputStyle} value={direccion} onChange={e => setDireccion(e.target.value)} /></div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Ciudad</label><input style={inputStyle} value={ciudad} onChange={e => setCiudad(e.target.value)} /></div>
                            <div><label style={labelStyle}>Estado</label>
                                <select style={{ ...inputStyle }} value={estado} onChange={e => setEstado(e.target.value)}>
                                    <option value="">Seleccionar…</option>
                                    {ESTADOS_VE.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Teléfono Habitación</label><input style={inputStyle} value={telHabitacion} onChange={e => setTelHabitacion(e.target.value)} /></div>
                            <div><label style={labelStyle}>Celular</label><input style={inputStyle} value={celular} onChange={e => setCelular(e.target.value)} /></div>
                        </div>
                        <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Correo Electrónico</label><input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} /></div>
                        <div><label style={labelStyle}>URL Foto del Empleado</label><input style={inputStyle} value={fotoUrl} onChange={e => setFotoUrl(e.target.value)} placeholder="https://…" /></div>
                        {fotoUrl && <img src={fotoUrl} alt="preview" style={{ marginTop: '12px', width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,174,239,0.4)' }} />}
                    </div>
                )}

                {/* ── 1: Laboral ── */}
                {section === 1 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Información Laboral</h2>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Cargo</label><input style={inputStyle} value={cargo} onChange={e => setCargo(e.target.value)} /></div>
                            <div><label style={labelStyle}>Departamento</label><input style={inputStyle} value={departamento} onChange={e => setDepartamento(e.target.value)} /></div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Fecha de Ingreso</label><input type="date" style={inputStyle} value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} /></div>
                            <div><label style={labelStyle}>Estatus</label>
                                <select style={{ ...inputStyle }} value={estatus} onChange={e => setEstatus(e.target.value)}>
                                    {['activo','inactivo','permiso','vacaciones'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Salario (USD)</label><input type="number" style={inputStyle} value={salario} onChange={e => setSalario(e.target.value)} /></div>
                            <div><label style={labelStyle}>Pretensión Salarial (USD)</label><input type="number" style={inputStyle} value={pretensionSalarial} onChange={e => setPretensionSalarial(e.target.value)} /></div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Banco</label><input style={inputStyle} value={banco} onChange={e => setBanco(e.target.value)} /></div>
                            <div><label style={labelStyle}>Cuenta Bancaria</label><input style={inputStyle} value={cuentaBancaria} onChange={e => setCuentaBancaria(e.target.value)} /></div>
                        </div>
                        <div style={{ marginBottom: '16px' }}><label style={labelStyle}>IVSS / Seguro Social</label><input style={inputStyle} value={ivss} onChange={e => setIvss(e.target.value)} /></div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>Disponibilidad</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {DISPONIBILIDAD.map(d => (
                                    <button key={d} onClick={() => setDisponibilidad(d)} style={{ padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, background: disponibilidad === d ? 'rgba(0,174,239,0.2)' : 'rgba(255,255,255,0.05)', color: disponibilidad === d ? '#00AEEF' : 'rgba(255,255,255,0.5)', border: disponibilidad === d ? '1px solid rgba(0,174,239,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>{d}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Área de Interés Laboral</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {['Oficina','Obra','Entes Gubernamentales','Inspección'].map(a => (
                                    <button key={a} onClick={() => toggleArea(a)} style={{ padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, background: areasInteres.includes(a) ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.05)', color: areasInteres.includes(a) ? '#34C759' : 'rgba(255,255,255,0.5)', border: areasInteres.includes(a) ? '1px solid rgba(52,199,89,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>{a}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── 2: Estudios ── */}
                {section === 2 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Estudios Efectuados</h2>
                        {estudios.map((est, i) => (
                            <div key={est.tipo} style={{ marginBottom: '24px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{est.tipo}</h3>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Institución</label><input style={inputStyle} value={est.institucion} onChange={e => { const n=[...estudios]; n[i].institucion=e.target.value; setEstudios(n); }} /></div>
                                    <div><label style={labelStyle}>Ciudad</label><input style={inputStyle} value={est.ciudad} onChange={e => { const n=[...estudios]; n[i].ciudad=e.target.value; setEstudios(n); }} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Año</label><input style={inputStyle} value={est.anio} onChange={e => { const n=[...estudios]; n[i].anio=e.target.value; setEstudios(n); }} /></div>
                                    <div><label style={labelStyle}>Título Obtenido</label><input style={inputStyle} value={est.titulo} onChange={e => { const n=[...estudios]; n[i].titulo=e.target.value; setEstudios(n); }} /></div>
                                </div>
                            </div>
                        ))}
                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'rgba(255,255,255,0.7)' }}>Estudios Actuales</h3>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Semestre</label><input style={inputStyle} value={estudioActualSemestre} onChange={e => setEstudioActualSemestre(e.target.value)} /></div>
                            <div><label style={labelStyle}>Instituto</label><input style={inputStyle} value={estudioActualInstituto} onChange={e => setEstudioActualInstituto(e.target.value)} /></div>
                        </div>
                        <div><label style={labelStyle}>Carrera</label><input style={inputStyle} value={estudioActualCarrera} onChange={e => setEstudioActualCarrera(e.target.value)} /></div>
                    </div>
                )}

                {/* ── 3: Experiencia ── */}
                {section === 3 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Experiencia Laboral</h2>
                        {experiencia.map((exp, i) => (
                            <div key={i} style={{ marginBottom: '20px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Empleo #{i+1}</span>
                                    {experiencia.length > 1 && <button onClick={() => setExperiencia(prev=>prev.filter((_,j)=>j!==i))} style={{ background: 'rgba(255,59,48,0.15)', border: 'none', borderRadius: '8px', color: '#FF3B30', cursor: 'pointer', padding: '4px 10px', fontSize: '12px', fontFamily: 'inherit' }}>Eliminar</button>}
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Desde</label><input type="date" style={inputStyle} value={exp.desde} onChange={e=>{const n=[...experiencia];n[i].desde=e.target.value;setExperiencia(n)}} /></div>
                                    <div><label style={labelStyle}>Hasta</label><input type="date" style={inputStyle} value={exp.hasta} onChange={e=>{const n=[...experiencia];n[i].hasta=e.target.value;setExperiencia(n)}} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Empresa / Organismo</label><input style={inputStyle} value={exp.empresa} onChange={e=>{const n=[...experiencia];n[i].empresa=e.target.value;setExperiencia(n)}} /></div>
                                    <div><label style={labelStyle}>Cargo</label><input style={inputStyle} value={exp.cargo} onChange={e=>{const n=[...experiencia];n[i].cargo=e.target.value;setExperiencia(n)}} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Ciudad</label><input style={inputStyle} value={exp.ciudad} onChange={e=>{const n=[...experiencia];n[i].ciudad=e.target.value;setExperiencia(n)}} /></div>
                                    <div><label style={labelStyle}>Último Salario</label><input style={inputStyle} value={exp.ultimo_salario} onChange={e=>{const n=[...experiencia];n[i].ultimo_salario=e.target.value;setExperiencia(n)}} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Supervisor Inmediato</label><input style={inputStyle} value={exp.supervisor} onChange={e=>{const n=[...experiencia];n[i].supervisor=e.target.value;setExperiencia(n)}} /></div>
                                    <div><label style={labelStyle}>Motivo de Retiro</label><input style={inputStyle} value={exp.motivo_retiro} onChange={e=>{const n=[...experiencia];n[i].motivo_retiro=e.target.value;setExperiencia(n)}} /></div>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setExperiencia(prev=>[...prev,{desde:'',hasta:'',empresa:'',cargo:'',ciudad:'',ultimo_salario:'',supervisor:'',motivo_retiro:''}])} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px dashed rgba(0,174,239,0.4)', background: 'rgba(0,174,239,0.06)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '14px' }}>
                            + Agregar Experiencia
                        </button>
                    </div>
                )}

                {/* ── 4: Cursos ── */}
                {section === 4 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Cursos Efectuados</h2>
                        {cursos.map((cur, i) => (
                            <div key={i} style={{ marginBottom: '16px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Curso #{i+1}</span>
                                    {cursos.length > 1 && <button onClick={() => setCursos(prev=>prev.filter((_,j)=>j!==i))} style={{ background: 'rgba(255,59,48,0.15)', border: 'none', borderRadius: '8px', color: '#FF3B30', cursor: 'pointer', padding: '4px 10px', fontSize: '12px', fontFamily: 'inherit' }}>Eliminar</button>}
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Año</label><input style={inputStyle} value={cur.anio} onChange={e=>{const n=[...cursos];n[i].anio=e.target.value;setCursos(n)}} /></div>
                                    <div><label style={labelStyle}>Ciudad</label><input style={inputStyle} value={cur.ciudad} onChange={e=>{const n=[...cursos];n[i].ciudad=e.target.value;setCursos(n)}} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Nombre del Curso</label><input style={inputStyle} value={cur.nombre} onChange={e=>{const n=[...cursos];n[i].nombre=e.target.value;setCursos(n)}} /></div>
                                    <div><label style={labelStyle}>Organizado por</label><input style={inputStyle} value={cur.organizado_por} onChange={e=>{const n=[...cursos];n[i].organizado_por=e.target.value;setCursos(n)}} /></div>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setCursos(prev=>[...prev,{anio:'',nombre:'',ciudad:'',organizado_por:''}])} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px dashed rgba(0,174,239,0.4)', background: 'rgba(0,174,239,0.06)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                            + Agregar Curso
                        </button>
                    </div>
                )}

                {/* ── 5: Conocimientos ── */}
                {section === 5 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Conocimientos</h2>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>Software</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                            {[['Windows', swWindows, setSwWindows], ['Word', swWord, setSwWord], ['Excel', swExcel, setSwExcel], ['PowerPoint', swPowerPoint, setSwPowerPoint], ['Prog. Administrativos', swAdmin, setSwAdmin], ['Internet', swInternet, setSwInternet]].map(([label, val, setter]: any) => (
                                <div key={label}>
                                    <label style={labelStyle}>{label}</label>
                                    <select style={{ ...inputStyle }} value={val} onChange={e => setter(e.target.value)}>
                                        {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>Idiomas</h3>
                        {idiomas.map((id, i) => (
                            <div key={i} style={rowStyle}>
                                <div><label style={labelStyle}>Idioma</label><input style={inputStyle} value={id.idioma} onChange={e=>{const n=[...idiomas];n[i].idioma=e.target.value;setIdiomas(n)}} /></div>
                                <div><label style={labelStyle}>Nivel</label><select style={{ ...inputStyle }} value={id.nivel} onChange={e=>{const n=[...idiomas];n[i].nivel=e.target.value;setIdiomas(n)}}>{NIVELES.map(nv=><option key={nv} value={nv}>{nv}</option>)}</select></div>
                            </div>
                        ))}
                        <button onClick={() => setIdiomas(prev=>[...prev,{idioma:'',nivel:'Ninguno'}])} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px dashed rgba(0,174,239,0.4)', background: 'rgba(0,174,239,0.06)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px', marginBottom: '20px' }}>
                            + Idioma
                        </button>
                        <div><label style={labelStyle}>Áreas Específicas de Conocimiento</label><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={areasConocimiento} onChange={e => setAreasConocimiento(e.target.value)} /></div>
                    </div>
                )}

                {/* ── 6: Médicos ── */}
                {section === 6 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Datos Médicos</h2>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Tipo de Sangre</label>
                                <select style={{ ...inputStyle }} value={tipoSangre} onChange={e => setTipoSangre(e.target.value)}>
                                    <option value="">Seleccionar…</option>
                                    {SANGRE.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div><label style={labelStyle}>Certificado Médico – Grado</label><input style={inputStyle} value={certMedicoGrado} onChange={e => setCertMedicoGrado(e.target.value)} /></div>
                        </div>
                        <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Vencimiento Certificado Médico</label><input type="date" style={inputStyle} value={certMedicoVencimiento} onChange={e => setCertMedicoVencimiento(e.target.value)} /></div>
                        <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Enfermedades Crónicas</label><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={enfermedades} onChange={e => setEnfermedades(e.target.value)} /></div>
                        <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Alergias</label><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={alergias} onChange={e => setAlergias(e.target.value)} /></div>
                        <div><label style={labelStyle}>Tratamientos Médicos Actuales</label><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={tratamientos} onChange={e => setTratamientos(e.target.value)} /></div>
                    </div>
                )}

                {/* ── 7: Vehículo ── */}
                {section === 7 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Vehículo & Documentos</h2>
                        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>¿Vehículo Propio?</label>
                            <button onClick={() => setVehiculoPropio(!vehiculoPropio)} style={{ width: '50px', height: '26px', borderRadius: '13px', background: vehiculoPropio ? '#34C759' : 'rgba(255,255,255,0.1)', border: 'none', position: 'relative', cursor: 'pointer', padding: '2px', transition: 'all 0.3s' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '11px', background: 'white', transform: vehiculoPropio ? 'translateX(24px)' : 'translateX(0)', transition: 'transform 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                            </button>
                        </div>
                        {vehiculoPropio && (
                            <div style={rowStyle}>
                                <div><label style={labelStyle}>Marca</label><input style={inputStyle} value={vehiculoMarca} onChange={e => setVehiculoMarca(e.target.value)} /></div>
                                <div><label style={labelStyle}>Año</label><input style={inputStyle} value={vehiculoAnio} onChange={e => setVehiculoAnio(e.target.value)} /></div>
                            </div>
                        )}
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '14px' }}>Licencia de Conducir</h3>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Grado</label><input style={inputStyle} value={licenciaGrado} onChange={e => setLicenciaGrado(e.target.value)} /></div>
                            <div><label style={labelStyle}>Vencimiento</label><input type="date" style={inputStyle} value={licenciaVencimiento} onChange={e => setLicenciaVencimiento(e.target.value)} /></div>
                        </div>
                        <div style={rowStyle}>
                            <div><label style={labelStyle}>Infracciones</label><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={infracciones} onChange={e => setInfracciones(e.target.value)} /></div>
                            <div><label style={labelStyle}>Accidentes</label><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={accidentes} onChange={e => setAccidentes(e.target.value)} /></div>
                        </div>
                        <div><label style={labelStyle}>Medio de Transporte Utilizado</label><input style={inputStyle} value={medioTransporte} onChange={e => setMedioTransporte(e.target.value)} /></div>
                    </div>
                )}

                {/* ── 8: Referencias ── */}
                {section === 8 && (
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: 0, marginBottom: '24px', color: '#00AEEF' }}>Referencias & Afiliaciones</h2>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>Referencias Personales</h3>
                        {referencias.map((ref, i) => (
                            <div key={i} style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Nexo</label><input style={inputStyle} value={ref.nexo} onChange={e=>{const n=[...referencias];n[i].nexo=e.target.value;setReferencias(n)}} /></div>
                                    <div><label style={labelStyle}>Nombre Completo</label><input style={inputStyle} value={ref.nombre} onChange={e=>{const n=[...referencias];n[i].nombre=e.target.value;setReferencias(n)}} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Profesión</label><input style={inputStyle} value={ref.profesion} onChange={e=>{const n=[...referencias];n[i].profesion=e.target.value;setReferencias(n)}} /></div>
                                    <div><label style={labelStyle}>Teléfono</label><input style={inputStyle} value={ref.telefono} onChange={e=>{const n=[...referencias];n[i].telefono=e.target.value;setReferencias(n)}} /></div>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setReferencias(prev=>[...prev,{nexo:'',nombre:'',profesion:'',telefono:''}])} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px dashed rgba(0,174,239,0.4)', background: 'rgba(0,174,239,0.06)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px', marginBottom: '28px' }}>
                            + Referencia
                        </button>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>Afiliaciones a Gremios</h3>
                        {afiliaciones.map((af, i) => (
                            <div key={i} style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Nro.</label><input style={inputStyle} value={af.nro} onChange={e=>{const n=[...afiliaciones];n[i].nro=e.target.value;setAfiliaciones(n)}} /></div>
                                    <div><label style={labelStyle}>Gremio / Organización</label><input style={inputStyle} value={af.gremio} onChange={e=>{const n=[...afiliaciones];n[i].gremio=e.target.value;setAfiliaciones(n)}} /></div>
                                </div>
                                <div style={rowStyle}>
                                    <div><label style={labelStyle}>Desde (Año)</label><input style={inputStyle} value={af.desde_anio} onChange={e=>{const n=[...afiliaciones];n[i].desde_anio=e.target.value;setAfiliaciones(n)}} /></div>
                                    <div><label style={labelStyle}>Ciudad</label><input style={inputStyle} value={af.ciudad} onChange={e=>{const n=[...afiliaciones];n[i].ciudad=e.target.value;setAfiliaciones(n)}} /></div>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setAfiliaciones(prev=>[...prev,{nro:'',gremio:'',desde_anio:'',ciudad:''}])} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px dashed rgba(0,174,239,0.4)', background: 'rgba(0,174,239,0.06)', color: '#00AEEF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px' }}>
                            + Afiliación
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation bottom */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <button onClick={() => setSection(s => Math.max(0, s-1))} disabled={section === 0} style={{ padding: '14px 24px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: section === 0 ? 'rgba(255,255,255,0.2)' : 'white', cursor: section === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '14px' }}>
                    ← Anterior
                </button>
                {section < SECTIONS.length - 1 ? (
                    <button onClick={() => setSection(s => s+1)} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#00AEEF,#0077D4)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px' }}>
                        Siguiente →
                    </button>
                ) : (
                    <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: 'none', background: saving ? 'rgba(52,199,89,0.3)' : 'linear-gradient(135deg,#34C759,#30D158)', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 20px rgba(52,199,89,0.35)' }}>
                        {saving ? 'Guardando…' : '✓ Guardar Cambios'}
                    </button>
                )}
            </div>
        </div>
    );
}
