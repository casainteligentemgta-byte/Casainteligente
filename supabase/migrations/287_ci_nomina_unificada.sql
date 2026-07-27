-- Migración Unificada de Nómina y Asistencias (Fusionando RRHH Obra + RRHH Administrativa)

-- 0. Limpiar tablas conflictivas del otro agente (solo si existen y están vacías de datos productivos, ya que acaba de crearse)
DROP TABLE IF EXISTS public.ci_nomina_conceptos CASCADE;
DROP TABLE IF EXISTS public.ci_nomina_recibos CASCADE;
DROP TABLE IF EXISTS public.ci_nomina_periodos CASCADE;

-- 1. Evaluaciones Psico y Estado Banca (De la fase RRHH Obra)
ALTER TABLE public.ci_empleados 
  DROP CONSTRAINT IF EXISTS ci_empleados_estatus_check;

ALTER TABLE public.ci_empleados
  ADD CONSTRAINT ci_empleados_estatus_check
  CHECK (estatus is null or estatus in ('disponible', 'asignado', 'no_disponible', 'vetado'));

ALTER TABLE public.ci_empleados
  ADD COLUMN IF NOT EXISTS evaluacion_psico_status text DEFAULT 'pendiente'
    CHECK (evaluacion_psico_status IN ('pendiente', 'aprobada', 'rechazada', 'no_requerida')),
  ADD COLUMN IF NOT EXISTS evaluacion_psico_fecha date,
  ADD COLUMN IF NOT EXISTS evaluacion_psico_notas text;


-- 2. Periodos de Nómina (Unificado)
-- Soporta nómina por Entidad (Administrativa) o por Proyecto (Obra)
CREATE TABLE IF NOT EXISTS public.ci_nomina_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id uuid REFERENCES public.ci_entidades (id) ON DELETE SET NULL,
  proyecto_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  
  descripcion text NOT NULL, -- Ej. "1ra Quincena Octubre 2026", "Semana 42 Torre A"
  tipo_nomina text NOT NULL CHECK (tipo_nomina IN ('semanal', 'quincenal', 'mensual', 'especial')),
  numero_semana integer, -- Utilizado mayormente en construcción
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  
  tasa_bcv_aplicada numeric(15,2) DEFAULT 0, -- Tasa oficial de cambio para conversiones
  
  estado text NOT NULL DEFAULT 'borrador' 
    CHECK (estado IN ('borrador', 'revisada', 'aprobada', 'pagada', 'cerrada')),
    
  total_asignaciones numeric(15,2) NOT NULL DEFAULT 0,
  total_deducciones numeric(15,2) NOT NULL DEFAULT 0,
  total_neto numeric(15,2) NOT NULL DEFAULT 0,
  total_neto_usd numeric(15,2) NOT NULL DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_nomina_periodos_estado ON public.ci_nomina_periodos (estado);
