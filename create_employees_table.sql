-- ══════════════════════════════════════════════════════════════
-- MÓDULO EMPLEADOS — Casa Inteligente CRM
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.employees (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Datos Personales ──────────────────────────────────────
    foto_url                    TEXT,
    nombres                     TEXT NOT NULL,
    apellidos                   TEXT NOT NULL,
    cedula                      TEXT UNIQUE NOT NULL,
    rif                         TEXT,
    fecha_nacimiento            DATE,
    estado_civil                TEXT,
    nacionalidad                TEXT DEFAULT 'Venezolano/a',
    hijos                       INTEGER DEFAULT 0,
    direccion                   TEXT,
    ciudad                      TEXT,
    estado                      TEXT,
    telefono_habitacion         TEXT,
    celular                     TEXT,
    email                       TEXT,

    -- ── Información Laboral ───────────────────────────────────
    cargo                       TEXT,
    departamento                TEXT,
    fecha_ingreso               DATE,
    salario                     DECIMAL(15,2),
    estatus                     TEXT DEFAULT 'activo'
                                    CHECK (estatus IN ('activo','inactivo','permiso','vacaciones')),
    cuenta_bancaria             TEXT,
    banco                       TEXT,
    ivss                        TEXT,
    pretension_salarial         DECIMAL(15,2),
    disponibilidad              TEXT,
    areas_interes               JSONB DEFAULT '[]',

    -- ── Formación Académica (array JSONB) ─────────────────────
    -- Cada objeto: {tipo, institucion, ciudad, anio, titulo}
    estudios                    JSONB DEFAULT '[]',
    -- {semestre, instituto, carrera}
    estudios_actuales           JSONB,

    -- ── Experiencia Laboral (array JSONB) ─────────────────────
    -- Cada objeto: {desde, hasta, empresa, cargo, ciudad, ultimo_salario, supervisor, motivo_retiro}
    experiencia                 JSONB DEFAULT '[]',

    -- ── Cursos (array JSONB) ──────────────────────────────────
    -- Cada objeto: {anio, nombre, ciudad, organizado_por}
    cursos                      JSONB DEFAULT '[]',

    -- ── Conocimientos Software ───────────────────────────────
    software_windows            TEXT DEFAULT 'Ninguno',
    software_word               TEXT DEFAULT 'Ninguno',
    software_excel              TEXT DEFAULT 'Ninguno',
    software_powerpoint         TEXT DEFAULT 'Ninguno',
    software_admin              TEXT DEFAULT 'Ninguno',
    software_internet           TEXT DEFAULT 'Ninguno',

    -- ── Idiomas (array JSONB) ─────────────────────────────────
    -- Cada objeto: {idioma, nivel}
    idiomas                     JSONB DEFAULT '[]',

    -- ── Áreas Específicas ─────────────────────────────────────
    areas_conocimiento          TEXT,

    -- ── Datos Médicos ─────────────────────────────────────────
    tipo_sangre                 TEXT
                                    CHECK (tipo_sangre IN ('A+','A-','B+','B-','AB+','AB-','O+','O-') OR tipo_sangre IS NULL),
    enfermedades                TEXT,
    alergias                    TEXT,
    tratamientos                TEXT,
    certificado_medico_url      TEXT,
    certificado_medico_grado    TEXT,
    certificado_medico_vencimiento DATE,

    -- ── Vehículo & Documentos ────────────────────────────────
    vehiculo_propio             BOOLEAN DEFAULT false,
    vehiculo_marca              TEXT,
    vehiculo_anio               INTEGER,
    licencia_grado              TEXT,
    licencia_vencimiento        DATE,
    licencia_url                TEXT,
    infracciones                TEXT,
    accidentes                  TEXT,
    medio_transporte            TEXT,

    -- ── Referencias Personales (array JSONB) ─────────────────
    -- Cada objeto: {nexo, nombre, profesion, telefono}
    referencias                 JSONB DEFAULT '[]',

    -- ── Afiliaciones a Gremios (array JSONB) ─────────────────
    -- Cada objeto: {nro, gremio, desde_anio, ciudad}
    afiliaciones                JSONB DEFAULT '[]',

    -- ── Timestamps ───────────────────────────────────────────
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_estatus  ON public.employees(estatus);
CREATE INDEX IF NOT EXISTS idx_employees_cedula   ON public.employees(cedula);
CREATE INDEX IF NOT EXISTS idx_employees_apellidos ON public.employees(apellidos);

-- ── Auto-actualizar updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_employees_updated_at ON public.employees;
CREATE TRIGGER trigger_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION update_employees_updated_at();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden hacer todo
CREATE POLICY "employees_authenticated_all"
    ON public.employees
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- ¡Listo! Ejecuta este SQL en Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════
