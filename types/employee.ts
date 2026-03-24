export type EmployeeEstatus = 'activo' | 'inactivo' | 'permiso' | 'vacaciones'

export interface EmployeeStudy {
    tipo: string
    institucion: string
    ciudad: string
    anio: string
    titulo: string
}

export interface EmployeeExperience {
    desde: string
    hasta: string
    empresa: string
    cargo: string
    ciudad: string
    ultimo_salario: string
    supervisor: string
    motivo_retiro: string
}

export interface EmployeeCourse {
    anio: string
    nombre: string
    ciudad: string
    organizado_por: string
}

export interface EmployeeReference {
    nexo: string
    nombre: string
    profesion: string
    telefono: string
}

export interface EmployeeAffiliation {
    nro: string
    gremio: string
    desde_anio: string
    ciudad: string
}

export interface Employee {
    id: string
    nombres: string
    apellidos: string
    cedula: string
    rif?: string
    fecha_nacimiento: string | null
    estado_civil: string
    nacionalidad: string
    hijos: number
    direccion: string
    ciudad: string
    estado: string
    telefono_habitacion: string
    celular: string
    email: string
    foto_url: string | null
    cargo: string
    departamento: string
    fecha_ingreso: string | null
    salario: number | null
    pretension_salarial?: number | null
    estatus: EmployeeEstatus | string
    cuenta_bancaria: string
    banco: string
    ivss: string
    disponibilidad: string
    areas_interes: string[]
    tipo_sangre: string
    estudios: EmployeeStudy[]
    estudios_actuales: { semestre: string; instituto: string; carrera: string } | null
    experiencia: EmployeeExperience[]
    cursos: EmployeeCourse[]
    software_windows: string
    software_word: string
    software_excel: string
    software_internet: string
    idiomas: { idioma: string; nivel: string }[]
    areas_conocimiento: string
    enfermedades: string
    alergias: string
    tratamientos: string
    certificado_medico_grado: string
    certificado_medico_vencimiento: string | null
    vehiculo_propio: boolean
    vehiculo_marca: string
    vehiculo_anio: number | null
    licencia_grado: string
    licencia_vencimiento: string | null
    infracciones: string
    accidentes: string
    medio_transporte: string
    referencias: EmployeeReference[]
    afiliaciones: EmployeeAffiliation[]
    created_at?: string
    updated_at?: string
}
