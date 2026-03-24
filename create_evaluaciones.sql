-- ══════════════════════════════════════════════════════════════
-- MÓDULO: Evaluación de Personal de Élite – Casa Inteligente
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.evaluaciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    employee_name       TEXT NOT NULL,
    token               TEXT UNIQUE NOT NULL,

    -- TTL del link (15 min desde creación)
    link_expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Estado
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','started','completed','expired')),

    -- Tiempos del test
    started_at          TIMESTAMP WITH TIME ZONE,
    test_deadline       TIMESTAMP WITH TIME ZONE,   -- started_at + 15 min
    completed_at        TIMESTAMP WITH TIME ZONE,

    -- Seguridad
    tab_changes         INTEGER NOT NULL DEFAULT 0,
    ip_address          TEXT,

    -- Resultados crudos
    answers             JSONB,                      -- [0,2,1,3,...] índice de opción por pregunta

    -- Scores DISC (conteo de respuestas por dimensión)
    disc_d              INTEGER DEFAULT 0,
    disc_i              INTEGER DEFAULT 0,
    disc_s              INTEGER DEFAULT 0,
    disc_c              INTEGER DEFAULT 0,

    -- Scores oscuros (0–7 PSY, 0–9 NAR, 0–6 IRR)
    dark_psy            FLOAT DEFAULT 0,
    dark_nar            FLOAT DEFAULT 0,
    dark_irr            FLOAT DEFAULT 0,

    -- Resultado final
    dominant_disc       TEXT,                       -- D|I|S|C
    color_perfil        TEXT,                       -- rojo|amarillo|verde|azul
    risk_score          FLOAT DEFAULT 0,            -- 0–100
    semaforo            TEXT,                       -- verde|amarillo|rojo

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_evaluaciones_token     ON public.evaluaciones(token);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_employee  ON public.evaluaciones(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_status    ON public.evaluaciones(status);

-- RLS
ALTER TABLE public.evaluaciones ENABLE ROW LEVEL SECURITY;

-- Admins autenticados: acceso total
CREATE POLICY "eval_authenticated_all"
    ON public.evaluaciones FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Públicos (candidatos): solo pueden leer/actualizar evaluaciones
-- que NO estén completadas ni expiradas y cuyo link no haya vencido.
-- El filtro por token lo aplica el cliente via .eq('token', ...),
-- pero RLS restringe el alcance a filas activas únicamente.
CREATE POLICY "eval_public_token_read"
    ON public.evaluaciones FOR SELECT TO anon
    USING (
        status IN ('pending', 'started')
        AND link_expires_at > NOW()
    );

CREATE POLICY "eval_public_token_update"
    ON public.evaluaciones FOR UPDATE TO anon
    USING (
        status IN ('pending', 'started')
        AND link_expires_at > NOW()
    )
    WITH CHECK (
        status IN ('pending', 'started', 'completed', 'expired')
    );

-- NOTA DE SEGURIDAD: Para máxima protección, considere reemplazar el acceso
-- directo a la tabla con funciones RPC (security definer) que reciban el token
-- como parámetro y validen internamente. Eso impide que un usuario anónimo
-- enumere evaluaciones activas sin conocer el token.
