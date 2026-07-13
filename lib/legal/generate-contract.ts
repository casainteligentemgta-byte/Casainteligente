import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { createAdminClient } from '@/lib/supabase-admin';
import type { ContractFormValues } from '@/lib/legal/schema';

const TEMPLATE_PATH = path.join(process.cwd(), 'lib', 'contract-template.hbs');
const BUCKET_NAME = 'contratos';
const EMPRESA = 'Casa Inteligente C.A.';

let compiledTemplate: HandlebarsTemplateDelegate | null = null;
let helpersRegistered = false;

function registerHelpers() {
    if (helpersRegistered) return;
    Handlebars.registerHelper('formatUSD', (value: number) => {
        const n = Number(value) || 0;
        return n.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    });
    helpersRegistered = true;
}

function getTemplate(): HandlebarsTemplateDelegate {
    if (!compiledTemplate) {
        const source = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
        compiledTemplate = Handlebars.compile(source);
    }
    return compiledTemplate;
}

/**
 * Genera el PDF del contrato (Handlebars + Puppeteer).
 * Listo para integrar desde la Server Action en el siguiente paso.
 */
export async function generateContractPdf(data: ContractFormValues): Promise<Buffer> {
    registerHelpers();

    const net_project_cost = Math.max(0, data.project_cost - data.discount_amount);
    const estimated_fee = (net_project_cost * data.fee_percentage) / 100;
    const applicable_fee = Math.max(estimated_fee, data.monthly_min_fee);

    const html = getTemplate()({
        ...data,
        net_project_cost,
        estimated_fee,
        applicable_fee,
        empresa: EMPRESA,
        fecha_firma: new Date().toLocaleDateString('es-VE'),
        // Plantilla histórica puede requerir alcance; defaults seguros
        substitution_target: (data as ContractFormValues & { substitution_target?: string })
            .substitution_target ?? 'Por definir según alcance técnico pactado',
        salvage_target: (data as ContractFormValues & { salvage_target?: string }).salvage_target
            ?? 'Por definir según alcance técnico pactado',
    });

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}

/**
 * Sube el PDF al bucket `contratos` de Supabase Storage.
 */
export async function uploadContract(
    fileBuffer: Buffer,
    contractId: string
): Promise<{ path: string; publicUrl: string }> {
    const supabase = createAdminClient();
    const filePath = `${contractId}/contrato-administracion-delegada.pdf`;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
    });

    if (error) {
        throw new Error(`Error al subir PDF a Storage: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return { path: filePath, publicUrl: data.publicUrl };
}
