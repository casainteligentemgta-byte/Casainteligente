# Parche: fecha de foto frontal bajo «Inspección fotográfica»

## Contexto

Este cambio corresponde a **AGENTEIA** (`apps/smartaller`), desplegado en
[smarttaller.xyz](https://smarttaller.xyz). El agente Cloud estaba vinculado a
**Casainteligente** (sin permiso de push a AGENTEIA), por eso el parche se
publica aquí para aplicarlo en el repo correcto.

## Comportamiento

Al **tomar o subir la foto frontal** en Inspección fotográfica:

1. Se lee la fecha EXIF (`DateTimeOriginal` / `DateTime`) o, si no hay, `lastModified`.
2. Se muestra debajo del título **Inspección fotográfica** (formato `es-VE`).
3. Se persiste en `documentos.foto_frontal.captured_at`.

## Aplicar en AGENTEIA

```bash
cd /ruta/a/AGENTEIA
git apply patches/AGENTEIA-fecha-foto-frontal/0001-feat-smartaller-mostrar-fecha-de-la-foto-frontal-baj.patch
# o bien:
git am < patches/AGENTEIA-fecha-foto-frontal/0001-feat-smartaller-mostrar-fecha-de-la-foto-frontal-baj.patch
```

Archivos tocados:

- `apps/smartaller/lib/importacion/fecha-foto.ts` (nuevo)
- `apps/smartaller/lib/importacion/__tests__/fecha-foto.test.ts` (nuevo)
- `apps/smartaller/lib/schemas/vehiculo-documentos.ts`
- `apps/smartaller/lib/vehiculos/upload-documento.ts`
- `apps/smartaller/app/actions/nfc/importacion-vehiculo.ts`
- `apps/smartaller/components/nfc/ImportDocumentoUpload.tsx`
- `apps/smartaller/components/nfc/LlegadaRevisionSections.tsx`

## Verificación

```bash
cd apps/smartaller
npx tsx --test lib/importacion/__tests__/fecha-foto.test.ts
```

También: en la planilla de importación → fase Inspección → subir foto frontal
y confirmar que la fecha aparece bajo el título.
