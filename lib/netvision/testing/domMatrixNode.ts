/**
 * Polyfill mínimo de DOMMatrix para ejecutar pdfjs-dist en Node (tests).
 *
 * En el navegador DOMMatrix existe; en Node no. pdfjs lo usa para transformar
 * coordenadas al leer el PDF. Solo se implementa la parte 2D afín que necesita
 * el análisis de muros. Importar este módulo ANTES que pdfjs-dist.
 */
if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === 'undefined') {
  class DOMMatrixNode {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: number[]) {
      if (init && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init as [number, number, number, number, number, number];
      }
    }
    multiply(o: DOMMatrixNode): DOMMatrixNode {
      const m = new DOMMatrixNode();
      m.a = this.a * o.a + this.c * o.b;
      m.b = this.b * o.a + this.d * o.b;
      m.c = this.a * o.c + this.c * o.d;
      m.d = this.b * o.c + this.d * o.d;
      m.e = this.a * o.e + this.c * o.f + this.e;
      m.f = this.b * o.e + this.d * o.f + this.f;
      return m;
    }
    translate(tx = 0, ty = 0): DOMMatrixNode {
      return this.multiply(new DOMMatrixNode([1, 0, 0, 1, tx, ty]));
    }
    scale(sx = 1, sy = sx): DOMMatrixNode {
      return this.multiply(new DOMMatrixNode([sx, 0, 0, sy, 0, 0]));
    }
    transformPoint(p: { x?: number; y?: number } = {}) {
      const x = p.x ?? 0;
      const y = p.y ?? 0;
      return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f, z: 0, w: 1 };
    }
  }
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixNode;
}

export {};
