-- ══════════════════════════════════════════════════════
-- SQL para soportar el módulo de Procurement con IA
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. Campos adicionales en global_inventory para tracking de compras
ALTER TABLE global_inventory 
    ADD COLUMN IF NOT EXISTS last_purchase_price    NUMERIC(12,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_purchase_date     DATE,
    ADD COLUMN IF NOT EXISTS average_weighted_cost  NUMERIC(12,4) DEFAULT 0;

-- 2. Asegurar que purchase_invoices tenga el campo status
ALTER TABLE purchase_invoices
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDIENTE';

-- 3. Index para búsquedas de facturas por proveedor
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier
    ON purchase_invoices(supplier_name, date);

-- 4. Index en quality_inspections
CREATE INDEX IF NOT EXISTS idx_quality_inv_material
    ON quality_inspections(material_id, status);

-- 5. RLS para purchase_invoices (si no existe)
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'purchase_invoices' AND policyname = 'auth_purchase_invoices'
    ) THEN
        CREATE POLICY auth_purchase_invoices ON purchase_invoices
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 6. RLS para purchase_details
ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'purchase_details' AND policyname = 'auth_purchase_details'
    ) THEN
        CREATE POLICY auth_purchase_details ON purchase_details
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 7. RLS para quality_inspections
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'quality_inspections' AND policyname = 'auth_quality_inspections'
    ) THEN
        CREATE POLICY auth_quality_inspections ON quality_inspections
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

SELECT 'Procurement AI schema ready ✅' AS resultado;
