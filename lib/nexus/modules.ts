/**
 * Registro de módulos core Nexus Home (rutas y descripción para navegación y docs).
 *
 * Clientes: un solo directorio, la tabla `customers` (/clientes). El directorio propio de
 * Nexus (`nexus_clients`, /nexus/clientes) se retiró; nunca tuvo registros.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  Package,
  PenLine,
  Sparkles,
  Wrench,
} from 'lucide-react';

export type NexusModule = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'core' | 'commercial' | 'field' | 'concept';
};

export const NEXUS_MODULES: NexusModule[] = [
  {
    href: '/nexus',
    label: 'Panel',
    description: 'Resumen operativo escritorio',
    icon: LayoutDashboard,
    group: 'core',
  },
  {
    href: '/clientes',
    label: 'Clientes',
    description: 'Directorio único de clientes',
    icon: Building2,
    group: 'core',
  },
  {
    href: '/nexus/catalogo',
    label: 'Catálogo',
    description: 'Hardware, servicios, SKU y stock',
    icon: Package,
    group: 'core',
  },
  {
    href: '/nexus/vision',
    label: 'CCTV · NetVision Pro',
    description: 'Cámaras, redes, cableado, normas y BIM',
    icon: Sparkles,
    group: 'commercial',
  },
  {
    href: '/nexus/builder',
    label: 'Nexus Builder',
    description: 'Presupuesto arrastrar-soltar',
    icon: Wrench,
    group: 'commercial',
  },
  {
    href: '/nexus/proyectos',
    label: 'Proyectos',
    description: 'Obra, timeline y hitos',
    icon: FolderKanban,
    group: 'commercial',
  },
  {
    href: '/nexus/contratos/demo/firmar',
    label: 'Firma (demo)',
    description: 'Contratación digital y cierre',
    icon: PenLine,
    group: 'commercial',
  },
];
