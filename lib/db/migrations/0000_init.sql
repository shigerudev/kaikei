CREATE TYPE "public"."ai_review_outcome" AS ENUM('pending', 'accepted', 'edited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ai_validation_status" AS ENUM('valid', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('extracted', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('suggested', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."flag_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('proposed', 'applied');--> statement-breakpoint
CREATE TYPE "public"."import_type" AS ENUM('budget', 'actual');--> statement-breakpoint
CREATE TYPE "public"."source_file_kind" AS ENUM('csv_budget', 'csv_actual', 'pdf');--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"target_ref" text NOT NULL,
	"proposed" jsonb NOT NULL,
	"rationale" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"context_hash" text NOT NULL,
	"validation_status" "ai_validation_status" NOT NULL,
	"review_outcome" "ai_review_outcome" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"period" char(7) NOT NULL,
	"category_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"source_row_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"deltas" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"supplier" text,
	"doc_date" date,
	"currency" char(3),
	"total_minor" bigint,
	"fields_confidence" jsonb,
	"status" "document_status" DEFAULT 'extracted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_links" (
	"document_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"status" "evidence_status" DEFAULT 'suggested' NOT NULL,
	"score" real NOT NULL,
	"reasons" jsonb NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "evidence_links_document_id_transaction_id_pk" PRIMARY KEY("document_id","transaction_id")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"import_id" uuid,
	"rule" text NOT NULL,
	"severity" "flag_severity" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"file_id" uuid,
	"row_number" integer,
	"column" text,
	"reason" text NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"type" "import_type" NOT NULL,
	"mapping" jsonb,
	"status" "import_status" DEFAULT 'proposed' NOT NULL,
	"counts" jsonb,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" "source_file_kind" NOT NULL,
	"filename" text NOT NULL,
	"sha256" char(64) NOT NULL,
	"blob_url" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"category_id" uuid,
	"description" text,
	"counterparty" text,
	"fingerprint" text NOT NULL,
	"source_row_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_currency" char(3) NOT NULL,
	"mcp_token" text NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_mcp_token_unique" UNIQUE("mcp_token")
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_source_row_id_source_rows_id_fk" FOREIGN KEY ("source_row_id") REFERENCES "public"."source_rows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_superseded_by_budget_lines_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."budget_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_source_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."source_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_file_id_source_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_file_id_source_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."source_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_rows" ADD CONSTRAINT "source_rows_file_id_source_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."source_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_row_id_source_rows_id_fk" FOREIGN KEY ("source_row_id") REFERENCES "public"."source_rows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_lines_active_key_uq" ON "budget_lines" USING btree ("workspace_id","period","category_id","currency") WHERE "budget_lines"."superseded_by" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_ws_name_uq" ON "categories" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_links_one_confirmed_per_doc_uq" ON "evidence_links" USING btree ("document_id") WHERE "evidence_links"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "flags_ws_status_idx" ON "flags" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "source_files_ws_sha_uq" ON "source_files" USING btree ("workspace_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "source_rows_file_row_uq" ON "source_rows" USING btree ("file_id","row_number");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_ws_fingerprint_uq" ON "transactions" USING btree ("workspace_id","fingerprint");--> statement-breakpoint
CREATE INDEX "transactions_ws_date_idx" ON "transactions" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "transactions_ws_category_idx" ON "transactions" USING btree ("workspace_id","category_id");