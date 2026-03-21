-- Nexus Home — esquema ERP/CRM (tablas nexus_*)
-- Ejecutar una vez en Supabase SQL Editor (o: npm run db:push con DATABASE_URL)
-- Coexiste con customers, budgets, productos, etc.

DO $$ BEGIN
  CREATE TYPE nexus_client_type AS ENUM ('person', 'organization');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nexus_catalog_kind AS ENUM ('hardware', 'service');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nexus_proposal_status AS ENUM (
    'draft', 'proposal_sent', 'approved', 'rejected', 'contract_signed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nexus_contract_status AS ENUM ('draft', 'pending_signature', 'signed', 'void');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nexus_milestone_phase AS ENUM ('cabling', 'mounting', 'calibration', 'handover');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nexus_milestone_status AS ENUM ('pending', 'in_progress', 'done', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.nexus_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type nexus_client_type NOT NULL,
  display_name text NOT NULL,
  email text,
  phone text,
  tax_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexus_client_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.nexus_clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  address_line text NOT NULL,
  city text,
  region text,
  postal_code text,
  lat numeric(10,7),
  lng numeric(10,7),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexus_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind nexus_catalog_kind NOT NULL,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  unit_price numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  stock_qty integer,
  is_active boolean NOT NULL DEFAULT true,
  specs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexus_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.nexus_clients(id),
  status nexus_proposal_status NOT NULL DEFAULT 'draft',
  title text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  margin_min_pct numeric(5,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexus_proposal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.nexus_proposals(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.nexus_catalog_items(id),
  label text NOT NULL,
  qty numeric(14,3) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.nexus_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.nexus_proposals(id) ON DELETE RESTRICT,
  status nexus_contract_status NOT NULL DEFAULT 'draft',
  pdf_storage_path text,
  legal_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nexus_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.nexus_contracts(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signature_data text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexus_installation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.nexus_contracts(id),
  property_id uuid REFERENCES public.nexus_client_properties(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'planning',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nexus_project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.nexus_installation_projects(id) ON DELETE CASCADE,
  phase nexus_milestone_phase NOT NULL,
  status nexus_milestone_status NOT NULL DEFAULT 'pending',
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nexus_properties_client ON public.nexus_client_properties(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_proposals_client ON public.nexus_proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_nexus_lines_proposal ON public.nexus_proposal_lines(proposal_id);
CREATE INDEX IF NOT EXISTS idx_nexus_contracts_proposal ON public.nexus_contracts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_nexus_projects_contract ON public.nexus_installation_projects(contract_id);

COMMENT ON TABLE public.nexus_clients IS 'Nexus Home: directorio B2C/B2B';
COMMENT ON TABLE public.nexus_catalog_items IS 'Nexus Home: hardware y servicios con SKU';
