/**
 * Registro de módulos core Nexus Home (rutas y descripción para navegación y docs).
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
    href: '/nexus/clientes',
    label: 'Clientes',
    description: 'Directorio B2C / B2B e inmuebles',
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
  {
    href: '/nexus/vision',
    label: 'AI & Vision',
    description: 'Architect heatmap · AR campo',
    icon: Sparkles,
    group: 'concept',
  },
];
