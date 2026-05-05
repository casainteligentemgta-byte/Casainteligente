/**
 * Esquema Nexus Home — ERP/CRM domótica de lujo.
 * Tablas prefijadas nexus_* para coexistir con el CRM legado (customers, budgets, …).
 */
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/* ─── Enums ───────────────────────────────────────── */

export const nexusClientType = pgEnum('nexus_client_type', ['person', 'organization']);
export const nexusCatalogKind = pgEnum('nexus_catalog_kind', ['hardware', 'service']);
export const nexusProposalStatus = pgEnum('nexus_proposal_status', [
  'draft',
  'proposal_sent',
  'approved',
  'rejected',
  'contract_signed',
  'archived',
]);
export const nexusContractStatus = pgEnum('nexus_contract_status', [
  'draft',
  'pending_signature',
  'signed',
  'void',
]);
export const nexusMilestonePhase = pgEnum('nexus_milestone_phase', [
  'cabling',
  'mounting',
  'calibration',
  'handover',
]);
export const nexusMilestoneStatus = pgEnum('nexus_milestone_status', [
  'pending',
  'in_progress',
  'done',
  'blocked',
]);

/* ─── Clientes + inmuebles ───────────────────────── */

export const nexusClients = pgTable('nexus_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: nexusClientType('type').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  taxId: text('tax_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nexusClientProperties = pgTable('nexus_client_properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .references(() => nexusClients.id, { onDelete: 'cascade' })
    .notNull(),
  label: text('label').notNull(),
  addressLine: text('address_line').notNull(),
  city: text('city'),
  region: text('region'),
  postalCode: text('postal_code'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ─── Catálogo ──────────────────────────────────── */

export const nexusCatalogItems = pgTable('nexus_catalog_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: nexusCatalogKind('kind').notNull(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').default('USD').notNull(),
  /** null = N/A (servicios); entero = unidades disponibles */
  stockQty: integer('stock_qty'),
  isActive: boolean('is_active').default(true).notNull(),
  specs: jsonb('specs'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ─── Presupuestos / propuestas ─────────────────── */

export const nexusProposals = pgTable('nexus_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => nexusClients.id),
  status: nexusProposalStatus('status').default('draft').notNull(),
  title: text('title'),
  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).default('0').notNull(),
  taxRate: numeric('tax_rate', { precision: 7, scale: 4 }).default('0').notNull(),
  taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).default('0').notNull(),
  discountTotal: numeric('discount_total', { precision: 14, scale: 2 }).default('0').notNull(),
  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).default('0').notNull(),
  marginMinPct: numeric('margin_min_pct', { precision: 5, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nexusProposalLines = pgTable('nexus_proposal_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id')
    .references(() => nexusProposals.id, { onDelete: 'cascade' })
    .notNull(),
  catalogItemId: uuid('catalog_item_id').references(() => nexusCatalogItems.id),
  label: text('label').notNull(),
  qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 14, scale: 2 }).notNull(),
  discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).default('0').notNull(),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

/* ─── Contratos + firma ─────────────────────────── */

export const nexusContracts = pgTable('nexus_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id')
    .references(() => nexusProposals.id, { onDelete: 'restrict' })
    .notNull(),
  status: nexusContractStatus('status').default('draft').notNull(),
  pdfStoragePath: text('pdf_storage_path'),
  legalVersion: text('legal_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  signedAt: timestamp('signed_at', { withTimezone: true }),
});

