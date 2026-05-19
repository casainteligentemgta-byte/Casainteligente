export type GastoObra = {
  id: string;
  fecha: string;
  tipo: string;
  disciplina: string;
  proveedor: string;
  descripcion: string;
  costo: number;
};

export type GastoObraEditableField = 'fecha' | 'tipo' | 'disciplina' | 'proveedor';

export type GastosObraFiltros = {
  mes: string;
  tipo: string;
  disciplina: string;
};

export const FILTRO_TODOS = '__todos__';
