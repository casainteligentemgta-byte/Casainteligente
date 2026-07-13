-- ══════════════════════════════════════════════════════════════
-- TABLA: contracts
-- Propósito: Contratos de Administración Delegada.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contracts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- A. Datos del Cliente
    client_name                 TEXT NOT NULL,
    client_ci                   TEXT NOT NULL,
    client_email                TEXT NOT NULL,

    -- B. Condiciones Financieras
    project_cost                NUMERIC(14, 2) NOT NULL CHECK (project_cost > 0),
    discount_amount             NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    fee_percentage              NUMERIC(5, 2) NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    monthly_min_fee             NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (monthly_min_fee >= 0),
    working_capital             NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (working_capital >= 0),
    payroll_guarantee_weeks     INTEGER NOT NULL DEFAULT 0 CHECK (payroll_guarantee_weeks >= 0),

    -- C. Alcance Técnico
    substitution_target         TEXT NOT NULL,
    salvage_target              TEXT NOT NULL,

    -- D. Plazos
    contract_deadline_months    INTEGER NOT NULL CHECK (contract_deadline_months >= 1),

    -- Persistencia
    pdf_url                     TEXT,
    status                      TEXT NOT NULL DEFAULT 'generado'
                                CHECK (status IN ('borrador', 'generado', 'firmado', 'caducado')),

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contracts_discount_lte_cost CHECK (discount_amount <= project_cost)
);

CREATE INDEX IF NOT EXISTS idx_contracts_client_ci ON public.contracts(client_ci);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts(created_at DESC);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_admin_all"
    ON public.contracts FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contracts_updated_at ON public.contracts;
CREATE TRIGGER trigger_contracts_updated_at
    BEFORE UPDATE ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();