export const nexusSignatures = pgTable('nexus_signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .references(() => nexusContracts.id, { onDelete: 'cascade' })
    .notNull(),
  signerName: text('signer_name').notNull(),
  signatureData: text('signature_data').notNull(),
  signedAt: timestamp('signed_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ─── Proyectos de obra ─────────────────────────── */

export const nexusInstallationProjects = pgTable('nexus_installation_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').references(() => nexusContracts.id),
  propertyId: uuid('property_id').references(() => nexusClientProperties.id),
  title: text('title').notNull(),
  status: text('status').default('planning').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nexusProjectMilestones = pgTable('nexus_project_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => nexusInstallationProjects.id, { onDelete: 'cascade' })
    .notNull(),
  phase: nexusMilestonePhase('phase').notNull(),
  status: nexusMilestoneStatus('status').default('pending').notNull(),
  label: text('label'),
  sortOrder: integer('sort_order').default(0).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/** Módulo integral + obras Talento unificadas (`tipo_proyecto`: integral | talento). */
export const ciProyectos = pgTable('ci_proyectos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
});

/* ─── Reclutamiento inteligente (sesión + estado JSON) ───────── */

export const recruitmentSessions = pgTable('recruitment_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Estado serializado (turnos, análisis, eventos anti-fraude, scoring acumulado) */
  state: jsonb('state').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Necesidad de puesto (protocolo de reclutamiento asociado vía ?need= en /reclutamiento). */
export const recruitmentNeeds = pgTable('recruitment_needs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  notes: text('notes'),
  protocolActive: boolean('protocol_active').default(true).notNull(),
  cargoCodigo: text('cargo_codigo'),
  cargoNombre: text('cargo_nombre'),
  cargoNivel: integer('cargo_nivel'),
  tipoVacante: text('tipo_vacante'),
  /** FK a `ci_proyectos` (fila Talento o integral; antes apuntaba solo a obra). */
  proyectoId: uuid('proyecto_id').references(() => ciProyectos.id, { onDelete: 'restrict' }),
  /** FK a `ci_proyectos` (módulo integral). */
  proyectoModuloId: uuid('proyecto_modulo_id').references(() => ciProyectos.id, { onDelete: 'set null' }),
  alertaPresupuestoIgnorada: boolean('alerta_presupuesto_ignorada').default(false).notNull(),
  notasAutorizacion: text('notas_autorizacion'),
  /** Plazas pedidas para este cargo en el proyecto (misma fila / protocolo). */
  cantidadRequerida: integer('cantidad_requerida'),
  conteoClics: integer('conteo_clics').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/* ─── Relaciones (Drizzle Query) ───────────────── */

export const nexusClientsRelations = relations(nexusClients, ({ many }) => ({
  properties: many(nexusClientProperties),
  proposals: many(nexusProposals),
}));

export const nexusClientPropertiesRelations = relations(nexusClientProperties, ({ one }) => ({
  client: one(nexusClients, {
    fields: [nexusClientProperties.clientId],
    references: [nexusClients.id],
  }),
}));

export const nexusProposalsRelations = relations(nexusProposals, ({ one, many }) => ({
  client: one(nexusClients, {
    fields: [nexusProposals.clientId],
    references: [nexusClients.id],
  }),
  lines: many(nexusProposalLines),
  contracts: many(nexusContracts),
}));

export const nexusProposalLinesRelations = relations(nexusProposalLines, ({ one }) => ({
  proposal: one(nexusProposals, {
    fields: [nexusProposalLines.proposalId],
    references: [nexusProposals.id],
  }),
  catalogItem: one(nexusCatalogItems, {
    fields: [nexusProposalLines.catalogItemId],
    references: [nexusCatalogItems.id],
  }),
}));

export const nexusContractsRelations = relations(nexusContracts, ({ one, many }) => ({
  proposal: one(nexusProposals, {
    fields: [nexusContracts.proposalId],
    references: [nexusProposals.id],
  }),
  signatures: many(nexusSignatures),
  projects: many(nexusInstallationProjects),
}));

export const nexusSignaturesRelations = relations(nexusSignatures, ({ one }) => ({
  contract: one(nexusContracts, {
    fields: [nexusSignatures.contractId],
    references: [nexusContracts.id],
  }),
}));

export const nexusInstallationProjectsRelations = relations(
  nexusInstallationProjects,
  ({ one, many }) => ({
    contract: one(nexusContracts, {
      fields: [nexusInstallationProjects.contractId],
      references: [nexusContracts.id],
    }),
    property: one(nexusClientProperties, {
      fields: [nexusInstallationProjects.propertyId],
      references: [nexusClientProperties.id],
    }),
    milestones: many(nexusProjectMilestones),
  }),
);

export const nexusProjectMilestonesRelations = relations(nexusProjectMilestones, ({ one }) => ({
  project: one(nexusInstallationProjects, {
    fields: [nexusProjectMilestones.projectId],
    references: [nexusInstallationProjects.id],
  }),
}));
