#!/usr/bin/env python3
"""
Pheme — Audio → Transcripción con diarización → Minuta JSON → PostgreSQL.

Equivalente en app: lib/pheme/procesarReunionDesdeAudio.ts
Migración: supabase/migrations/292_reuniones_pheme.sql

Requisitos: pip install google-genai psycopg2-binary
Variables: GEMINI_API_KEY, DATABASE_URL (o DB_NAME / DB_USER / DB_PASSWORD / DB_HOST / DB_PORT)
"""

import json
import os
import time

import psycopg2
from google import genai
from google.genai import types

# Inicialización de clientes
client = genai.Client()


def obtener_conexion_pg():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "tu_base_datos"),
        user=os.getenv("DB_USER", "tu_usuario"),
        password=os.getenv("DB_PASSWORD", "tu_contrasena"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


# ------------------------------------------------------------------
# PASO 1: Transcribir Audio con Diarización (Identificación de Hablantes)
# ------------------------------------------------------------------
def transcribir_audio(ruta_archivo_audio):
    """Sube el archivo de audio a la API de Gemini y genera la transcripción

    con etiquetas de hablantes (ej: Hablante 1, Hablante 2).
    """
    print(f"Subiendo archivo de audio: {ruta_archivo_audio}...")
    audio_file = client.files.upload(file=ruta_archivo_audio)

    # Esperar a que el archivo sea procesado si es grande
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
    response = client.models.generate_content(
        model="gemini-2.5-flash", contents=[audio_file, prompt_transcripcion]
    )

    # Limpieza: eliminar el archivo remoto tras transcribir
    client.files.delete(name=audio_file.name)

    return response.text.strip()


# ------------------------------------------------------------------
# PASO 2: Procesamiento por Pheme y Persistencia en PostgreSQL
# ------------------------------------------------------------------
def procesar_reunion_desde_audio(
    titulo_reunion, ruta_archivo_audio, duracion_minutos=None
):
    """Flujo completo: Audio -> Transcripción con Hablantes -> Minuta por Pheme -> PostgreSQL."""

    # 1. Obtener transcripción
    transcripcion_raw = transcribir_audio(ruta_archivo_audio)

    # 2. System Prompt de Pheme para Minuta Estructurada
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

    prompt_analisis = f"Analiza la siguiente transcripción de la reunión '{titulo_reunion}':\n\n{transcripcion_raw}"

    print("Pheme está analizando la reunión y extrayendo compromisos...")
    response_pheme = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt_analisis,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt_pheme,
            response_mime_type="application/json",  # Garantiza JSON válido
        ),
    )

    minuta_json = json.loads(response_pheme.text)

    # 3. Guardar todo en PostgreSQL
    conn = obtener_conexion_pg()
    cursor = conn.cursor()

    insert_query = """
        INSERT INTO reuniones_pheme 
        (titulo_reunion, duracion_minutos, transcripcion_raw, resumen_ejecutivo, minuta_json)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        RETURNING id_reunion;
    """

    cursor.execute(
        insert_query,
        (
            titulo_reunion,
            duracion_minutos,
            transcripcion_raw,
            minuta_json.get("resumen_ejecutivo"),
            json.dumps(minuta_json, ensure_ascii=False),
        ),
    )

    id_reunion = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    conn.close()

    print(
        f"✓ Proceso completado exitosamente. ID de Reunión guardado: {id_reunion}"
    )

    return {
        "id_reunion": id_reunion,
        "transcripcion": transcripcion_raw,
        "minuta": minuta_json,
    }


# ------------------------------------------------------------------
# EJEMPLO DE EJECUCIÓN
# ------------------------------------------------------------------
if __name__ == "__main__":
    # Ruta al archivo de audio que grabaste o descargaste de la reunión
    archivo_de_audio = "grabacion_reunion_cctv.mp3"

    if os.path.exists(archivo_de_audio):
        resultado = procesar_reunion_desde_audio(
            titulo_reunion="Instalación de Cámaras Almacén",
            ruta_archivo_audio=archivo_de_audio,
            duracion_minutos=15,
        )

        print("\n--- TRANSCRIPCIÓN GENERADA ---")
        print(resultado["transcripcion"])

        print("\n--- MINUTA GENERADA POR PHEME ---")
        print(json.dumps(resultado["minuta"], indent=2, ensure_ascii=False))
    else:
        print(
            f"Coloca un archivo de prueba en '{archivo_de_audio}' para ejecutar la prueba."
        )
