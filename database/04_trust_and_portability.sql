-- =============================================================================
-- AURA TALENT AI - 04: Evidencia portable y vacantes transparentes
-- Migracion idempotente para instalaciones existentes. Ejecutar en aura_talent.
-- =============================================================================
SET ROLE aura_app;
BEGIN;

ALTER TABLE job_postings
    ADD COLUMN IF NOT EXISTS benefits text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS schedule_description varchar(300),
    ADD COLUMN IF NOT EXISTS response_sla_days smallint,
    ADD COLUMN IF NOT EXISTS process_estimate_days smallint,
    ADD COLUMN IF NOT EXISTS last_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_confirmed_by uuid REFERENCES users (id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_job_response_sla_days') THEN
        ALTER TABLE job_postings ADD CONSTRAINT ck_job_response_sla_days
            CHECK (response_sla_days BETWEEN 1 AND 30 OR response_sla_days IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_job_process_estimate_days') THEN
        ALTER TABLE job_postings ADD CONSTRAINT ck_job_process_estimate_days
            CHECK (process_estimate_days BETWEEN 1 AND 180 OR process_estimate_days IS NULL);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS skill_evidence (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id         uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    skill_id             uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
    evidence_type        varchar(25) NOT NULL CHECK (evidence_type IN ('project', 'credential', 'certificate', 'work_sample', 'other')),
    title                varchar(200) NOT NULL,
    description          text,
    evidence_url         varchar(500),
    issuer               varchar(200),
    credential_ref       varchar(300),
    source               varchar(20) NOT NULL DEFAULT 'candidate_submitted'
                         CHECK (source IN ('candidate_submitted', 'open_badge_import')),
    share_with_companies boolean NOT NULL DEFAULT false,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz
);
CREATE INDEX IF NOT EXISTS ix_skill_evidence_candidate ON skill_evidence (candidate_id, skill_id)
    WHERE deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_skill_evidence_updated_at'
    ) THEN
        CREATE TRIGGER trg_skill_evidence_updated_at BEFORE UPDATE ON skill_evidence
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;

COMMIT;
RESET ROLE;
