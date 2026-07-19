import type {
  BomSummary,
  NetVisionCurrency,
  NetVisionProject,
} from '@/lib/netvision/types'
import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'

export function bomMarginTotal(
  bom: BomSummary,
  marginPct: number,
): { marginUsd: number; totalWithMarginUsd: number } {
  const pct = Number.isFinite(marginPct) ? Math.min(100, Math.max(0, marginPct)) : 0
  const marginUsd = (bom.totalUsd * pct) / 100
  return { marginUsd, totalWithMarginUsd: bom.totalUsd + marginUsd }
}

export function currencySymbol(currency: NetVisionCurrency): string {
  if (currency === 'EUR') return '€'
  if (currency === 'VES') return 'Bs'
  return '$'
}

export function projectToExportJson(project: NetVisionProject, bom: BomSummary) {
  const { marginUsd, totalWithMarginUsd } = bomMarginTotal(
    bom,
    project.distributorMarginPct ?? 0,
  )
  return {
    app: 'NetVision Pro',
    version: project.version,
    exportedAt: new Date().toISOString(),
    id: project.id,
    name: project.name,
    description: project.description,
    client: project.client,
    unitSystem: project.unitSystem,
    currency: project.currency,
    distributorMarginPct: project.distributorMarginPct,
    marginUsd,
    totalWithMarginUsd,
    planoNombre: project.planoNombre,
    scale: project.scale,
    retentionDays: project.retentionDays,
    complianceProfileId: project.complianceProfileId,
    cameras: project.cameras.map((c) => {
      const m = getCameraModelOrDefault(c.modelId)
      return {
        ...c,
        model: {
          id: m.id,
          brand: m.brand,
          name: m.name,
          fovDeg: m.fovDeg,
          rangeDayM: m.rangeDayM,
          rangeNightM: m.rangeNightM,
          bitrateMbps: m.bitrateMbps,
          poeWatts: m.poeWatts,
        },
      }
    }),
    networkNodes: (project.networkNodes ?? []).map((n) => {
      const m = getNetworkModelOrDefault(n.modelId, n.kind)
      return {
        ...n,
        model: {
          id: m.id,
          brand: m.brand,
          name: m.name,
          kind: m.kind,
          poeBudgetW: m.poeBudgetW,
          poePorts: m.poePorts,
          wifiRangeM: m.wifiRangeM,
        },
      }
    }),
    structures: project.structures ?? [],
    undergroundSegments: project.undergroundSegments ?? [],
    bom,
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, filename)
}

export function bomToCsv(
  bom: BomSummary,
  opts?: { marginPct?: number; currency?: NetVisionCurrency; projectName?: string },
): string {
  const marginPct = opts?.marginPct ?? 0
  const { marginUsd, totalWithMarginUsd } = bomMarginTotal(bom, marginPct)
  const currency = opts?.currency ?? 'USD'
  const header = 'sku,category,description,qty,unit_usd,total_usd'
  const rows = bom.lines.map(
    (l) =>
      `${csvEscape(l.sku)},${csvEscape(l.category)},${csvEscape(l.description)},${l.qty},${l.unitUsd},${l.totalUsd}`,
  )
  rows.push(`SUBTOTAL,,,, ,${bom.totalUsd}`)
  rows.push(`MARGEN_${marginPct}pct,,,, ,${marginUsd.toFixed(2)}`)
  rows.push(`TOTAL_${currency},,,, ,${totalWithMarginUsd.toFixed(2)}`)
  if (opts?.projectName) {
    return [`# ${opts.projectName}`, header, ...rows].join('\n')
  }
  return [header, ...rows].join('\n')
}

export function bomToExcelXml(
  bom: BomSummary,
  opts: {
    projectName: string
    marginPct: number
    currency: NetVisionCurrency
  },
): string {
  const { marginUsd, totalWithMarginUsd } = bomMarginTotal(bom, opts.marginPct)
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const cell = (v: string | number, type: 'String' | 'Number' = 'String') => {
    if (type === 'Number') {
      const n = Number(v)
      return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`
    }
    return `<Cell><Data ss:Type="String">${esc(String(v))}</Data></Cell>`
  }
  const header = ['SKU', 'Categoría', 'Descripción', 'Cant.', 'Unit USD', 'Total USD']
  const bodyRows = bom.lines.map((l) =>
    [
      cell(l.sku),
      cell(l.category),
      cell(l.description),
      cell(l.qty, 'Number'),
      cell(l.unitUsd, 'Number'),
      cell(l.totalUsd, 'Number'),
    ].join(''),
  )
  bodyRows.push(
    [cell(''), cell(''), cell('SUBTOTAL'), cell(''), cell(''), cell(bom.totalUsd, 'Number')].join(
      '',
    ),
  )
  bodyRows.push(
    [
      cell(''),
      cell(''),
      cell(`MARGEN ${opts.marginPct}%`),
      cell(''),
      cell(''),
      cell(Number(marginUsd.toFixed(2)), 'Number'),
    ].join(''),
  )
  bodyRows.push(
    [
      cell(''),
      cell(''),
      cell(`TOTAL ${opts.currency}`),
      cell(''),
      cell(''),
      cell(Number(totalWithMarginUsd.toFixed(2)), 'Number'),
    ].join(''),
  )
  const headerRow = `<Row>${header.map((h) => cell(h)).join('')}</Row>`
  const rowsXml = bodyRows.map((r) => `<Row>${r}</Row>`).join('')
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="BOM">
  <Table>
   <Row>${cell(opts.projectName)}${cell('')}${cell('')}${cell('')}${cell('')}${cell('')}</Row>
   ${headerRow}
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename)
}

export function downloadExcelXml(filename: string, xml: string) {
  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  })
  triggerDownload(blob, filename)
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Spec sheet HTML printable → el usuario usa Imprimir / Guardar PDF del navegador. */
export function openSpecsPrintable(project: NetVisionProject, bom: BomSummary) {
  const payload = projectToExportJson(project, bom)
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!w) return
  const rows = bom.lines
    .map(
      (l) =>
        `<tr><td>${esc(l.sku)}</td><td>${esc(l.description)}</td><td>${l.qty}</td><td>$${l.unitUsd.toFixed(2)}</td><td>$${l.totalUsd.toFixed(2)}</td></tr>`,
    )
    .join('')
  w.document.write(`<!doctype html><html><head><title>NetVision Pro — Specs</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111}
h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:16px}
td,th{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}
.meta{font-size:13px;color:#444}
</style></head><body>
<h1>NetVision Pro — Especificaciones</h1>
<p class="meta">Plano: ${esc(project.planoNombre || '—')} · Cámaras: ${project.cameras.length}</p>
<p class="meta">PoE: ${bom.totalPoeWatts.toFixed(1)} W · BW: ${bom.totalBandwidthMbps.toFixed(1)} Mbps · Storage: ${bom.storageTb} TB · Retención: ${project.retentionDays} días</p>
<table><thead><tr><th>SKU</th><th>Descripción</th><th>Cant.</th><th>Unit.</th><th>Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="meta"><strong>Total BOM: $${bom.totalUsd.toFixed(2)}</strong></p>
<pre style="font-size:10px;margin-top:24px;white-space:pre-wrap">${esc(JSON.stringify(payload.cameras, null, 2))}</pre>
<script>window.onload=()=>window.print()</script>
</body></html>`)
  w.document.close()
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
