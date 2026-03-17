-- Hierarchy for categories
CREATE TABLE IF NOT EXISTS material_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES material_categories(id),
    level INTEGER NOT NULL, -- 1: Principal, 2: Subfamilia, 3: Tipo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Master Inventory
CREATE TABLE IF NOT EXISTS global_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sap_code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES material_categories(id),
    unit TEXT NOT NULL, -- UND, M3, KG, etc.
    stock_available DECIMAL(15,2) DEFAULT 0,
    stock_quarantine DECIMAL(15,2) DEFAULT 0,
    reorder_point DECIMAL(15,2) DEFAULT 0,
    average_weighted_cost DECIMAL(15,2) DEFAULT 0,
    location TEXT, -- Pasillo/Estante
    image_url TEXT,
    last_purchase_date TIMESTAMP WITH TIME ZONE,
    last_purchase_price DECIMAL(15,2),
    last_supplier_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Procurement / Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    supplier_rif TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    date DATE NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, COMPLETADO, CANCELADO
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    material_id UUID REFERENCES global_inventory(id),
    quantity DECIMAL(15,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality Inspection (Staging)
CREATE TABLE IF NOT EXISTS quality_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES purchase_invoices(id),
    material_id UUID REFERENCES global_inventory(id),
    quantity DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, RECHAZADO
    remarks TEXT,
    purchase_detail_id UUID REFERENCES purchase_details(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    inspected_at TIMESTAMP WITH TIME ZONE,
    inspector_id UUID -- References auth.users(id)
);

-- Kardex (Movements)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES global_inventory(id),
    movement_type_code TEXT NOT NULL, -- 101, 201, 311, 501, 601
    quantity DECIMAL(15,2) NOT NULL,
    previous_stock DECIMAL(15,2),
    new_stock DECIMAL(15,2),
    previous_cost DECIMAL(15,2),
    new_cost DECIMAL(15,2),
    reference_id UUID,
    user_id UUID, -- References auth.users(id)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (Basic examples, should be refined)
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated Read" ON material_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Read" ON global_inventory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Read" ON purchase_invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Read" ON purchase_details FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Read" ON quality_inspections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Read" ON inventory_movements FOR SELECT USING (auth.role() = 'authenticated');

-- All other operations (INSERT, UPDATE) also for authenticated, but you might want to restrict to specific roles.
CREATE POLICY "Allow authenticated Insert" ON material_categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Insert" ON global_inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Insert" ON purchase_invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Insert" ON purchase_details FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Insert" ON quality_inspections FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated Insert" ON inventory_movements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
