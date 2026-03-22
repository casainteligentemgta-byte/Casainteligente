import { NextRequest, NextResponse } from 'next/server';

// ══════════════════════════════════════════════════════════════
// POST /api/scan-invoice
// Recibe: multipart/form-data con campo "file" (imagen o PDF)
// Devuelve: JSON con datos extraídos de la factura
// ══════════════════════════════════════════════════════════════

const PROMPT = `Eres un experto en análisis de facturas venezolanas y latinoamericanas.
Analiza con precisión esta imagen de factura/recibo de compra y extrae TODOS los datos en formato JSON.

Devuelve ÚNICAMENTE este JSON sin explicaciones ni markdown:
{
  "invoice_number": "número de factura (string)",
  "supplier_name": "nombre o razón social del proveedor (string)",
  "supplier_rif": "RIF del proveedor en formato J-XXXXXXXX-X o V-XXXXXXXX-X (string)",
  "date": "fecha en formato YYYY-MM-DD (string)",
  "currency": "USD o VES o EUR (string, detectar por símbolo $ o Bs)",
  "subtotal": 0,
  "iva": 0,
  "total": 0,
  "items": [
    {
      "description": "descripción del ítem (string)",
      "quantity": 0,
      "unit": "UND o MTR o KG o LT etc (string)",
      "unit_price": 0,
      "total_price": 0
    }
  ],
  "notes": "cualquier observación relevante (string, puede ser vacío)"
}

Reglas importantes:
- Si un campo no está visible, usa null o 0
- Las cantidades y precios siempre deben ser números, sin símbolo de moneda
- La fecha siempre en formato YYYY-MM-DD
- Si la moneda no es clara, asume USD
- Extrae TODOS los ítems de la factura, no omitas ninguno
- Normaliza descripción de ítems al español`;

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'TU_GEMINI_API_KEY_AQUI') {
        return NextResponse.json(
            { error: 'GEMINI_API_KEY no configurada. Ve a .env.local y agrega tu clave.' },
            { status: 500 }
        );
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        const mimeType = file.type || 'image/jpeg';

        // Call Gemini 2.0 Flash (vision) — con retry para rate limit del tier gratuito
        const MODEL = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
        const body = JSON.stringify({
            contents: [{
                parts: [
                    { text: PROMPT },
                    { inline_data: { mime_type: mimeType, data: base64 } }
                ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        });

        let geminiRes: Response | null = null;
        const MAX_RETRIES = 2;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            geminiRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
            if (geminiRes.status !== 429) break;
            // Rate limit — esperar 30s antes del next attempt
            const waitSec = 30;
            console.log(`Gemini 429 — reintento ${attempt}/${MAX_RETRIES} en ${waitSec}s...`);
            if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, waitSec * 1000));
        }

        if (!geminiRes) {
            return NextResponse.json({ error: 'No se pudo conectar con Gemini API.' }, { status: 502 });
        }

        // Si después de reintentos sigue siendo 429, devolver 429 explícito al frontend
        if (geminiRes.status === 429) {
            return NextResponse.json(
                { error: 'Límite de peticiones de Gemini alcanzado. Espera 1 minuto e intenta de nuevo.', code: 'RATE_LIMIT' },
                { status: 429 }
            );
        }

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error('Gemini API error:', errText);
            return NextResponse.json(
                { error: `Error de Gemini API: ${geminiRes.status}`, detail: errText },
                { status: 502 }
            );
        }

        const geminiData = await geminiRes.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        // Extract JSON from response (Gemini sometimes wraps in ```json```)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return NextResponse.json(
                { error: 'Gemini no devolvió JSON válido.', raw: rawText },
                { status: 422 }
            );
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return NextResponse.json({ success: true, data: parsed });

    } catch (err: any) {
        console.error('scan-invoice error:', err);
        return NextResponse.json(
            { error: err.message ?? 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}

// Max body size para PDFs e imágenes grandes
export const config = {
    api: { bodyParser: false }
};
