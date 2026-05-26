/** Payload para la vista LuloWeb ERP (capítulos → partidas → APU). */

export type LuloWebErpCapitulo = {
  id: string;
  numCap: number;
  nombre: string;
};

export type LuloWebErpPartida = {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  rendimiento: number;
};

export type LuloWebErpMaterial = {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio: number;
};

export type LuloWebErpEquipo = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  tarifa: number;
  esPorcentajeManoObra?: boolean;
};

export type LuloWebErpManoObra = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  salario: number;
  bono: number;
};

export type LuloWebErpApuPartida = {
  materiales: LuloWebErpMaterial[];
  equipos: LuloWebErpEquipo[];
  manoObra: LuloWebErpManoObra[];
};

export type LuloWebErpConfig = {
  prestacionesSociales: number;
  gastosAdministrativos: number;
  utilidad: number;
};

export type LuloWebErpPayload = {
  fuente: 'ci_presupuesto' | 'lulo_catalogo' | 'cascada' | 'vacio';
  proyecto: {
    id: string;
    nombre: string;
    codigoLulo?: string | null;
  };
  config: LuloWebErpConfig;
  capitulos: LuloWebErpCapitulo[];
  partidasByCapitulo: Record<string, LuloWebErpPartida[]>;
  apuByPartidaId: Record<string, LuloWebErpApuPartida>;
};
