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

export async function generateContractPdf(context: ContractTemplateContext): Promise<Buffer> {
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
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        });

        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}
