"""
Detección de muros y aberturas desde un PDF vectorial (planos exportados de CAD).

Uso:  python scripts/detectar_muros.py plano.pdf  [salida.json]

Cascada:
  2) agrupa polígonos rellenos por color y elige como muro el más largo/delgado
  3) huecos colineales → puerta; relleno cian/azul en el muro → ventana
Devuelve coordenadas PDF (puntos, origen arriba-izquierda).
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


def centerline(pts):
    longer, shorter = shape_stats(pts)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    if maxx - minx >= maxy - miny:
        mid = (miny + maxy) / 2
        return (minx, mid, maxx, mid, shorter)
    mid = (minx + maxx) / 2
    return (mid, miny, mid, maxy, shorter)


def parse_rgb(color):
    if color in ("(0.0, 0.0, 0.0)", "(0, 0, 0)", "0", "0.0", "None"):
        return None
    if color.startswith("(") and color.endswith(")"):
        parts = [p.strip() for p in color[1:-1].split(",")]
        if len(parts) >= 3:
            try:
                return tuple(float(p) for p in parts[:3])
            except ValueError:
                return None
    try:
        n = float(color)
        return (n, n, n)
    except ValueError:
        return None


def color_role(color):
    rgb = parse_rgb(color)
    if rgb is None:
        return "skip"
    r, g, b = rgb
    if b > 0.32 and b >= r + 0.07 and (b >= g - 0.08 or g > 0.4):
        return "glass"
    if g > 0.48 and b > 0.48 and r < 0.58 and b >= r:
        return "glass"
    if r > 0.28 and r >= g - 0.02 and r > b + 0.08:
        return "wood"
    return "neutral"


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

    best, best_score = None, 0
    for color, polys in groups.items():
        if color_role(color) == "skip":
            continue
        elong = [l / s for l, s in map(shape_stats, polys)]
        score = sum(1 for e in elong if e > 3)
        if score > best_score:
            best, best_score = color, score
    walls_polys = groups.get(best, [])
    walls = [centerline(p) for p in walls_polys if shape_stats(p)[0] / shape_stats(p)[1] > 3]

    doors, windows = [], []
    horiz = [(x1, y1, x2, y2, th) for x1, y1, x2, y2, th in walls if abs(x2 - x1) >= abs(y2 - y1)]
    horiz.sort(key=lambda s: (round(s[1], 1), s[0]))
    i = 0
    while i < len(horiz) - 1:
        a, b = horiz[i], horiz[i + 1]
        if abs(a[1] - b[1]) < max(a[4], b[4]) * 0.9:
            gap = min(b[0], b[2]) - max(a[0], a[2])
            if max(a[4] * 2.8, 8) < gap < 200:
                doors.append(((max(a[0], a[2]), a[1]), (min(b[0], b[2]), b[1])))
            i += 2
            continue
        i += 1

    for color, polys in groups.items():
        if color == best:
            continue
        role = color_role(color)
        if role != "glass":
            continue
        for p in polys:
            longer, shorter = shape_stats(p)
            if longer / shorter < 2:
                continue
            cl = centerline(p)
            windows.append(((cl[0], cl[1]), (cl[2], cl[3])))

    return best, walls_polys, doors, windows


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Uso: python scripts/detectar_muros.py plano.pdf [salida.json]\n")
        sys.exit(1)
    pdf_path = sys.argv[1]
    color, walls, doors, windows = detect_walls(pdf_path)
    print(
        f"Color de muro: {color} · {len(walls)} polígonos · "
        f"{len(doors)} puertas · {len(windows)} ventanas"
    )
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w") as f:
            json.dump(
                {"color": color, "walls": walls, "doors": doors, "windows": windows},
                f,
            )
