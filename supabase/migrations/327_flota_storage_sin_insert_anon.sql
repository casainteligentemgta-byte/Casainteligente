-- Seguridad: el bucket público `flota` no debe aceptar subidas anónimas.
-- Las subidas del módulo Flota se hacen con el cliente del servidor en sesión
-- (lib/flota/acceso.ts → subirArchivoFlota), es decir, como usuario autenticado.
-- Se conserva la lectura pública (getPublicUrl) y las políticas de authenticated.

drop policy if exists "flota insert anon" on storage.objects;
