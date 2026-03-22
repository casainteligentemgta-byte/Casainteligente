-- ═══════════════════════════════════════════════════════════
-- INVENTARIO AVANZADO — CASA INTELIGENTE
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. Agregar campos faltantes a global_inventory
ALTER TABLE global_inventory
    ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS alert_threshold INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS supplier_name TEXT,
    ADD COLUMN IF NOT EXISTS supplier_contact TEXT;

-- 2. Agregar campo 'reason' y 'notes' a inventory_movements
ALTER TABLE inventory_movements
    ADD COLUMN IF NOT EXISTS reason TEXT,        -- 'compra', 'venta', 'ajuste', 'merma', 'devolucion'
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS performed_by TEXT;  -- nombre del usuario

-- 3. Crear tabla de alertas de inventario
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES global_inventory(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,   -- 'STOCK_BAJO', 'SIN_STOCK', 'CUARENTENA'
    threshold_value DECIMAL(15,2),
    current_value DECIMAL(15,2),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_inventory_movements_material ON inventory_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type_code);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_material ON inventory_alerts(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_resolved ON inventory_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_global_inventory_active ON global_inventory(is_active);
CREATE INDEX IF NOT EXISTS idx_global_inventory_category ON global_inventory(category_name);

-- 5. RLS para inventory_alerts
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow authenticated full access alerts"
    ON inventory_alerts FOR ALL USING (auth.role() = 'authenticated');

-- 6. Políticas UPDATE para tablas existentes (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename='global_inventory' AND policyname='Allow authenticated Update'
    ) THEN
        CREATE POLICY "Allow authenticated Update" ON global_inventory
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename='inventory_movements' AND policyname='Allow authenticated Insert movements'
    ) THEN
        CREATE POLICY "Allow authenticated Insert movements" ON inventory_movements
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename='inventory_movements' AND policyname='Allow authenticated Read movements'
    ) THEN
        CREATE POLICY "Allow authenticated Read movements" ON inventory_movements
            FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- DATOS DE EJEMPLO — 10 productos reales de Casa Inteligente
-- ═══════════════════════════════════════════════════════════
INSERT INTO global_inventory (sap_code, name, category_name, unit, stock_available, reorder_point, alert_threshold, average_weighted_cost, location, supplier_name)
VALUES
  ('DOM-001', 'Control Remoto Universal Z-Wave', 'Domótica', 'UND', 12, 5, 5, 45.00, 'A-01', 'TechDistrib CA'),
  ('DOM-002', 'Hub Central SmartHome Pro', 'Domótica', 'UND', 3, 5, 5, 189.00, 'A-02', 'TechDistrib CA'),
  ('CAM-001', 'Cámara IP 4K Interior', 'Seguridad', 'UND', 8, 4, 3, 95.00, 'B-01', 'SecureCam VE'),
  ('CAM-002', 'Cámara PTZ Exterior 360°', 'Seguridad', 'UND', 2, 3, 3, 220.00, 'B-02', 'SecureCam VE'),
  ('ILU-001', 'Bombillo LED Inteligente RGB', 'Iluminación', 'UND', 45, 20, 15, 12.50, 'C-01', 'LuzSmart'),
  ('ILU-002', 'Panel LED Empotrado WiFi', 'Iluminación', 'UND', 0, 10, 8, 38.00, 'C-02', 'LuzSmart'),
  ('SEN-001', 'Sensor de Movimiento PIR', 'Sensores', 'UND', 25, 10, 8, 18.00, 'D-01', 'SensorPro'),
  ('SEN-002', 'Sensor de Humo + Temperatura', 'Sensores', 'UND', 7, 5, 5, 35.00, 'D-02', 'SensorPro'),
  ('AUT-001', 'Switch Inteligente 2 Canales', 'Automatización', 'UND', 18, 8, 8, 28.00, 'E-01', 'AutoHome'),
  ('AUT-002', 'Termostato WiFi Programable', 'Automatización', 'UND', 4, 6, 5, 75.00, 'E-02', 'AutoHome');
