/**
 * Expediente de Obra Digital (LOTTT) — espejo Drizzle de `113_obra_digital_expediente_laboral.sql`.
 * La fuente de verdad para DDL y FSM es la migración Supabase.
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const obraDigitalLaborContracts = pgTable('obra_digital_labor_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerName: text('worker_name').notNull(),
  workerCi: text('worker_ci').notNull().unique(),
  contractStatus: text('contract_status').notNull().default('PENDIENTE_DOCUMENTOS'),
  oficio: text('oficio').notNull(),
  salaryPerDay: numeric('salary_per_day', { precision: 14, scale: 2 }).notNull(),
  luloPartidaMeta: text('lulo_partida_meta').notNull(),
  projectId: uuid('project_id'),
  empleadoId: uuid('empleado_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obraDigitalDocuments = pgTable('obra_digital_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => obraDigitalLaborContracts.id, { onDelete: 'cascade' }),
  docType: text('doc_type').notNull(),
  storageBucket: text('storage_bucket').notNull().default('worker-docs'),
  storagePath: text('storage_path').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  escaneoFirmaVisible: boolean('escaneo_firma_visible').notNull().default(false),
  escaneoHuellaVisible: boolean('escaneo_huella_visible').notNull().default(false),
  referenceMonth: smallint('reference_month'),
  referenceYear: smallint('reference_year'),
  referenceWeek: smallint('reference_week'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obraDigitalToolAssignments = pgTable('obra_digital_tool_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => obraDigitalLaborContracts.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  serialNumber: text('serial_number').notNull(),
  status: text('status').notNull().default('BAJO_CUSTODIA'),
  replacementValue: numeric('replacement_value', { precision: 14, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obraDigitalMonthlyAdvances = pgTable('obra_digital_monthly_advances', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => obraDigitalLaborContracts.id, { onDelete: 'cascade' }),
  month: smallint('month').notNull(),
  year: smallint('year').notNull(),
  calculatedAccrued: numeric('calculated_accrued', { precision: 14, scale: 2 }).notNull(),
  maxAdvanceAllowed: numeric('max_advance_allowed', { precision: 14, scale: 2 }).notNull(),
  status: text('status').notNull().default('PAGO_BLOQUEADO'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obraDigitalDailyProgress = pgTable('obra_digital_daily_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id')
    .notNull()
    .references(() => obraDigitalLaborContracts.id, { onDelete: 'cascade' }),
  workDate: date('work_date').notNull(),
  physicalAdvance: numeric('physical_advance', { precision: 14, scale: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obraDigitalLaborContractsRelations = relations(obraDigitalLaborContracts, ({ many }) => ({
  documents: many(obraDigitalDocuments),
  tools: many(obraDigitalToolAssignments),
  advances: many(obraDigitalMonthlyAdvances),
  dailyProgress: many(obraDigitalDailyProgress),
}));

export const obraDigitalDocumentsRelations = relations(obraDigitalDocuments, ({ one }) => ({
  contract: one(obraDigitalLaborContracts, {
    fields: [obraDigitalDocuments.contractId],
    references: [obraDigitalLaborContracts.id],
  }),
}));
