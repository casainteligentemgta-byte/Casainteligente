# Cambiar la llave maestra de Supabase

## Por qué

La llave de servicio (`service_role`) de Supabase quedó escrita en archivos de este
repositorio, que es público. Con ella cualquiera puede leer, cambiar y borrar **toda** la
base, saltándose los permisos: es la única puerta que queda abierta después de cerrar
tablas y rutas. Borrarla de los archivos no basta porque sigue en el historial de git.
Hay que dejarla sin efecto.

La llave antigua no se puede cambiar sola: está atada a un secreto compartido con la
llave pública. Supabase ofrece llaves nuevas que sí se pueden crear y revocar por
separado. El cambio es pasar el sitio a las llaves nuevas y apagar las antiguas.

## Orden (no saltar pasos)

Cada paso se puede deshacer, salvo el último.

| # | Quién | Qué | Cómo se deshace |
| --- | --- | --- | --- |
| 1 | Dueño | Crear la llave secreta nueva y guardarla en Vercel como `SUPABASE_SECRET_KEY` | Borrar esa variable |
| 2 | Claude | Publicar una vista previa y comprobar que el servidor trabaja con la llave nueva | — |
| 3 | Claude | Publicar en producción y comprobar | Borrar la variable y volver a publicar |
| 4 | Claude + dueño | Cambiar la llave pública del sitio por la «publicable» nueva; el dueño entra con su usuario y confirma que todo se ve | Volver a poner la anterior |
| 5 | Dueño | Desactivar las llaves antiguas en Supabase | Reactivarlas en la misma pantalla |
| 6 | Dueño | Cambiar y revocar el secreto antiguo de firmas | No se deshace |

### Paso 1 — crear la llave nueva (dueño)

1. Supabase → proyecto → **Settings → API Keys** → pestaña **Publishable and secret API
   keys**.
2. En «Secret keys», crear una (nombre sugerido: `vercel`) y copiarla. Empieza por
   `sb_secret_`. No pegarla en chats ni correos.
3. Vercel → proyecto `casainteligente` → **Settings → Environment Variables** → añadir:
   - Nombre: `SUPABASE_SECRET_KEY`
   - Valor: la llave copiada
   - Entornos: **Production** y **Preview**
   - Marcarla como «Sensitive»
4. Avisar: «Listo llave».

No hay que tocar `SUPABASE_SERVICE_ROLE_KEY`: el sitio usa la nueva si existe
(`lib/supabase/resolveServiceRoleKey.ts`) y la anterior queda de respaldo.

### Pasos 2 y 3 — comprobar (Claude)

`GET /api/health/llaves` dice qué clase de llave usa cada despliegue, sin mostrar valores:

```json
{ "ok": true, "servidor": "nueva", "publica": "antigua", "listoParaDesactivarAntiguas": false }
```

En la vista previa se corre además el bot de ensayo, que usa la llave del servidor de
punta a punta.

### Paso 4 — llave pública (Claude + dueño)

La llave pública no es secreta (viaja en el navegador). Se cambia el valor de
`NEXT_PUBLIC_SUPABASE_ANON_KEY` por la publicable (`sb_publishable_…`) y se publica.
El dueño entra con su usuario y revisa una pantalla de cada módulo. Quien tenga el sitio
abierto debe recargar la página.

### Paso 5 — desactivar las antiguas (dueño)

Solo cuando `/api/health/llaves` responda `"listoParaDesactivarAntiguas": true` en
producción.

Supabase → **Settings → API Keys** → pestaña de las llaves antiguas (la que dice «Legacy») →
desactivarlas. Es el remedio que Supabase indica para una llave antigua filtrada, y es
reversible. A partir de aquí la llave expuesta deja de servir como llave de acceso.

Los scripts de `scripts/` y los archivos de prueba que usen la llave antigua dejan de
funcionar hasta ponerles la nueva en `.env.local`.

### Paso 6 — secreto de firmas (dueño)

La llave expuesta es además un pase firmado con el secreto antiguo del proyecto, válido
hasta 2036. Para invalidarlo del todo:

Supabase → **Settings → JWT Keys** → **Migrate JWT secret** → **Rotate keys** → esperar
al menos 1 hora y 15 minutos (para no cerrar la sesión de nadie) → mover el secreto
antiguo de «Previously used» a **Revoked**.

Supabase exige haber hecho el paso 5 antes de revocar.

## Qué se hizo ya en el código

- Las llaves salieron de los 18 archivos de prueba; ahora las leen del entorno.
- `lib/supabase/sinLlavesEnRepo.test.ts` falla si vuelve a aparecer una llave de servicio.
- El servidor prefiere `SUPABASE_SECRET_KEY` y todas las partes la leen por el mismo sitio.
