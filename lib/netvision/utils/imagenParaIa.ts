import { intensificarTrazosPlano } from '@/lib/netvision/utils/intensidadPlano'

/** Lado mayor de la imagen que se manda a la IA: suficiente para ver muros, liviana de subir. */
const LADO_IA = 1600

/**
 * Reduce el plano a un JPEG liviano (fondo blanco) para mandarlo a la IA.
 * Si el plano tiene intensidad de trazos, se aplica también: la IA ve mejor los muros.
 */
export function imagenPlanoParaIa(planoUrl: string, intensidad = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Solo en el navegador.'))
      return
    }
    const img = new window.Image()
    if (/^https?:/i.test(planoUrl)) img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w0 = img.naturalWidth || img.width
      const h0 = img.naturalHeight || img.height
      if (!(w0 > 0) || !(h0 > 0)) {
        reject(new Error('El plano no tiene un tamaño válido.'))
        return
      }
      const f = Math.min(1, LADO_IA / Math.max(w0, h0))
      const w = Math.max(1, Math.round(w0 * f))
      const h = Math.max(1, Math.round(h0 * f))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        reject(new Error('No se pudo preparar la imagen del plano.'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      if (intensidad > 0) {
        const datos = ctx.getImageData(0, 0, w, h)
        intensificarTrazosPlano(datos.data, w, h, intensidad)
        ctx.putImageData(datos, 0, 0)
      }
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('No se pudo leer el plano.'))
    img.src = planoUrl
  })
}
