#!/usr/bin/env python3
"""
Ingesta de texto legal → chunks → embeddings OpenAI → Supabase (ci_legal_knowledge).

Uso:
  export OPENAI_API_KEY=...
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...

  python scripts/legal/ingest_legal_knowledge.py \\
    --file ./docs/obligaciones-legales-cap-17.txt \\
    --source "Obligaciones Legales del Empleador" \\
    --capitulo 17

Sin --file, lee stdin o --text.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Iterable, List

try:
    from openai import OpenAI
except ImportError as e:
    raise SystemExit("Instale openai: pip install openai") from e

try:
    from supabase import create_client
except ImportError as e:
    raise SystemExit("Instale supabase: pip install supabase") from e


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
                for i in range(0, len(p), chunk_size - chunk_overlap):
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
                    if len(piece) > chunk_size:
                        out.extend(split_with(separators[separators.index(sep) + 1], [piece]))
                        buf = ""
                    else:
                        buf = piece
            if buf:
                out.append(buf)
        return out

    chunks = split_with(separators[0], [text])
    # Overlap suave entre chunks consecutivos
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
    ap.add_argument("--chunk-size", type=int, default=1000)
    ap.add_argument("--chunk-overlap", type=int, default=100)
    ap.add_argument("--model", default="text-embedding-3-small")
    ap.add_argument("--dry-run", action="store_true", help="Solo muestra chunks, no inserta")
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

    chunks = recursive_split(
        text_content,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )
    print(f"Fragmentos: {len(chunks)}")
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
                    "source": args.source,
                    "capitulo": args.capitulo or None,
                    "metadata": {
                        "source": args.source,
                        "capitulo": args.capitulo or None,
                    },
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
