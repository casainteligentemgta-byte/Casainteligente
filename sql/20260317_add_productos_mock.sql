-- INSERTAR PRODUCTOS MAESTROS DE EJEMPLO
INSERT INTO tb_productos_base (categoria, marca, modelo_sku, descripcion_comercial, costo_usd, precio_lista, unidad_medida)
VALUES
('CCTV', 'Hikvision', 'HIK-CAM-1080P-01', 'Cámara Bullet 1080p Lente Fijo 2.8mm IR 20m', 25.00, 45.00, 'Pza'),
('CCTV', 'Dahua', 'DAH-NVR-4CH-02', 'NVR 4 Canales Soporta hasta 8MP', 85.00, 150.00, 'Pza'),
('Domótica', 'Sonoff', 'SON-MINIR4-03', 'Switch Inteligente Mini R4 WiFi Extreme', 9.50, 18.00, 'Pza'),
('Domótica', 'Control4', 'C4-CORE1-04', 'Controlador Principal CORE 1', 650.00, 950.00, 'Pza'),
('Redes', 'Ubiquiti', 'UBI-U6-LITE-05', 'Access Point UniFi 6 Lite Indoor', 110.00, 180.00, 'Pza'),
('Redes', 'Tapo', 'TAPO-P100-06', 'Enchufe Inteligente Mini Smart Wi-Fi', 12.00, 22.00, 'Pza'),
('Cableado', 'Condumex', 'CON-UTP-CAT6-100', 'Cable UTP Cat 6 100% Cobre', 145.00, 210.00, 'Rollo')
ON CONFLICT (modelo_sku) DO NOTHING;
