"""Pasa los colores escritos a mano (pensados para fondo negro) a colores de tema.
Uso: codemod_tema.py archivo.tsx ...   — imprime lo que quedó sin tocar para revisarlo a mano."""
import re, sys

TONOS = {'#007AFF': 'azul', '#34C759': 'verde', '#FF9500': 'naranja', '#FF3B30': 'rojo', '#5AC8FA': 'celeste', '#25D366': 'whatsapp'}
BL = r'rgba\(255,\s*255,\s*255,\s*([0-9.]+)\)'

def transformar(s):
    usa = set()
    def t(a): usa.add('tinta'); return f'tinta({a})'
    def tt(a): usa.add('tintaTexto'); return f'tintaTexto({a})'
    # texto translúcido
    s = re.sub(r"\bcolor:\s*'" + BL + r"'", lambda m: f'color: {tt(m.group(1))}', s)
    s = re.sub(r"(\?\s*'[^']*'\s*:\s*)'" + BL + r"'(?=,\s*\n\s*fontSize|,\s*$)", lambda m: m.group(0), s)
    # bordes «1px solid rgba(255,255,255,x)»
    s = re.sub(r"'(\d(?:\.\d)?px solid) " + BL + r"'", lambda m: f'`{m.group(1)} ${{{t(m.group(2))}}}`', s)
    # atributos SVG
    s = re.sub(r'\b(stroke|fill)="' + BL + r'"', lambda m: f'{m.group(1)}={{{t(m.group(2))}}}', s)
    # resto de blancos translúcidos (fondos, rellenos)
    s = re.sub(r"'" + BL + r"'", lambda m: t(m.group(1)), s)
    # tonos de acento como color de texto, y sus iconos
    for hexa, nombre in TONOS.items():
        s = re.sub(r"\bcolor:\s*'" + hexa + r"'", f"color: 'var(--tono-{nombre})'", s)
        s = re.sub(r'\bstroke="' + hexa + r'"', 'stroke="currentColor"', s)
    # superficies
    s = s.replace("'rgba(28,28,30,0.95)'", "'var(--superficie)'").replace("'rgba(28,28,30,0.98)'", "'var(--superficie-alta)'")
    s = s.replace("'0 4px 20px rgba(0,0,0,0.3)'", "'var(--sombra-tarjeta)'").replace("'0 8px 32px rgba(0,0,0,0.45)'", "'var(--sombra-tarjeta-alta)'")
    return s, usa

for ruta in sys.argv[1:]:
    s = open(ruta).read()
    n, usa = transformar(s)
    if usa and "from '@/lib/tema/tinta'" not in n:
        imp = "import { " + ", ".join(sorted(usa)) + " } from '@/lib/tema/tinta';\n"
        # tras el último import de la cabecera
        idx = [m.end() for m in re.finditer(r"^import .*;\n", n, re.M)][-1]
        n = n[:idx] + imp + n[idx:]
    open(ruta, 'w').write(n)
    print('==', ruta)
    for i, l in enumerate(n.split('\n'), 1):
        if re.search(r"rgba\(255|'white'|\"white\"|text-white|#000\b|rgba\(0,\s*0,\s*0|rgba\(28", l):
            print(f'{i}: {l.strip()[:170]}')
