/**
 * Agrupa páginas consecutivas de un PDF que pertenecen a la misma factura.
 * Puro (sin I/O): útil para tests.
 */

export type CabeceraPaginaFactura = {
  pageIndex: number;
  pageNumber: number;
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  date: string;
  total_amount: number | null;
};

export type GrupoFacturaPaginas = {
  pageIndexes: number[];
  pageNumbers: number[];
  /** Cabecera representativa (mejor página del grupo). */
  cabecera: CabeceraPaginaFactura;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function mismaClaveFactura(a: CabeceraPaginaFactura, b: CabeceraPaginaFactura): boolean {
  const invA = norm(a.invoice_number);
  const invB = norm(b.invoice_number);
  if (invA && invB) return invA === invB;

  const rifA = norm(a.supplier_rif);
  const rifB = norm(b.supplier_rif);
  const nomA = norm(a.supplier_name);
  const nomB = norm(b.supplier_name);
  const mismoEmisor =
    (rifA && rifB && rifA === rifB) ||
    (nomA.length >= 6 && nomB.length >= 6 && (nomA.includes(nomB.slice(0, 6)) || nomB.includes(nomA.slice(0, 6))));

  // Continuación: página siguiente sin nº nuevo, mismo emisor, sin total propio fuerte
  if (mismoEmisor && !invB && invA) {
    const totalB = b.total_amount != null && b.total_amount > 0;
    // Si la nueva página trae total distinto y fecha distinta, suele ser otra factura
    if (totalB && a.date && b.date && a.date !== b.date) return false;
    if (totalB && a.total_amount != null && Math.abs((a.total_amount || 0) - (b.total_amount || 0)) / Math.max(a.total_amount || 1, b.total_amount || 1) > 0.15) {
      // total muy distinto sin nº → otra factura del mismo proveedor
      return false;
    }
    return true;
  }

  return false;
}

function elegirCabeceraGrupo(paginas: CabeceraPaginaFactura[]): CabeceraPaginaFactura {
  // Preferir página con nº + total; si no, la que tenga total; si no, la primera
  const conNroYTotal = paginas.find(
    (p) => norm(p.invoice_number) && p.total_amount != null && p.total_amount > 0,
  );
  if (conNroYTotal) return conNroYTotal;
  const conTotal = [...paginas].reverse().find((p) => p.total_amount != null && p.total_amount > 0);
  if (conTotal) return conTotal;
  const conNro = paginas.find((p) => norm(p.invoice_number));
  if (conNro) return conNro;
  return paginas[0]!;
}

/**
 * Agrupa páginas consecutivas de la misma factura.
 * Una sola página o saltos de nº → grupos distintos.
 */
export function agruparPaginasMismaFactura(
  paginas: CabeceraPaginaFactura[],
): GrupoFacturaPaginas[] {
  if (paginas.length === 0) return [];

  const sorted = [...paginas].sort((a, b) => a.pageIndex - b.pageIndex);
  const grupos: CabeceraPaginaFactura[][] = [[sorted[0]!]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const consecutiva = cur.pageIndex === prev.pageIndex + 1;
    const ultimoGrupo = grupos[grupos.length - 1]!;
    const ancla = elegirCabeceraGrupo(ultimoGrupo);

    if (consecutiva && mismaClaveFactura(ancla, cur)) {
      ultimoGrupo.push(cur);
    } else {
      grupos.push([cur]);
    }
  }

  return grupos.map((g) => ({
    pageIndexes: g.map((p) => p.pageIndex),
    pageNumbers: g.map((p) => p.pageNumber),
    cabecera: elegirCabeceraGrupo(g),
  }));
}
