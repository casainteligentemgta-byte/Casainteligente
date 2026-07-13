import { createAdminClient } from '@/lib/supabase-admin';

const BUCKET_NAME = 'contratos';

export interface UploadContractPdfResult {
    path: string;
    publicUrl: string;
}

export async function uploadContractPdf(
    pdfBuffer: Buffer,
    empleadoId: string
): Promise<UploadContractPdfResult> {
    const supabase = createAdminClient();
    const timestamp = Date.now();
    const filePath = `${empleadoId}/contrato-${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: false,
        });

    if (uploadError) {
        throw new Error(`Error al subir PDF a Storage: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return {
        path: filePath,
        publicUrl: urlData.publicUrl,
    };
}
