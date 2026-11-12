CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TABLE "dependency_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"package_name" text NOT NULL,
	"version" text NOT NULL,
	"vuln_id" text NOT NULL,
	"severity" "severity" NOT NULL,
	"summary" text,
	"fixed_version" text,
	"is_direct" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"commit_sha" char(40),
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"score" smallint,
	"error_message" text,
	"stats" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "scans_score_range" CHECK ("scans"."score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "secret_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"severity" "severity" NOT NULL,
	"file_path" text NOT NULL,
	"line" integer NOT NULL,
	"redacted_match" text NOT NULL,
	"fingerprint" char(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dependency_findings" ADD CONSTRAINT "dependency_findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_findings" ADD CONSTRAINT "secret_findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dependency_findings_scan_id_idx" ON "dependency_findings" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "scans_repo_sha_idx" ON "scans" USING btree ("owner","repo","commit_sha");--> statement-breakpoint
CREATE INDEX "secret_findings_scan_id_idx" ON "secret_findings" USING btree ("scan_id");