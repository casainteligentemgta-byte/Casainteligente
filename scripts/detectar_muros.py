"""
Detección de muros desde un PDF vectorial (planos exportados de CAD).

Uso:  python scripts/detectar_muros.py plano.pdf  [salida.json]

Estrategia (paso 2 de la cascada): agrupa los polígonos rellenos por color y
elige como "muro" el color cuyos polígonos son más largos y delgados.
Devuelve los polígonos en coordenadas PDF (puntos, origen arriba-izquierda).
Requiere: pip install pdfplumber
"""
import sys, json, collections

try:
    import pdfplumber
except ImportError:
    sys.stderr.write("Falta pdfplumber. Instala con: pip install pdfplumber\n")
    sys.exit(1)


def shape_stats(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    longer, shorter = max(w, h), max(min(w, h), 1e-6)
    return longer, shorter


def detect_walls(pdf_path, page_no=0):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_no]
        groups = collections.defaultdict(list)
        for o in page.curves + page.rects:
            if not o.get("fill"):
                continue
            pts = o.get("pts") or [
                (o["x0"], o["top"]),
                (o["x1"], o["top"]),
                (o["x1"], o["bottom"]),
                (o["x0"], o["bottom"]),
            ]
            color = str(o.get("non_stroking_color"))
            groups[color].append([(round(x, 2), round(y, 2)) for x, y in pts])

    # Puntuar cada color: muchos polígonos alargados (relación largo/espesor alta)
    best, best_score = None, 0
    for color, polys in groups.items():
        if color in ("(0.0, 0.0, 0.0)", "0", "None"):
            continue  # el negro suele ser texto, flechas y bloques
        elong = [l / s for l, s in map(shape_stats, polys)]
        score = sum(1 for e in elong if e > 3)
        if score > best_score:
            best, best_score = color, score
    return best, groups.get(best, [])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Uso: python scripts/detectar_muros.py plano.pdf [salida.json]\n")
        sys.exit(1)
    pdf_path = sys.argv[1]
    color, walls = detect_walls(pdf_path)
    print(f"Color de muro detectado: {color} · {len(walls)} polígonos")
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w") as f:
            json.dump({"color": color, "walls": walls}, f)
