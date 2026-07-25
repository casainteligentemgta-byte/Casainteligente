#!/usr/bin/env python3
"""
Pheme — flujo completo:
  Audio → Transcripción con diarización → Minuta JSON → PostgreSQL (reuniones_pheme)

Equivalente en app:
  lib/pheme/procesarReunionDesdeAudio.ts
  POST /api/pheme/minuta (multipart audio o audio_base64)

Requisitos:
  pip install google-genai psycopg2-binary
  GEMINI_API_KEY + DATABASE_URL (o DB_*)
  Migración 292_reuniones_pheme.sql
"""

from __future__ import annotations

import json
import os
import sys
import time

import psycopg2
from google import genai
from google.genai import types
from psycopg2.extras import Json

client = genai.Client()


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


# ------------------------------------------------------------------
# PASO 1: Transcribir Audio con Diarización (Identificación de Hablantes)
# ------------------------------------------------------------------
def transcribir_audio(ruta_archivo_audio: str) -> str:
    """Sube el archivo de audio a la API de Gemini y genera la transcripción
    con etiquetas de hablantes (ej: Hablante 1, Hablante 2).
    """
    print(f"Subiendo archivo de audio: {ruta_archivo_audio}...")
    audio_file = client.files.upload(file=ruta_archivo_audio)

    while getattr(audio_file.state, "name", str(audio_file.state)) == "PROCESSING":
        print("Procesando el audio en el servidor...")
        time.sleep(2)
        audio_file = client.files.get(name=audio_file.name)

    prompt_transcripcion = """
    Escucha atentamente este audio de reunión y genera una transcripción literal completa.
    Es fundamental que identifiques y etiquetes a cada hablante según su voz o cuando digan su nombre.

    Formato requerido:
    Hablante 1 (o Nombre si lo identificas): [Texto dicho]
    Hablante 2 (o Nombre si lo identificas): [Texto dicho]
    """

    print("Generando transcripción con diarización...")
    model = os.getenv("GEMINI_PHEME_MODEL", "gemini-2.5-flash")
    response = client.models.generate_content(
        model=model, contents=[audio_file, prompt_transcripcion]
    )

    client.files.delete(name=audio_file.name)
    return (response.text or "").strip()


# ------------------------------------------------------------------
# PASO 2: Procesamiento por Pheme y Persistencia en PostgreSQL
# ------------------------------------------------------------------
def procesar_reunion_desde_audio(
    titulo_reunion: str, ruta_archivo_audio: str, duracion_minutos=None
):
    """Flujo completo: Audio -> Transcripción con Hablantes -> Minuta por Pheme -> PostgreSQL."""

    transcripcion_raw = transcribir_audio(ruta_archivo_audio)

    system_prompt_pheme = """
    Eres Pheme, un agente inteligente especializado en analizar transcripciones de reuniones.
    Tu objetivo es extraer los puntos clave, acuerdos, compromisos asignados y devolver la información en formato JSON estricto.

    Responde ÚNICAMENTE con un objeto JSON con esta estructura exacta:
    {
      "resumen_ejecutivo": "Síntesis breve de 2-3 oraciones sobre la reunión.",
      "puntos_clave": ["Punto 1", "Punto 2"],
      "acuerdos": [
        {"tarea": "Descripción de la tarea", "responsable": "Nombre del participante", "fecha_limite": "YYYY-MM-DD o N/A"}
      ],
      "pendientes_o_alertas": ["Pendiente 1"]
    }
    """

    prompt_analisis = (
        f"Analiza la siguiente transcripción de la reunión '{titulo_reunion}':\n\n"
        f"{transcripcion_raw}"
    )

    print("Pheme está analizando la reunión y extrayendo compromisos...")
    model = os.getenv("GEMINI_PHEME_MODEL", "gemini-2.5-flash")
    response_pheme = client.models.generate_content(
        model=model,
        contents=prompt_analisis,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt_pheme,
            response_mime_type="application/json",
        ),
    )

    minuta_json = json.loads(response_pheme.text or "{}")

    conn = obtener_conexion_pg()
    cursor = conn.cursor()

    insert_query = """
        INSERT INTO reuniones_pheme
        (titulo_reunion, duracion_minutos, transcripcion_raw, resumen_ejecutivo, minuta_json)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id_reunion;
    """

    cursor.execute(
        insert_query,
        (
            titulo_reunion,
            duracion_minutos,
            transcripcion_raw,
            minuta_json.get("resumen_ejecutivo"),
            Json(minuta_json),
        ),
    )

    id_reunion = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()

    print(f"✓ Proceso completado exitosamente. ID de Reunión guardado: {id_reunion}")

    return {
        "id_reunion": id_reunion,
        "transcripcion": transcripcion_raw,
        "minuta": minuta_json,
    }


if __name__ == "__main__":
    archivo_de_audio = sys.argv[1] if len(sys.argv) > 1 else "grabacion_reunion_cctv.mp3"
    titulo = sys.argv[2] if len(sys.argv) > 2 else "Instalación de Cámaras Almacén"
    duracion = int(sys.argv[3]) if len(sys.argv) > 3 else 15

    if os.path.exists(archivo_de_audio):
        resultado = procesar_reunion_desde_audio(
            titulo_reunion=titulo,
            ruta_archivo_audio=archivo_de_audio,
            duracion_minutos=duracion,
        )
        print("\n--- TRANSCRIPCIÓN GENERADA ---")
        print(resultado["transcripcion"])
        print("\n--- MINUTA GENERADA POR PHEME ---")
        print(json.dumps(resultado["minuta"], indent=2, ensure_ascii=False))
    else:
        print(
            f"Coloca un archivo de prueba en '{archivo_de_audio}' para ejecutar la prueba.\n"
            f'Uso: python scripts/procesar_reunion_desde_audio.py audio.mp3 "Título" 15'
        )
