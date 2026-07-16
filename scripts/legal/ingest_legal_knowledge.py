#!/usr/bin/env python3
"""
Ingesta de texto legal → chunks → embeddings OpenAI → Supabase (ci_legal_knowledge).

Metadata canónica (ejemplo):
{
  "categoria": "laboral",       # laboral | civil | internacional | mercantil
  "tipo": "ley",                # ley | jurisprudencia | doctrina | contrato_modelo
  "jurisdiccion": "venezuela",  # venezuela | internacional | extranjera
  "fecha_vigencia": "2026-07-16",
  "referencia": "Art. 142 LOTTT"
}

Uso:
  export OPENAI_API_KEY=...
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...

  python scripts/legal/ingest_legal_knowledge.py \\
    --file ./docs/obligaciones-legales-cap-17.txt \\
    --source "Obligaciones Legales del Empleador" \\
    --capitulo 17 \\
    --categoria laboral \\
    --tipo ley \\
    --jurisdiccion venezuela \\
    --fecha-vigencia 2026-07-16 \\
    --referencia "Art. 142 LOTTT"

  # O con JSON:
  python scripts/legal/ingest_legal_knowledge.py \\
    --file ./docs/cap-17.txt \\
    --metadata-json '{"categoria":"laboral","tipo":"ley","jurisdiccion":"venezuela","fecha_vigencia":"2026-07-16","referencia":"Art. 142 LOTTT"}'
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date
from typing import Any, Dict, Iterable, List

try:
    from openai import OpenAI
except ImportError as e:
    raise SystemExit("Instale openai: pip install openai") from e

try:
    from supabase import create_client
except ImportError as e:
    raise SystemExit("Instale supabase: pip install supabase") from e

CATEGORIAS = {"laboral", "civil", "internacional", "mercantil"}
TIPOS = {"ley", "jurisprudencia", "doctrina", "contrato_modelo"}
JURISDICCIONES = {"venezuela", "internacional", "extranjera"}


def recursive_split(text: str, chunk_size: int = 1000, chunk_overlap: int = 100) -> List[str]:
    """Splitter simple tipo RecursiveCharacterTextSplitter (sin LangChain)."""
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
                for i in range(0, len(p), max(1, chunk_size - chunk_overlap)):
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
                    next_sep = separators[separators.index(sep) + 1] if sep in separators else ""
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


def build_metadata(args: argparse.Namespace) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    if args.metadata_json:
        try:
            meta = json.loads(args.metadata_json)
            if not isinstance(meta, dict):
                raise ValueError("metadata-json debe ser un objeto")
        except Exception as e:
            raise SystemExit(f"--metadata-json inválido: {e}") from e

    categoria = (args.categoria or meta.get("categoria") or "laboral").strip().lower()
    tipo = (args.tipo or meta.get("tipo") or "ley").strip().lower()
    jurisdiccion = (
        args.jurisdiccion or meta.get("jurisdiccion") or "venezuela"
    ).strip().lower()
    fecha = args.fecha_vigencia or meta.get("fecha_vigencia") or date.today().isoformat()
    referencia = args.referencia or meta.get("referencia") or None

    if categoria not in CATEGORIAS:
        raise SystemExit(f"categoria inválida: {categoria}. Use: {sorted(CATEGORIAS)}")
    if tipo not in TIPOS:
        raise SystemExit(f"tipo inválido: {tipo}. Use: {sorted(TIPOS)}")
    if jurisdiccion not in JURISDICCIONES:
        raise SystemExit(
            f"jurisdiccion inválida: {jurisdiccion}. Use: {sorted(JURISDICCIONES)}"
        )
    if fecha and not str(fecha).startswith(("19", "20")):
        raise SystemExit("fecha_vigencia debe ser YYYY-MM-DD")

    out = {
        "categoria": categoria,
        "tipo": tipo,
        "jurisdiccion": jurisdiccion,
        "fecha_vigencia": str(fecha)[:10] if fecha else None,
        "referencia": (str(referencia).strip() if referencia else None),
        "source": args.source,
        "capitulo": args.capitulo or None,
    }
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingesta legal → ci_legal_knowledge")
    ap.add_argument("--file", help="Archivo de texto (.txt)")
    ap.add_argument("--text", help="Texto directo (alternativa a --file)")
    ap.add_argument(
        "--source",
        default="Obligaciones Legales del Empleador",
        help="Nombre de la fuente",
    )
    ap.add_argument("--capitulo", default="", help="Capítulo / sección")
    ap.add_argument("--categoria", choices=sorted(CATEGORIAS), default=None)
    ap.add_argument("--tipo", choices=sorted(TIPOS), default=None)
    ap.add_argument("--jurisdiccion", choices=sorted(JURISDICCIONES), default=None)
    ap.add_argument("--fecha-vigencia", dest="fecha_vigencia", default=None)
    ap.add_argument("--referencia", default=None, help='Ej. "Art. 142 LOTTT"')
    ap.add_argument(
        "--metadata-json",
        default=None,
        help="JSON con categoria/tipo/jurisdiccion/fecha_vigencia/referencia",
    )
    ap.add_argument("--chunk-size", type=int, default=1000)
    ap.add_argument("--chunk-overlap", type=int, default=100)
    ap.add_argument("--model", default="text-embedding-3-small")
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

    metadata = build_metadata(args)
    chunks = recursive_split(
        text_content,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )
    print(f"Fragmentos: {len(chunks)}")
    print(f"Metadata: {json.dumps(metadata, ensure_ascii=False)}")
    if args.dry_run:
        for i, c in enumerate(chunks[:5]):
            print(f"--- chunk {i+1} ({len(c)} chars) ---\n{c[:240]}…\n")
        return 0

    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    supabase_url = os.environ.get("SUPABASE_URL", "").strip() or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_URL", ""
    ).strip()
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not openai_key:
        raise SystemExit("Falta OPENAI_API_KEY")
    if not supabase_url or not supabase_key:
        raise SystemExit("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY")

    client = OpenAI(api_key=openai_key)
    sb = create_client(supabase_url, supabase_key)

    inserted = 0
    for batch in batched(chunks, 20):
        emb_res = client.embeddings.create(input=batch, model=args.model)
        rows = []
        for chunk, emb_item in zip(batch, emb_res.data):
            rows.append(
                {
                    "content": chunk,
                    "categoria": metadata["categoria"],
                    "tipo": metadata["tipo"],
                    "jurisdiccion": metadata["jurisdiccion"],
                    "fecha_vigencia": metadata["fecha_vigencia"],
                    "referencia": metadata["referencia"],
                    "source": metadata["source"],
                    "capitulo": metadata["capitulo"],
                    "metadata": metadata,
                    "embedding": emb_item.embedding,
                }
            )
        sb.table("ci_legal_knowledge").insert(rows).execute()
        inserted += len(rows)
        print(f"Insertados {inserted}/{len(chunks)}")
        time.sleep(0.2)

    print(f"OK: {inserted} fragmentos en ci_legal_knowledge")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
