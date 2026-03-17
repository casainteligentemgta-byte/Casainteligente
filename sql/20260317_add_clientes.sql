-- 1. TABLA CLIENTES
CREATE TABLE IF NOT EXISTS tb_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Empresa', -- Empresa, Residencial
    email VARCHAR(255),
    telefono VARCHAR(50),
    direccion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. FK EN PROYECTOS
-- Ya la habíamos agregado como id_cliente UUID pero sin la restricción de llave foránea. Vamos a agregarla:
ALTER TABLE tb_proyectos
    ADD CONSTRAINT fk_cliente
    FOREIGN KEY (id_cliente)
    REFERENCES tb_clientes(id)
    ON DELETE SET NULL;
