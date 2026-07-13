import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import type { ContractTemplateContext } from './types';

const TEMPLATE_PATH = path.join(process.cwd(), 'lib', 'contract-template.hbs');

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
    if (!compiledTemplate) {
        const source = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
        compiledTemplate = Handlebars.compile(source);
    }
    return compiledTemplate;
}

function registerHelpers() {
    Handlebars.registerHelper('formatUSD', (value: number) => {
        const n = Number(value) || 0;
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
}

export async function generateContractPdf(context: ContractTemplateContext): Promise<Buffer> {
    registerHelpers();
    const html = getTemplate()(context);

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
