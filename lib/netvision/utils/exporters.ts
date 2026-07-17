import type { BomSummary, NetVisionProject } from '@/lib/netvision/types'
import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'

export function projectToExportJson(project: NetVisionProject, bom: BomSummary) {
  return {
    app: 'NetVision Pro',
    version: project.version,
    exportedAt: new Date().toISOString(),
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
    bom,
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, filename)
}

export function bomToCsv(bom: BomSummary): string {
  const header = 'sku,category,description,qty,unit_usd,total_usd'
  const rows = bom.lines.map(
    (l) =>
      `${csvEscape(l.sku)},${csvEscape(l.category)},${csvEscape(l.description)},${l.qty},${l.unitUsd},${l.totalUsd}`,
  )
  rows.push(`TOTAL,,,, ,${bom.totalUsd}`)
  return [header, ...rows].join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
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
