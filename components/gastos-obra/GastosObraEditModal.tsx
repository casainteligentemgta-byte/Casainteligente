'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { GastoObraEditableField } from '@/types/gastos-obra';

const LABELS: Record<GastoObraEditableField, string> = {
  fecha: 'Fecha',
  tipo: 'Tipo de gasto',
  disciplina: 'Área / disciplina',
  proveedor: 'Proveedor',
};

type Props = {
  open: boolean;
  onClose: () => void;
  field: GastoObraEditableField;
  valorActual: string;
  transactionId?: string;
  proveedorAnterior?: string;
  bulkProveedor?: boolean;
  onSave: (nuevoValor: string) => Promise<boolean>;
};

export default function GastosObraEditModal({
  open,
  onClose,
  field,
  valorActual,
  transactionId,
  proveedorAnterior,
  bulkProveedor,
  onSave,
}: Props) {
  const [valor, setValor] = useState(valorActual);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setValor(valorActual);
  }, [open, valorActual]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const ok = await onSave(valor);
    setGuardando(false);
    if (ok) onClose();
  }

  const inputType = field === 'fecha' ? 'date' : 'text';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-gray-200 bg-white text-gray-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {LABELS[field]}</DialogTitle>
          <DialogDescription className="text-gray-500">
            {bulkProveedor && field === 'proveedor'
              ? `Se actualizarán todas las filas del proveedor «${proveedorAnterior}».`
              : transactionId
                ? 'Cambio en esta transacción únicamente.'
                : 'Actualiza el valor en Supabase.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-gasto-valor" className="text-gray-700">
              {LABELS[field]}
            </Label>
            <Input
              id="edit-gasto-valor"
              type={inputType}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="border-gray-200 bg-white text-gray-900"
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-200">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



