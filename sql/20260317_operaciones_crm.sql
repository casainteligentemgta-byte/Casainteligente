-- OPERACIONES, CRM Y DASHBOARD SQL MIGRATION FILE

-- 1. ENUMS
CREATE TYPE estado_herramienta AS ENUM ('Disponible', 'En Obra', 'Mantenimiento');
CREATE TYPE estado_obra_proyecto AS ENUM ('Cotizacion', 'Ejecucion', 'Finalizado');
CREATE TYPE enum_tipo_gasto AS ENUM ('Mano de Obra', 'Viáticos', 'Material Extra');
CREATE TYPE enum_unidad_medida AS ENUM ('Pza', 'Metro', 'Rollo', 'Kit', 'Servicio', 'Licencia');

-- 2. TABLA INVENTARIO
CREATE TABLE IF NOT EXISTS tb_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    stock_actual INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 0,
    costo_promedio DECIMAL(12, 2) DEFAULT 0.00,
    precio_venta DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. PROYECTOS (EXTENSIÓN)
ALTER TABLE tb_proyectos
ADD COLUMN IF NOT EXISTS estado_obra estado_obra_proyecto DEFAULT 'Cotizacion',
ADD COLUMN IF NOT EXISTS id_cliente UUID, 
ADD COLUMN IF NOT EXISTS total_costo DECIMAL(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS utilidad DECIMAL(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_venta DECIMAL(12, 2) DEFAULT 0.00;

-- 4. HERRAMIENTAS
CREATE TABLE IF NOT EXISTS tb_herramientas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descripcion TEXT NOT NULL,
    estado estado_herramienta DEFAULT 'Disponible',
    id_tecnico_asignado UUID,
    id_proyecto_actual UUID REFERENCES tb_proyectos(id) ON DELETE SET NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. COMPRAS Y DETALLE TECNICO
CREATE TABLE IF NOT EXISTS tb_detalle_tecnico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_proyecto UUID NOT NULL REFERENCES tb_proyectos(id) ON DELETE CASCADE,
    numero_serial VARCHAR(100),
    ip_asignada VARCHAR(45), 
    usuario_acceso VARCHAR(100),
    password_acceso VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS tb_compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_inventario UUID NOT NULL REFERENCES tb_inventario(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    costo_unitario DECIMAL(12, 2) NOT NULL,
    fecha_compra TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    proveedor VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. GASTOS PROYECTO
CREATE TABLE IF NOT EXISTS tb_gastos_proyecto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_proyecto UUID NOT NULL REFERENCES tb_proyectos(id) ON DELETE CASCADE,
    tipo_gasto enum_tipo_gasto NOT NULL,
    monto DECIMAL(12, 2) NOT NULL CHECK (monto > 0),
    descripcion TEXT,
    fecha_gasto TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. PRODUCTOS BASE
CREATE TABLE tb_productos_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria VARCHAR(100) NOT NULL, 
    marca VARCHAR(100) NOT NULL,
    modelo_sku VARCHAR(150) UNIQUE NOT NULL, 
    descripcion_comercial TEXT NOT NULL,
    costo_usd DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (costo_usd >= 0),
    precio_lista DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (precio_lista >= 0),
    unidad_medida enum_unidad_medida DEFAULT 'Pza',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- INDICES
CREATE INDEX idx_productos_busqueda ON tb_productos_base (marca, categoria);
CREATE INDEX idx_productos_sku ON tb_productos_base (modelo_sku);

-- TRIGGERS
CREATE OR REPLACE FUNCTION procesar_compra_inventario()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tb_inventario
    SET 
        costo_promedio = CASE 
            WHEN (stock_actual + NEW.cantidad) > 0 THEN
               ((stock_actual * costo_promedio) + (NEW.cantidad * NEW.costo_unitario)) / (stock_actual + NEW.cantidad)
            ELSE NEW.costo_unitario
        END,
        stock_actual = stock_actual + NEW.cantidad,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.id_inventario;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registrar_compra
AFTER INSERT ON tb_compras
FOR EACH ROW EXECUTE FUNCTION procesar_compra_inventario();

CREATE OR REPLACE FUNCTION sumar_gasto_a_proyecto()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tb_proyectos
    SET total_costo = total_costo + NEW.monto,
        utilidad = total_venta - (total_costo + NEW.monto)
    WHERE id = NEW.id_proyecto;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_nuevo_gasto_proyecto
AFTER INSERT ON tb_gastos_proyecto
FOR EACH ROW EXECUTE FUNCTION sumar_gasto_a_proyecto();

-- VISTAS ANALITICAS
CREATE OR REPLACE VIEW vw_analisis_rentabilidad AS
SELECT 
    p.id as proyecto_id,
    p.nombre as proyecto_nombre,
    p.total_venta as total_facturado,
    p.total_costo as costo_total_operativo,
    (p.total_venta - p.total_costo) as utilidad_neta,
    EXTRACT(MONTH FROM p.created_at) as mes_creacion,
    CASE 
        WHEN p.total_venta > 0 THEN ROUND((((p.total_venta - p.total_costo) / p.total_venta) * 100)::numeric, 2)
        ELSE 0 
    END as margen_porcentaje
FROM tb_proyectos p;
