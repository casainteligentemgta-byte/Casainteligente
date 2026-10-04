# Fotos de modelos de cámara (NetVision)

La ficha de cada cámara en la **presentación al cliente** (`/nexus/vision/cliente`)
muestra la foto del modelo arriba a la derecha. Si el modelo no tiene foto, se
dibuja una silueta según su forma (domo, bala o PTZ).

## Cómo añadir una foto

1. Guarda la imagen en esta carpeta con el `id` del modelo como nombre,
   por ejemplo `ezviz-h9c.webp` (también valen `.png` y `.jpg`).
   - Cuadrada, mínimo 400 × 400 px, fondo blanco o transparente.
2. En `data/netvision/equipment.json`, añade `imageUrl` a ese modelo:

   ```json
   { "id": "ezviz-h9c", "brand": "Ezviz", "name": "H9c Dual 2K", "imageUrl": "/netvision/camaras/ezviz-h9c.webp" }
   ```

Todas las cámaras del plano que usen ese modelo comparten la misma foto.
`imageUrl` también acepta una URL absoluta (por ejemplo, de Supabase Storage).
