import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateContractRequestSchema } from '@/lib/contracts/schema';
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

        const { data: { user }, error: authError } = await supabase.auth.getUser();
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
        const digitalSignature =
            data.digital_signature ??
            `Firmado digitalmente por RRHH - ${new Date().toLocaleDateString('es-VE')}`;

        const pdfBuffer = await generateContractPdf({
            empresa: EMPRESA,
            nombre: data.nombre,
            cedula: data.cedula,
            telefono: data.telefono,
            direccion: data.direccion,
            cargo: data.cargo_acordado,
            salario_base: data.salario_base,
            bonificaciones: data.bonificaciones,
            fecha_ingreso: data.fecha_ingreso,
            fecha_firma: new Date().toLocaleDateString('es-VE'),
            digital_signature: digitalSignature,
        });

        const { publicUrl } = await uploadContractPdf(pdfBuffer, data.empleado_id);

        const contractRecord: ContractData = {
            empleado_id: data.empleado_id,
            cargo_acordado: data.cargo_acordado,
            salario_base: data.salario_base,
            bonificaciones: data.bonificaciones,
            fecha_ingreso: data.fecha_ingreso,
            estado: data.estado,
            pdf_url: publicUrl,
        };

        const admin = createAdminClient();
        const { data: inserted, error: insertError } = await admin
            .from('ci_contratos')
            .insert(contractRecord)
            .select('id, pdf_url')
            .single();

        if (insertError) {
            return NextResponse.json(
                { error: 'Error al guardar el contrato en la base de datos', detail: insertError.message },
                { status: 500 }
            );
        }

        const { error: empleadoError } = await admin
            .from('ci_empleados')
            .update({ estado_proceso: 'examen_completado' })
            .eq('id', data.empleado_id);

        if (empleadoError) {
            console.error('Error actualizando empleado:', empleadoError);
        }

        return NextResponse.json({
            success: true,
            contract_id: inserted.id,
            pdf_url: inserted.pdf_url,
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
