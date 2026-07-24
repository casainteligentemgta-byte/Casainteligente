CREATE TYPE "public"."nexus_catalog_kind" AS ENUM('hardware', 'service');--> statement-breakpoint
CREATE TYPE "public"."nexus_client_type" AS ENUM('person', 'organization');--> statement-breakpoint
CREATE TYPE "public"."nexus_contract_status" AS ENUM('draft', 'pending_signature', 'signed', 'void');--> statement-breakpoint
CREATE TYPE "public"."nexus_milestone_phase" AS ENUM('cabling', 'mounting', 'calibration', 'handover');--> statement-breakpoint
CREATE TYPE "public"."nexus_milestone_status" AS ENUM('pending', 'in_progress', 'done', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."nexus_proposal_status" AS ENUM('draft', 'proposal_sent', 'approved', 'rejected', 'contract_signed', 'archived');--> statement-breakpoint
CREATE TABLE "nexus_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "nexus_catalog_kind" NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_price" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stock_qty" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"specs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nexus_catalog_items_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "nexus_client_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address_line" text NOT NULL,
	"city" text,
	"region" text,
	"postal_code" text,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "nexus_client_type" NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"tax_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"status" "nexus_contract_status" DEFAULT 'draft' NOT NULL,
	"pdf_storage_path" text,
	"legal_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nexus_installation_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid,
	"property_id" uuid,
	"title" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_project_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"phase" "nexus_milestone_phase" NOT NULL,
	"status" "nexus_milestone_status" DEFAULT 'pending' NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nexus_proposal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"label" text NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"status" "nexus_proposal_status" DEFAULT 'draft' NOT NULL,
	"title" text,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"margin_min_pct" numeric(5, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nexus_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signature_data" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruitment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nexus_client_properties" ADD CONSTRAINT "nexus_client_properties_client_id_nexus_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nexus_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_contracts" ADD CONSTRAINT "nexus_contracts_proposal_id_nexus_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."nexus_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_installation_projects" ADD CONSTRAINT "nexus_installation_projects_contract_id_nexus_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."nexus_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_installation_projects" ADD CONSTRAINT "nexus_installation_projects_property_id_nexus_client_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."nexus_client_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_project_milestones" ADD CONSTRAINT "nexus_project_milestones_project_id_nexus_installation_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."nexus_installation_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_proposal_lines" ADD CONSTRAINT "nexus_proposal_lines_proposal_id_nexus_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."nexus_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_proposal_lines" ADD CONSTRAINT "nexus_proposal_lines_catalog_item_id_nexus_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."nexus_catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_proposals" ADD CONSTRAINT "nexus_proposals_client_id_nexus_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."nexus_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus_signatures" ADD CONSTRAINT "nexus_signatures_contract_id_nexus_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."nexus_contracts"("id") ON DELETE cascade ON UPDATE no action;