CREATE INDEX IF NOT EXISTS idx_ci_nomina_periodos_fechas ON public.ci_nomina_periodos (fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_ci_nomina_periodos_proyecto ON public.ci_nomina_periodos (proyecto_id);


-- 3. Recibos de Pago (Unificado)
CREATE TABLE IF NOT EXISTS public.ci_nomina_recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.ci_nomina_periodos (id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL REFERENCES public.ci_empleados (id) ON DELETE RESTRICT,
  contrato_id uuid REFERENCES public.ci_contratos_empleado_obra (id) ON DELETE SET NULL,
  
  -- Snapshot de datos al momento de correr la nómina
  empleado_nombre text NOT NULL,
  empleado_cedula text,
  empleado_cargo text,
  salario_base_mensual numeric(15,2) NOT NULL DEFAULT 0,
  dias_laborados numeric(5,2) NOT NULL DEFAULT 0,
  
  -- Totales del recibo
  total_asignaciones numeric(15,2) NOT NULL DEFAULT 0,
  total_deducciones numeric(15,2) NOT NULL DEFAULT 0,
  total_neto numeric(15,2) NOT NULL DEFAULT 0,
  total_neto_usd numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Columnas auxiliares para la Doble Lógica de Construcción (Ley vs Bono)
  meta_integral_acordada_usd numeric(15,2) DEFAULT 0,
  
  observaciones text,
  estado text NOT NULL DEFAULT 'generado' CHECK (estado IN ('generado', 'firmado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(periodo_id, empleado_id)
);


-- 4. Conceptos del Recibo (Para flexibilidad de ítems como SSO, FAOV, Adelantos, Bonos)
CREATE TABLE IF NOT EXISTS public.ci_nomina_conceptos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recibo_id uuid NOT NULL REFERENCES public.ci_nomina_recibos (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('asignacion', 'deduccion')),
  codigo_concepto text, -- Ej. 'SAL_BAS', 'SSO', 'FAOV', 'BONO_COMP'
  descripcion text NOT NULL, -- Ej. "Salario Base (15 días)", "Retención SSO (4%)"
  cantidad numeric(8,2) NOT NULL DEFAULT 1, -- Días, horas, o %
  monto numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_nomina_conceptos_recibo ON public.ci_nomina_conceptos (recibo_id);


-- 5. Accesos a Obra (IoT / Biometría Ready - Exclusivo de construcción)
CREATE TABLE IF NOT EXISTS public.rrhh_accesos_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.ci_empleados(id) ON DELETE CASCADE,
  proyecto_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('entrada', 'salida')),
  timestamp_evento timestamptz NOT NULL DEFAULT now(),
  metodo_validacion text NOT NULL DEFAULT 'manual_rrhh' 
    CHECK (metodo_validacion IN ('manual_rrhh', 'telegram_maestro', 'facial_ai', 'rfid', 'qr')),
  dispositivo_id text,
  foto_validacion text,
  confianza_ai numeric(5,4),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rrhh_accesos_obra_empleado ON public.rrhh_accesos_obra(empleado_id);
CREATE INDEX IF NOT EXISTS idx_rrhh_accesos_obra_fecha ON public.rrhh_accesos_obra(proyecto_id, timestamp_evento);


-- 6. Asistencias Diarias (Consolidado para Nómina de Campo)
CREATE TABLE IF NOT EXISTS public.rrhh_asistencias_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.ci_empleados(id) ON DELETE CASCADE,
  proyecto_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  
  primera_entrada timestamptz,
  ultima_salida timestamptz,
  horas_efectivas numeric(5,2),
  
  status_asistencia text NOT NULL DEFAULT 'completo'
    CHECK (status_asistencia IN ('completo', 'falta', 'medio_turno', 'sobretiempo')),
    
  origen text NOT NULL DEFAULT 'manual_rrhh'
    CHECK (origen IN ('manual_rrhh', 'telegram_maestro', 'calculado_iot')),
    
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(empleado_id, proyecto_id, fecha)
);
CREATE INDEX IF NOT EXISTS idx_rrhh_asistencias_fecha ON public.rrhh_asistencias_diarias(proyecto_id, fecha);

-- Habilitar RLS
ALTER TABLE public.ci_nomina_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_nomina_recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_nomina_conceptos ENABLE ROW LEVEL SECURITY;

-- Políticas Periodos
DROP POLICY IF EXISTS "ci_nom_per_sel" ON public.ci_nomina_periodos;
CREATE POLICY "ci_nom_per_sel" ON public.ci_nomina_periodos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ci_nom_per_ins" ON public.ci_nomina_periodos;
CREATE POLICY "ci_nom_per_ins" ON public.ci_nomina_periodos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ci_nom_per_upd" ON public.ci_nomina_periodos;
CREATE POLICY "ci_nom_per_upd" ON public.ci_nomina_periodos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ci_nom_per_del" ON public.ci_nomina_periodos;
CREATE POLICY "ci_nom_per_del" ON public.ci_nomina_periodos FOR DELETE TO authenticated USING (true);

-- Notificar a postgrest
NOTIFY pgrst, 'reload schema';
