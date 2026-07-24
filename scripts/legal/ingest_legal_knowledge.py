#!/usr/bin/env python3
"""
Ingesta de texto legal → chunks → embeddings OpenAI → Supabase (ci_legal_knowledge).

Equivalente al flujo LangChain + OpenAI, sin dependencia de LangChain:
  RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
  → text-embedding-3-small → insert en ci_legal_knowledge

Metadata canónica:
{
  "categoria": "laboral",       # laboral | civil | internacional | mercantil
  "tipo": "doctrina",           # ley | jurisprudencia | doctrina | contrato_modelo
  "jurisdiccion": "venezuela",  # venezuela | internacional | extranjera
  "fecha_vigencia": "2026-07-16",
  "referencia": "Libro Frederick Cabrera"
}

Uso como librería:
  from ingest_legal_knowledge import ingest_legal_document
  ingest_legal_document(contenido_del_pdf, {
      "categoria": "laboral",
      "tipo": "doctrina",
      "jurisdiccion": "venezuela",
      "referencia": "Libro Frederick Cabrera",
  })

Uso CLI:
  export OPENAI_API_KEY=...
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...

  python scripts/legal/ingest_legal_knowledge.py \\
    --file ./docs/obligaciones-legales.txt \\
    --metadata-json '{"categoria":"laboral","tipo":"doctrina","jurisdiccion":"venezuela","referencia":"Libro Frederick Cabrera"}'
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date
from typing import Any, Dict, Iterable, List, Optional

try:
    from openai import OpenAI
except ImportError as e:
    raise SystemExit("Instale openai: pip install openai") from e

try:
    from supabase import create_client, Client
except ImportError as e:
    raise SystemExit("Instale supabase: pip install supabase") from e

CATEGORIAS = {"laboral", "civil", "internacional", "mercantil"}
TIPOS = {"ley", "jurisprudencia", "doctrina", "contrato_modelo"}
JURISDICCIONES = {"venezuela", "internacional", "extranjera"}

TABLE = "ci_legal_knowledge"
EMBEDDING_MODEL = "text-embedding-3-small"


def recursive_split(text: str, chunk_size: int = 1000, chunk_overlap: int = 100) -> List[str]:
    """Splitter tipo RecursiveCharacterTextSplitter (sin LangChain)."""
    separators = ["\n\n", "\n", ". ", " ", ""]
    text = (text or "").strip()
    if not text:
        return []

    def split_with(sep: str, parts: List[str]) -> List[str]:
        out: List[str] = []
        for p in parts:
            if len(p) <= chunk_size:
                out.append(p)
                continue
            if not sep:
                step = max(1, chunk_size - chunk_overlap)
                for i in range(0, len(p), step):
                    out.append(p[i : i + chunk_size])
                continue
            pieces = p.split(sep)
            buf = ""
            for piece in pieces:
                candidate = piece if not buf else buf + sep + piece
                if len(candidate) <= chunk_size:
                    buf = candidate
                else:
                    if buf:
                        out.append(buf)
                    sep_idx = separators.index(sep) if sep in separators else -1
                    next_sep = separators[sep_idx + 1] if 0 <= sep_idx < len(separators) - 1 else ""
                    if len(piece) > chunk_size and next_sep != sep:
                        out.extend(split_with(next_sep, [piece]))
                        buf = ""
                    else:
                        buf = piece
            if buf:
                out.append(buf)
        return out

    chunks = split_with(separators[0], [text])
    if chunk_overlap <= 0 or len(chunks) <= 1:
        return [c.strip() for c in chunks if c.strip()]

    merged: List[str] = []
    for i, c in enumerate(chunks):
        c = c.strip()
        if not c:
            continue
        if i == 0:
            merged.append(c)
            continue
        prev_tail = merged[-1][-chunk_overlap:]
        merged.append((prev_tail + "\n" + c).strip() if prev_tail else c)
    return merged


def batched(items: List[str], n: int) -> Iterable[List[str]]:
    for i in range(0, len(items), n):
        yield items[i : i + n]


def normalize_metadata(metadata: Optional[Dict[str, Any]] = None, **overrides: Any) -> Dict[str, Any]:
    """Valida y completa el JSON canónico de metadata."""
    meta = dict(metadata or {})
    meta.update({k: v for k, v in overrides.items() if v is not None})

    categoria = str(meta.get("categoria") or "laboral").strip().lower()
    tipo = str(meta.get("tipo") or "ley").strip().lower()
    jurisdiccion = str(meta.get("jurisdiccion") or "venezuela").strip().lower()
    fecha = meta.get("fecha_vigencia") or date.today().isoformat()
    referencia = meta.get("referencia")
    source = meta.get("source")
    capitulo = meta.get("capitulo")

    if categoria not in CATEGORIAS:
        raise ValueError(f"categoria inválida: {categoria}. Use: {sorted(CATEGORIAS)}")
    if tipo not in TIPOS:
        raise ValueError(f"tipo inválido: {tipo}. Use: {sorted(TIPOS)}")
    if jurisdiccion not in JURISDICCIONES:
        raise ValueError(
            f"jurisdiccion inválida: {jurisdiccion}. Use: {sorted(JURISDICCIONES)}"
        )
    if fecha and not str(fecha).startswith(("19", "20")):
        raise ValueError("fecha_vigencia debe ser YYYY-MM-DD")

    return {
        "categoria": categoria,
        "tipo": tipo,
        "jurisdiccion": jurisdiccion,
        "fecha_vigencia": str(fecha)[:10] if fecha else None,
        "referencia": (str(referencia).strip() if referencia else None),
        "source": (str(source).strip() if source else None),
        "capitulo": (str(capitulo).strip() if capitulo else None),
    }


def _clients(
    openai_api_key: Optional[str] = None,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
) -> tuple[OpenAI, Client]:
    key = (openai_api_key or os.environ.get("OPENAI_API_KEY", "")).strip()
    url = (
        supabase_url
        or os.environ.get("SUPABASE_URL", "")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    ).strip()
    sb_key = (supabase_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")).strip()

    if not key:
        raise SystemExit("Falta OPENAI_API_KEY")
    if not url or not sb_key:
        raise SystemExit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")

    return OpenAI(api_key=key), create_client(url, sb_key)


def ingest_legal_document(
    text: str,
    metadata: Optional[Dict[str, Any]] = None,
    *,
    chunk_size: int = 1000,
    chunk_overlap: int = 100,
    model: str = EMBEDDING_MODEL,
    dry_run: bool = False,
    openai_api_key: Optional[str] = None,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
) -> int:
    """
    Fragmenta el texto, genera embeddings y sube a Supabase (ci_legal_knowledge).

    Ejemplo (Libro de Obligaciones Legales):
      metadata = {
          "categoria": "laboral",
          "tipo": "doctrina",
          "jurisdiccion": "venezuela",
          "referencia": "Libro Frederick Cabrera",
      }
      ingest_legal_document(contenido_del_pdf, metadata)
    """
    meta = normalize_metadata(metadata)
    chunks = recursive_split(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    print(f"Fragmentos: {len(chunks)}")
    print(f"Metadata: {json.dumps(meta, ensure_ascii=False)}")

    if dry_run:
        for i, c in enumerate(chunks[:5]):
            print(f"--- chunk {i + 1} ({len(c)} chars) ---\n{c[:240]}…\n")
        return len(chunks)

    client, sb = _clients(openai_api_key, supabase_url, supabase_key)
    inserted = 0

    for batch in batched(chunks, 20):
        emb_res = client.embeddings.create(input=batch, model=model)
        rows = []
        for chunk, emb_item in zip(batch, emb_res.data):
            rows.append(
                {
                    "content": chunk,
                    "categoria": meta["categoria"],
                    "tipo": meta["tipo"],
                    "jurisdiccion": meta["jurisdiccion"],
                    "fecha_vigencia": meta["fecha_vigencia"],
                    "referencia": meta["referencia"],
                    "source": meta["source"],
                    "capitulo": meta["capitulo"],
                    "metadata": meta,
                    "embedding": emb_item.embedding,
                }
            )
        sb.table(TABLE).insert(rows).execute()
        inserted += len(rows)
        print(f"Insertados {inserted}/{len(chunks)}")
        time.sleep(0.2)

    print(f"Ingestión completada: {inserted} fragmentos subidos a {TABLE}.")
    return inserted


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingesta legal → ci_legal_knowledge")
    ap.add_argument("--file", help="Archivo de texto (.txt)")
    ap.add_argument("--text", help="Texto directo (alternativa a --file)")
    ap.add_argument("--source", default=None, help="Nombre de la fuente")
    ap.add_argument("--capitulo", default=None, help="Capítulo / sección")
    ap.add_argument("--categoria", choices=sorted(CATEGORIAS), default=None)
    ap.add_argument("--tipo", choices=sorted(TIPOS), default=None)
    ap.add_argument("--jurisdiccion", choices=sorted(JURISDICCIONES), default=None)
    ap.add_argument("--fecha-vigencia", dest="fecha_vigencia", default=None)
    ap.add_argument(
        "--referencia",
        default=None,
        help='Ej. "Libro Frederick Cabrera" o "Art. 142 LOTTT"',
    )
    ap.add_argument(
        "--metadata-json",
        default=None,
        help="JSON con categoria/tipo/jurisdiccion/fecha_vigencia/referencia",
    )
    ap.add_argument("--chunk-size", type=int, default=1000)
    ap.add_argument("--chunk-overlap", type=int, default=100)
    ap.add_argument("--model", default=EMBEDDING_MODEL)
    ap.add_argument("--dry-run", action="store_true", help="Solo muestra chunks/metadata")
    args = ap.parse_args()

    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            text_content = f.read()
    elif args.text:
        text_content = args.text
    elif not sys.stdin.isatty():
        text_content = sys.stdin.read()
    else:
        ap.error("Indique --file, --text o pipe por stdin")

    meta: Dict[str, Any] = {}
    if args.metadata_json:
        try:
            parsed = json.loads(args.metadata_json)
            if not isinstance(parsed, dict):
                raise ValueError("debe ser un objeto JSON")
            meta = parsed
        except Exception as e:
            raise SystemExit(f"--metadata-json inválido: {e}") from e

    for key, val in (
        ("categoria", args.categoria),
        ("tipo", args.tipo),
        ("jurisdiccion", args.jurisdiccion),
        ("fecha_vigencia", args.fecha_vigencia),
        ("referencia", args.referencia),
        ("source", args.source),
        ("capitulo", args.capitulo),
    ):
        if val is not None:
            meta[key] = val

    if not meta.get("source") and meta.get("referencia"):
        meta["source"] = meta["referencia"]

    try:
        n = ingest_legal_document(
            text_content,
            meta,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
            model=args.model,
            dry_run=args.dry_run,
        )
    except ValueError as e:
        raise SystemExit(str(e)) from e

    return 0 if n >= 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
