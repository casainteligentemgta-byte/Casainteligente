import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import {
    generateContractRequestSchema,
    computeContractDerived,
} from '@/lib/contracts/schema';
import { generateContractPdf } from '@/lib/contracts/generate-pdf';
import { uploadContractPdf } from '@/lib/contracts/upload-pdf';
import type { ContractData } from '@/lib/contracts/types';

const EMPRESA = 'Casa Inteligente C.A.';

function isSupabaseConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes('fetch failed') ||
        message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('supabase')
    );
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = cookies();
        const supabase = createClient(cookieStore);

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'No autorizado. Debes iniciar sesión para generar contratos.' },
                { status: 401 }
            );
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Cuerpo de la petición JSON inválido.' }, { status: 400 });
        }

        const parsed = generateContractRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 422 }
            );
        }

        const data = parsed.data;
        const derived = computeContractDerived(data);

        const pdfBuffer = await generateContractPdf({
            ...data,
            ...derived,
            empresa: EMPRESA,
            fecha_firma: new Date().toLocaleDateString('es-VE'),
        });

        const { publicUrl } = await uploadContractPdf(pdfBuffer, data.client_ci);

        const contractRecord: ContractData = {
            ...data,
            pdf_url: publicUrl,
            status: 'generado',
        };

        const admin = createAdminClient();
        const { data: inserted, error: insertError } = await admin
            .from('contracts')
            .insert(contractRecord)
            .select('id, pdf_url')
            .single();

        if (insertError) {
            return NextResponse.json(
                {
                    error: 'Error al guardar el contrato en la base de datos',
                    detail: insertError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            contract_id: inserted.id,
            pdf_url: inserted.pdf_url,
            derived,
        });
    } catch (error) {
        console.error('generate-contract error:', error);

        if (isSupabaseConnectionError(error)) {
            return NextResponse.json(
                {
                    error: 'Error de conexión con Supabase. Verifica la configuración y la disponibilidad del servicio.',
                    detail: error instanceof Error ? error.message : 'Error desconocido',
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                error: 'Error interno al generar el contrato.',
                detail: error instanceof Error ? error.message : 'Error desconocido',
            },
            { status: 500 }
        );
    }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
