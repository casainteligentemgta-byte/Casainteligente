# Prompt para Antigravity — aplicar Supabase en app_administracion_delegada_v4.py

Pega esto en Antigravity **con el archivo `app_administracion_delegada_v4.py` abierto**
y con `db_supabase.py` copiado al mismo directorio.

```
Modifica el archivo app_administracion_delegada_v4.py para reemplazar la conexión
de base de datos SQLite local por una conexión a Supabase (PostgreSQL).

Sigue estas directrices ESTRICTAS:

1. Método de conexión
   - Usa el módulo local db_supabase.py (ya existe en el proyecto).
   - Preferir psycopg2 vía get_db() / get_connection() para transacciones Streamlit.
   - El cliente supabase-py queda disponible como db.client si hace falta.

2. Credenciales
   - Leer SOLO desde st.secrets:
       st.secrets["supabase"]["url"]
       st.secrets["supabase"]["key"]
       st.secrets["supabase"]["database_url"]
   - No hardcodear URL ni keys en el .py.

3. Caché de seguridad
   - NO elimines la lógica de .session_database.csv.
   - Debe seguir como respaldo offline si falla internet.
   - Usar db.load_transacciones_with_fallback() y db.cache.upsert_rows / db.upsert
     (merge por id, nunca truncar el CSV a ciegas).

4. Estabilidad de IDs
   - PROHIBIDO: DELETE FROM masivo de transacciones (u otras tablas) para “refrescar”.
   - Al guardar: UPSERT / ON CONFLICT (id) con el ID de cada fila.
   - Esos IDs son los que Casa Inteligente usa como origen_v4_id.

5. Compatibilidad PostgreSQL
   - Placeholders: %s (no ?).
   - Fechas: normalizar con pg_date() o ISO YYYY-MM-DD.
   - Concatenación: pg_concat(...) o COALESCE(x::text,'') || ...
   - Catálogos: comparar con UPPER(columna) cuando haga falta.
   - date('now') → CURRENT_DATE ; datetime('now') → NOW().

6. Alcance
   - Cambia solo la capa de datos / SQL.
   - No reescribas la UI Streamlit completa.
   - Conserva nombres de funciones públicas si otros módulos las importan.
   - Al terminar, lista: archivos tocados, llamadas sqlite eliminadas, y cómo probar
     online vs offline (desconectando red y verificando .session_database.csv).

Importa así al inicio:
    from db_supabase import get_db, pg_date, pg_concat, pg_upper
    db = get_db(cache_path=".session_database.csv")

Responde en español (Venezuela).
```
