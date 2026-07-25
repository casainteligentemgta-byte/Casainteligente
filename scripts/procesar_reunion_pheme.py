#!/usr/bin/env python3
"""
Agente Pheme — procesar reunión (Gemini → JSON → Postgres).

Equivalente en app:
  - lib/pheme/generarMinuta.ts → procesarReunionConPheme
  - POST /api/pheme/minuta
  - tabla ci_pheme_reuniones (migración 291)

Uso:
  export GEMINI_API_KEY=...
  export DATABASE_URL=postgresql://...   # o DB_NAME/DB_USER/...
  python scripts/procesar_reunion_pheme.py "Título" path/a/transcripcion.txt
"""

from __future__ import annotations

import json
import os
import sys

try:
    import psycopg2
    from psycopg2.extras import Json, RealDictCursor
except ImportError:
    print("Instala psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
    raise

try:
    from google import genai
except ImportError:
    print("Instala google-genai: pip install google-genai", file=sys.stderr)
    raise


# 1. Configuración de clientes y conexiones
def obtener_conexion_pg():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


# Inicializar el cliente de la API de Gemini (usa GEMINI_API_KEY)
client = genai.Client()

SYSTEM_PROMPT_PHEME = """
Eres Pheme, un agente inteligente especializado en escuchar, analizar y sintetizar transcripciones de reuniones y consultas.
Tu objetivo es extraer los puntos clave, acuerdos, compromisos asignados y devolver la información en formato JSON estricto.

Responde ÚNICAMENTE con un objeto JSON con la siguiente estructura exacta:
{
  "resumen_ejecutivo": "Síntesis breve de 2-3 oraciones sobre la reunión.",
  "puntos_clave": ["Punto 1", "Punto 2"],
  "acuerdos": [
    {"tarea": "Descripción de la tarea", "responsable": "Nombre", "fecha_limite": "YYYY-MM-DD o N/A"}
  ],
  "pendientes_o_alertas": ["Pendiente 1"]
}
"""


def _limpiar_json_gemini(texto: str) -> dict:
    """Limpiar fences ```json y parsear la respuesta."""
    resultado_str = (texto or "").strip()
    if resultado_str.startswith("```"):
        resultado_str = resultado_str.removeprefix("```json").removeprefix("```").strip()
        if resultado_str.endswith("```"):
            resultado_str = resultado_str[: -3].strip()
    return json.loads(resultado_str)


# 2. Función principal del agente Pheme
def procesar_reunion_con_pheme(titulo_reunion: str, transcripcion_texto: str) -> dict:
    prompt_usuario = (
        f"Procesa la siguiente transcripción de la reunión '{titulo_reunion}':\n\n"
        f"{transcripcion_texto}"
    )

    response = client.models.generate_content(
        model=os.getenv("GEMINI_PHEME_MODEL", "gemini-2.5-flash"),
        contents=prompt_usuario,
        config={"system_instruction": SYSTEM_PROMPT_PHEME},
    )

    resultado = _limpiar_json_gemini(response.text or "")
    return resultado


def guardar_reunion_pg(titulo_reunion: str, transcripcion_texto: str, minuta: dict) -> str:
    """INSERT en ci_pheme_reuniones; retorna id."""
    conn = obtener_conexion_pg()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO public.ci_pheme_reuniones (
                  titulo, transcripcion, resumen_ejecutivo,
                  puntos_clave, acuerdos, pendientes_o_alertas,
                  modelo, desde_gemini
                ) VALUES (
                  %s, %s, %s, %s, %s, %s, %s, true
                )
                RETURNING id
                """,
                (
                    titulo_reunion,
                    transcripcion_texto,
                    minuta.get("resumen_ejecutivo") or "",
                    Json(minuta.get("puntos_clave") or []),
                    Json(minuta.get("acuerdos") or []),
                    Json(minuta.get("pendientes_o_alertas") or []),
                    os.getenv("GEMINI_PHEME_MODEL", "gemini-2.5-flash"),
                ),
            )
            row = cur.fetchone()
            conn.commit()
            return str(row["id"])
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            'Uso: python scripts/procesar_reunion_pheme.py "Título" archivo.txt\n'
            '  o: python scripts/procesar_reunion_pheme.py "Título" --stdin < transcript.txt',
            file=sys.stderr,
        )
        sys.exit(1)

    titulo = sys.argv[1]
    fuente = sys.argv[2]
    if fuente == "--stdin":
        transcripcion = sys.stdin.read()
    else:
        with open(fuente, encoding="utf-8") as f:
            transcripcion = f.read()

    minuta = procesar_reunion_con_pheme(titulo, transcripcion)
    reunion_id = None
    try:
        reunion_id = guardar_reunion_pg(titulo, transcripcion, minuta)
    except Exception as exc:  # noqa: BLE001
        print(f"[aviso] No se pudo guardar en Postgres: {exc}", file=sys.stderr)

    print(
        json.dumps(
            {"reunion_id": reunion_id, "titulo_reunion": titulo, **minuta},
            indent=2,
            ensure_ascii=False,
        )
    )
