-- =============================================================================
-- AURA TALENT AI - 01: Esquema completo
-- Ejecutar sobre la base aura_talent (psql o Query Tool de pgAdmin).
-- Todas las tablas quedan con propietario aura_app.
--
-- Convenciones:
--   * PK UUID (gen_random_uuid)
--   * created_at / updated_at (timestamptz) con trigger automatico
--   * deleted_at para soft delete donde corresponde
--   * Estados validados con CHECK (mas faciles de evolucionar que ENUM)
--   * Embeddings como real[] (pgvector no esta instalado; similitud en Python)
-- =============================================================================

SET ROLE aura_app;

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Funciones utilitarias
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- =============================================================================
-- IDENTIDAD Y ACCESO
-- =============================================================================
CREATE TABLE users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 citext       NOT NULL,
    password_hash         text         NOT NULL,
    full_name             varchar(150) NOT NULL,
    phone                 varchar(30),
    status                varchar(20)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'active', 'suspended')),
    locale                varchar(10)  NOT NULL DEFAULT 'es',
    email_verified_at     timestamptz,
    last_login_at         timestamptz,
    mfa_enabled           boolean      NOT NULL DEFAULT false,
    failed_login_attempts integer      NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until          timestamptz,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    deleted_at            timestamptz
);
CREATE UNIQUE INDEX uq_users_email_active ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX ix_users_status ON users (status) WHERE deleted_at IS NULL;

CREATE TABLE roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(50)  NOT NULL UNIQUE,
    name        varchar(100) NOT NULL,
    description text,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(100) NOT NULL UNIQUE,
    module      varchar(50)  NOT NULL,
    description text,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id       uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX ix_role_permissions_permission ON role_permissions (permission_id);

-- =============================================================================
-- EMPRESAS
-- =============================================================================
CREATE TABLE companies (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(150) NOT NULL,
    slug          citext       NOT NULL,
    description   text,
    sector        varchar(100),
    location      varchar(150),
    website       varchar(300),
    size_range    varchar(20)
                  CHECK (size_range IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
    culture       text,
    benefits      jsonb        NOT NULL DEFAULT '[]'::jsonb,
    contact_email citext,
    logo_key      varchar(300),
    status        varchar(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'suspended')),
    created_by    uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);
CREATE UNIQUE INDEX uq_companies_slug_active ON companies (slug) WHERE deleted_at IS NULL;
CREATE INDEX ix_companies_name_trgm ON companies USING gin (name gin_trgm_ops);

CREATE TABLE company_users (
    company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    position   varchar(100),
    status     varchar(20) NOT NULL DEFAULT 'active'
               CHECK (status IN ('invited', 'active', 'removed')),
    joined_at  timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);
CREATE INDEX ix_company_users_user ON company_users (user_id);

-- company_id NULL = rol global (candidato, admin de sistema)
CREATE TABLE user_roles (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id    uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    company_id uuid REFERENCES companies (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_roles UNIQUE NULLS NOT DISTINCT (user_id, role_id, company_id)
);
CREATE INDEX ix_user_roles_user ON user_roles (user_id);
CREATE INDEX ix_user_roles_company ON user_roles (company_id);

CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  char(64)    NOT NULL UNIQUE,
    family_id   uuid        NOT NULL,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    replaced_by uuid REFERENCES refresh_tokens (id) ON DELETE SET NULL,
    user_agent  text,
    ip          inet,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (family_id);

-- Tokens de un solo uso: recuperacion de contrasena y verificacion de email
CREATE TABLE user_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    varchar(30) NOT NULL
               CHECK (purpose IN ('password_reset', 'email_verification')),
    token_hash char(64)    NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_user_tokens_user_purpose ON user_tokens (user_id, purpose);

CREATE TABLE consents (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    consent_type   varchar(40) NOT NULL
                   CHECK (consent_type IN ('terms', 'privacy', 'psychometric', 'biometric', 'voice',
                                           'camera', 'discoverable', 'company_data_sharing',
                                           'external_ai_processing')),
    policy_version varchar(20) NOT NULL,
    granted        boolean     NOT NULL,
    granted_at     timestamptz,
    revoked_at     timestamptz,
    ip             inet,
    user_agent     text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_consents_user_type ON consents (user_id, consent_type, created_at DESC);

CREATE TABLE audit_logs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    actor_type    varchar(10) NOT NULL CHECK (actor_type IN ('human', 'system', 'ai')),
    company_id    uuid REFERENCES companies (id) ON DELETE SET NULL,
    module        varchar(50)  NOT NULL,
    action        varchar(100) NOT NULL,
    entity_type   varchar(60),
    entity_id     uuid,
    result        varchar(10)  NOT NULL CHECK (result IN ('success', 'denied', 'error')),
    changes       jsonb,
    ip            inet,
    user_agent    text,
    request_id    varchar(64),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_actor ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX ix_audit_logs_company ON audit_logs (company_id, created_at DESC);
CREATE INDEX ix_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX ix_audit_logs_created ON audit_logs (created_at DESC);

-- =============================================================================
-- CANDIDATO
-- =============================================================================
CREATE TABLE candidate_profiles (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    headline             varchar(200),
    summary              text,
    location_city        varchar(100),
    location_country     varchar(100),
    availability         varchar(20)
                         CHECK (availability IN ('immediate', 'two_weeks', 'one_month',
                                                 'negotiable', 'not_available')),
    work_modality        varchar(10) CHECK (work_modality IN ('remote', 'hybrid', 'onsite', 'any')),
    desired_roles        text[]      NOT NULL DEFAULT '{}',
    salary_expectation   numeric(12, 2) CHECK (salary_expectation >= 0),
    salary_currency      char(3),
    goals                text,
    interests            text[]      NOT NULL DEFAULT '{}',
    is_discoverable      boolean     NOT NULL DEFAULT false,
    completeness         smallint    NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
    embedding            real[],
    embedding_model      varchar(100),
    embedding_updated_at timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz
);
CREATE INDEX ix_candidate_profiles_discoverable ON candidate_profiles (is_discoverable)
    WHERE deleted_at IS NULL AND is_discoverable;

CREATE TABLE education (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id   uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    institution    varchar(200) NOT NULL,
    degree         varchar(200),
    field_of_study varchar(200),
    level          varchar(20)
                   CHECK (level IN ('secondary', 'technical', 'bachelor', 'master', 'doctorate',
                                    'bootcamp', 'certificate', 'other')),
    start_date     date,
    end_date       date,
    is_current     boolean     NOT NULL DEFAULT false,
    description    text,
    source         varchar(15) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cv_parsed')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX ix_education_candidate ON education (candidate_id) WHERE deleted_at IS NULL;

CREATE TABLE experiences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id    uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    company_name    varchar(200) NOT NULL,
    title           varchar(200) NOT NULL,
    employment_type varchar(20)
                    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship',
                                               'freelance', 'temporary', 'volunteer')),
    location        varchar(150),
    start_date      date        NOT NULL,
    end_date        date,
    is_current      boolean     NOT NULL DEFAULT false,
    description     text,
    achievements    text[]      NOT NULL DEFAULT '{}',
    source          varchar(15) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cv_parsed')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX ix_experiences_candidate ON experiences (candidate_id) WHERE deleted_at IS NULL;

CREATE TABLE skill_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(50)  NOT NULL UNIQUE,
    name        varchar(100) NOT NULL,
    description text,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE skills (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        citext       NOT NULL UNIQUE,
    slug        varchar(120) NOT NULL UNIQUE,
    category_id uuid REFERENCES skill_categories (id) ON DELETE SET NULL,
    skill_type  varchar(25)  NOT NULL
                CHECK (skill_type IN ('technical', 'programming_language', 'framework', 'tool',
                                      'platform', 'methodology', 'soft')),
    description text,
    embedding   real[],
    is_active   boolean      NOT NULL DEFAULT true,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_skills_category ON skills (category_id);
CREATE INDEX ix_skills_name_trgm ON skills USING gin ((name::text) gin_trgm_ops);

CREATE TABLE skill_aliases (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id   uuid   NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    alias      citext NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_skill_aliases_skill ON skill_aliases (skill_id);

CREATE TABLE candidate_skills (
    candidate_id     uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    skill_id         uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
    proficiency      smallint    NOT NULL DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
    years_experience numeric(4, 1) CHECK (years_experience >= 0),
    last_used_year   smallint CHECK (last_used_year BETWEEN 1970 AND 2100),
    source           varchar(15) NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual', 'cv_parsed', 'assessment', 'inferred')),
    is_verified      boolean     NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (candidate_id, skill_id)
);
CREATE INDEX ix_candidate_skills_skill ON candidate_skills (skill_id);

CREATE TABLE skill_evidence (
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
CREATE INDEX ix_skill_evidence_candidate ON skill_evidence (candidate_id, skill_id)
    WHERE deleted_at IS NULL;

CREATE TABLE certifications (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id   uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    name           varchar(200) NOT NULL,
    issuer         varchar(200),
    issued_at      date,
    expires_at     date,
    credential_id  varchar(150),
    credential_url varchar(500),
    source         varchar(15) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'cv_parsed')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz,
    CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at)
);
CREATE INDEX ix_certifications_candidate ON certifications (candidate_id) WHERE deleted_at IS NULL;

-- Idiomas del candidato (tabla "languages" del documento)
CREATE TABLE candidate_languages (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id     uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    language_code    varchar(10) NOT NULL,
    level            varchar(6)  NOT NULL
                     CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native')),
    is_certified     boolean     NOT NULL DEFAULT false,
    certificate_name varchar(150),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (candidate_id, language_code)
);

CREATE TABLE projects (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id  uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    title         varchar(200) NOT NULL,
    description   text,
    role          varchar(150),
    repo_url      varchar(500),
    demo_url      varchar(500),
    docs_url      varchar(500),
    started_at    date,
    ended_at      date,
    is_featured   boolean     NOT NULL DEFAULT false,
    display_order integer     NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz,
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX ix_projects_candidate ON projects (candidate_id) WHERE deleted_at IS NULL;

CREATE TABLE project_skills (
    project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    skill_id   uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
    PRIMARY KEY (project_id, skill_id)
);
CREATE INDEX ix_project_skills_skill ON project_skills (skill_id);

CREATE TABLE project_media (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    storage_key   varchar(300) NOT NULL,
    media_type    varchar(10)  NOT NULL CHECK (media_type IN ('image', 'document')),
    caption       varchar(300),
    display_order integer      NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_project_media_project ON project_media (project_id);

CREATE TABLE portfolios (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id uuid NOT NULL UNIQUE REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    slug         citext      NOT NULL UNIQUE,
    title        varchar(200),
    visibility   varchar(10) NOT NULL DEFAULT 'private'
                 CHECK (visibility IN ('private', 'link', 'public')),
    theme        varchar(50) NOT NULL DEFAULT 'aura-dark',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_links (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id  uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    link_type     varchar(15)  NOT NULL
                  CHECK (link_type IN ('github', 'linkedin', 'website', 'gitlab', 'behance', 'other')),
    url           varchar(500) NOT NULL,
    label         varchar(100),
    display_order integer      NOT NULL DEFAULT 0,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_profile_links_candidate ON profile_links (candidate_id);

-- =============================================================================
-- CV
-- =============================================================================
CREATE TABLE resumes (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id       uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    name               varchar(150) NOT NULL,
    target             varchar(15)  NOT NULL DEFAULT 'general'
                       CHECK (target IN ('general', 'frontend', 'backend', 'data', 'internship',
                                         'software', 'custom')),
    template           varchar(50)  NOT NULL DEFAULT 'aura-classic',
    is_default         boolean      NOT NULL DEFAULT false,
    current_version_id uuid,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    deleted_at         timestamptz
);
CREATE INDEX ix_resumes_candidate ON resumes (candidate_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_resumes_default ON resumes (candidate_id)
    WHERE is_default AND deleted_at IS NULL;

CREATE TABLE resume_versions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id  uuid    NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
    version_no integer NOT NULL CHECK (version_no > 0),
    snapshot   jsonb   NOT NULL DEFAULT '{}'::jsonb,
    template   varchar(50),
    note       varchar(300),
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (resume_id, version_no)
);

ALTER TABLE resumes
    ADD CONSTRAINT fk_resumes_current_version
    FOREIGN KEY (current_version_id) REFERENCES resume_versions (id) ON DELETE SET NULL;

CREATE TABLE resume_sections (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_version_id uuid NOT NULL REFERENCES resume_versions (id) ON DELETE CASCADE,
    section_type      varchar(20) NOT NULL
                      CHECK (section_type IN ('header', 'summary', 'education', 'experience',
                                              'projects', 'skills', 'certifications', 'languages',
                                              'portfolio', 'links', 'custom')),
    title             varchar(150),
    display_order     integer     NOT NULL,
    is_visible        boolean     NOT NULL DEFAULT true,
    content           jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_resume_sections_order UNIQUE (resume_version_id, display_order)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE cv_documents (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id      uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    original_filename varchar(255) NOT NULL,
    storage_key       varchar(300) NOT NULL,
    mime_type         varchar(100) NOT NULL
                      CHECK (mime_type IN ('application/pdf',
                             'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
    size_bytes        integer      NOT NULL CHECK (size_bytes > 0),
    sha256            char(64)     NOT NULL,
    parse_status      varchar(12)  NOT NULL DEFAULT 'pending'
                      CHECK (parse_status IN ('pending', 'processing', 'done', 'failed')),
    parse_error       text,
    parsed_data       jsonb,
    confirmed_at      timestamptz,
    created_at        timestamptz  NOT NULL DEFAULT now(),
    updated_at        timestamptz  NOT NULL DEFAULT now(),
    deleted_at        timestamptz
);
CREATE INDEX ix_cv_documents_candidate ON cv_documents (candidate_id) WHERE deleted_at IS NULL;

-- =============================================================================
-- VACANTES
-- =============================================================================
CREATE TABLE job_postings (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           uuid NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    created_by           uuid REFERENCES users (id) ON DELETE SET NULL,
    title                varchar(200) NOT NULL,
    description          text         NOT NULL,
    location             varchar(150),
    modality             varchar(10)  NOT NULL CHECK (modality IN ('remote', 'hybrid', 'onsite')),
    employment_type      varchar(20)  NOT NULL DEFAULT 'full_time'
                         CHECK (employment_type IN ('full_time', 'part_time', 'contract',
                                                    'internship', 'temporary')),
    salary_min           numeric(12, 2) CHECK (salary_min >= 0),
    salary_max           numeric(12, 2) CHECK (salary_max >= 0),
    salary_currency      char(3),
    show_salary          boolean      NOT NULL DEFAULT false,
    experience_min_years numeric(4, 1) NOT NULL DEFAULT 0 CHECK (experience_min_years >= 0),
    education_level      varchar(20)
                         CHECK (education_level IN ('none', 'secondary', 'technical', 'bachelor',
                                                    'master', 'doctorate')),
    responsibilities     text[]       NOT NULL DEFAULT '{}',
    benefits             text[]       NOT NULL DEFAULT '{}',
    schedule_description varchar(300),
    response_sla_days    smallint CONSTRAINT ck_job_response_sla_days
                         CHECK (response_sla_days BETWEEN 1 AND 30),
    process_estimate_days smallint CONSTRAINT ck_job_process_estimate_days
                         CHECK (process_estimate_days BETWEEN 1 AND 180),
    last_confirmed_at    timestamptz,
    last_confirmed_by    uuid REFERENCES users (id) ON DELETE SET NULL,
    status               varchar(10)  NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED')),
    published_at         timestamptz,
    closes_at            timestamptz,
    embedding            real[],
    embedding_model      varchar(100),
    created_at           timestamptz  NOT NULL DEFAULT now(),
    updated_at           timestamptz  NOT NULL DEFAULT now(),
    deleted_at           timestamptz,
    CHECK (salary_max IS NULL OR salary_min IS NULL OR salary_max >= salary_min)
);
CREATE INDEX ix_job_postings_company_status ON job_postings (company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_job_postings_published ON job_postings (published_at DESC)
    WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX ix_job_postings_title_trgm ON job_postings USING gin (title gin_trgm_ops);

CREATE TABLE job_skills (
    job_id          uuid NOT NULL REFERENCES job_postings (id) ON DELETE CASCADE,
    skill_id        uuid NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
    importance      varchar(10)   NOT NULL DEFAULT 'required'
                    CHECK (importance IN ('required', 'preferred')),
    min_proficiency smallint      NOT NULL DEFAULT 3 CHECK (min_proficiency BETWEEN 1 AND 5),
    weight          numeric(4, 2) NOT NULL DEFAULT 1 CHECK (weight > 0),
    PRIMARY KEY (job_id, skill_id)
);
CREATE INDEX ix_job_skills_skill ON job_skills (skill_id);

CREATE TABLE job_languages (
    job_id        uuid NOT NULL REFERENCES job_postings (id) ON DELETE CASCADE,
    language_code varchar(10) NOT NULL,
    min_level     varchar(6)  NOT NULL
                  CHECK (min_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native')),
    is_required   boolean     NOT NULL DEFAULT true,
    PRIMARY KEY (job_id, language_code)
);

CREATE TABLE job_requirements (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id           uuid NOT NULL REFERENCES job_postings (id) ON DELETE CASCADE,
    requirement_type varchar(15) NOT NULL
                     CHECK (requirement_type IN ('certification', 'education', 'experience', 'other')),
    description      text        NOT NULL,
    is_required      boolean     NOT NULL DEFAULT true,
    display_order    integer     NOT NULL DEFAULT 0
);
CREATE INDEX ix_job_requirements_job ON job_requirements (job_id);

-- =============================================================================
-- POSTULACIONES Y PIPELINE
-- =============================================================================
CREATE TABLE application_stages (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code          varchar(20)  NOT NULL UNIQUE,
    name          varchar(100) NOT NULL,
    display_order smallint     NOT NULL UNIQUE,
    is_terminal   boolean      NOT NULL DEFAULT false
);

CREATE TABLE applications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id            uuid NOT NULL REFERENCES job_postings (id) ON DELETE RESTRICT,
    candidate_id      uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE RESTRICT,
    company_id        uuid NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    resume_version_id uuid REFERENCES resume_versions (id) ON DELETE SET NULL,
    cover_letter      text,
    current_stage     varchar(20) NOT NULL DEFAULT 'APPLIED'
                      REFERENCES application_stages (code) ON UPDATE CASCADE,
    status            varchar(10) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'withdrawn', 'hired', 'closed')),
    applied_at        timestamptz NOT NULL DEFAULT now(),
    withdrawn_at      timestamptz,
    closed_at         timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, candidate_id)
);
CREATE INDEX ix_applications_job_stage ON applications (job_id, current_stage);
CREATE INDEX ix_applications_candidate ON applications (candidate_id);
CREATE INDEX ix_applications_company_status ON applications (company_id, status);

-- company_id se deriva siempre de la vacante (aislamiento multiempresa)
CREATE OR REPLACE FUNCTION applications_sync_company() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    SELECT company_id INTO NEW.company_id FROM job_postings WHERE id = NEW.job_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_applications_sync_company
    BEFORE INSERT OR UPDATE OF job_id, company_id ON applications
    FOR EACH ROW EXECUTE FUNCTION applications_sync_company();

-- actor_type no admite 'ai': los cambios de etapa siempre son humanos o del sistema
CREATE TABLE application_history (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    from_stage     varchar(20) REFERENCES application_stages (code) ON UPDATE CASCADE,
    to_stage       varchar(20) NOT NULL REFERENCES application_stages (code) ON UPDATE CASCADE,
    actor_user_id  uuid REFERENCES users (id) ON DELETE SET NULL,
    actor_type     varchar(10) NOT NULL CHECK (actor_type IN ('human', 'system')),
    comment        text,
    reason_code    varchar(50),
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_application_history_app ON application_history (application_id, created_at);

CREATE TABLE application_notes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    author_id      uuid REFERENCES users (id) ON DELETE SET NULL,
    body           text        NOT NULL,
    visibility     varchar(10) NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'private')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);
CREATE INDEX ix_application_notes_app ON application_notes (application_id) WHERE deleted_at IS NULL;

CREATE TABLE interviews (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id   uuid NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    scheduled_at     timestamptz NOT NULL,
    duration_minutes smallint    NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    mode             varchar(10) NOT NULL CHECK (mode IN ('onsite', 'video', 'phone')),
    location_or_link varchar(500),
    interviewer_ids  uuid[]      NOT NULL DEFAULT '{}',
    status           varchar(12) NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    feedback         jsonb,
    created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_interviews_app ON interviews (application_id);

-- =============================================================================
-- EVALUACIONES Y PSICOMETRIA (versionado)
-- =============================================================================
CREATE TABLE assessment_types (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        varchar(30)  NOT NULL UNIQUE,
    name        varchar(100) NOT NULL,
    description text
);

-- AssessmentDefinition. company_id NULL = instrumento global de la plataforma
CREATE TABLE assessments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type_id         uuid NOT NULL REFERENCES assessment_types (id) ON DELETE RESTRICT,
    company_id      uuid REFERENCES companies (id) ON DELETE CASCADE,
    code            citext       NOT NULL UNIQUE,
    title           varchar(200) NOT NULL,
    description     text,
    is_experimental boolean      NOT NULL DEFAULT true,
    license_type    varchar(10)  NOT NULL DEFAULT 'original'
                    CHECK (license_type IN ('original', 'licensed')),
    license_ref     varchar(200),
    is_clinical     boolean      NOT NULL DEFAULT false CHECK (is_clinical = false),
    status          varchar(10)  NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
    created_by      uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CHECK (license_type = 'original' OR license_ref IS NOT NULL)
);
CREATE INDEX ix_assessments_type ON assessments (type_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_assessments_company ON assessments (company_id) WHERE deleted_at IS NULL;

CREATE TABLE assessment_versions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id       uuid    NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
    version_no          integer NOT NULL CHECK (version_no > 0),
    status              varchar(10) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'retired')),
    published_at        timestamptz,
    time_limit_seconds  integer CHECK (time_limit_seconds > 0),
    instructions        text,
    consent_text        text,
    limitations_text    text,
    disclaimer_text     text,
    randomize_questions boolean NOT NULL DEFAULT false,
    checksum            char(64),
    created_by          uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (assessment_id, version_no)
);

CREATE TABLE psychometric_dimensions (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id           uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE CASCADE,
    code                 varchar(50)  NOT NULL,
    name                 varchar(150) NOT NULL,
    description          text,
    construct_definition text,
    display_order        smallint     NOT NULL DEFAULT 0,
    created_at           timestamptz  NOT NULL DEFAULT now(),
    updated_at           timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (version_id, code)
);

CREATE TABLE psychometric_scales (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE CASCADE,
    code       varchar(50)   NOT NULL,
    scale_type varchar(10)   NOT NULL CHECK (scale_type IN ('likert5', 'binary', 'custom')),
    min_value  numeric(6, 2) NOT NULL,
    max_value  numeric(6, 2) NOT NULL,
    labels     jsonb         NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz   NOT NULL DEFAULT now(),
    updated_at timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (version_id, code),
    CHECK (max_value > min_value)
);

CREATE TABLE assessment_questions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id         uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE CASCADE,
    dimension_id       uuid REFERENCES psychometric_dimensions (id) ON DELETE CASCADE,
    scale_id           uuid REFERENCES psychometric_scales (id) ON DELETE RESTRICT,
    skill_id           uuid REFERENCES skills (id) ON DELETE SET NULL,
    question_type      varchar(20) NOT NULL
                       CHECK (question_type IN ('likert', 'multiple_choice', 'true_false', 'scenario',
                                                'reasoning', 'situational', 'code')),
    stem               text          NOT NULL,
    context            jsonb,
    explanation        text,
    reverse_keyed      boolean       NOT NULL DEFAULT false,
    weight             numeric(5, 2) NOT NULL DEFAULT 1 CHECK (weight > 0),
    difficulty         smallint CHECK (difficulty BETWEEN 1 AND 5),
    display_order      integer       NOT NULL DEFAULT 0,
    is_attention_check boolean       NOT NULL DEFAULT false,
    expected_value     numeric(6, 2),
    created_at         timestamptz   NOT NULL DEFAULT now(),
    updated_at         timestamptz   NOT NULL DEFAULT now(),
    CHECK (question_type <> 'likert' OR scale_id IS NOT NULL),
    CHECK (NOT is_attention_check OR expected_value IS NOT NULL)
);
CREATE INDEX ix_assessment_questions_version ON assessment_questions (version_id, display_order);
CREATE INDEX ix_assessment_questions_dimension ON assessment_questions (dimension_id);

CREATE TABLE assessment_options (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id      uuid NOT NULL REFERENCES assessment_questions (id) ON DELETE CASCADE,
    label            text          NOT NULL,
    value            numeric(6, 2),
    is_correct       boolean,
    rubric_score     numeric(6, 2),
    rubric_rationale text,
    display_order    integer       NOT NULL DEFAULT 0,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_assessment_options_question ON assessment_options (question_id, display_order);

-- dimension_id NULL = regla a nivel de instrumento completo
CREATE TABLE scoring_rules (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id   uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE CASCADE,
    dimension_id uuid REFERENCES psychometric_dimensions (id) ON DELETE CASCADE,
    method       varchar(15) NOT NULL
                 CHECK (method IN ('sum', 'mean', 'weighted_mean', 'correct_count', 'rubric')),
    params       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_scoring_rules UNIQUE NULLS NOT DISTINCT (version_id, dimension_id)
);

CREATE TABLE interpretation_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id      uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE CASCADE,
    dimension_id    uuid REFERENCES psychometric_dimensions (id) ON DELETE CASCADE,
    min_score       numeric(6, 2) NOT NULL,
    max_score       numeric(6, 2) NOT NULL,
    band            varchar(10)   NOT NULL CHECK (band IN ('low', 'moderate', 'high')),
    text_template   text          NOT NULL,
    recommendations jsonb         NOT NULL DEFAULT '[]'::jsonb,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    CHECK (max_score >= min_score)
);
CREATE INDEX ix_interpretation_rules_version ON interpretation_rules (version_id, dimension_id);

CREATE TABLE assessment_assignments (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id     uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE RESTRICT,
    candidate_id   uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    application_id uuid REFERENCES applications (id) ON DELETE CASCADE,
    assigned_by    uuid REFERENCES users (id) ON DELETE SET NULL,
    due_at         timestamptz,
    status         varchar(10) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'started', 'completed', 'expired', 'cancelled')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_assessment_assignments_candidate ON assessment_assignments (candidate_id, status);
CREATE INDEX ix_assessment_assignments_application ON assessment_assignments (application_id);

CREATE TABLE assessment_attempts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id         uuid NOT NULL REFERENCES assessment_versions (id) ON DELETE RESTRICT,
    candidate_id       uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    assignment_id      uuid REFERENCES assessment_assignments (id) ON DELETE SET NULL,
    consent_id         uuid REFERENCES consents (id) ON DELETE RESTRICT,
    status             varchar(12) NOT NULL DEFAULT 'in_progress'
                       CHECK (status IN ('in_progress', 'submitted', 'scored', 'invalidated')),
    random_seed        integer,
    started_at         timestamptz NOT NULL DEFAULT now(),
    submitted_at       timestamptz,
    duration_seconds   integer CHECK (duration_seconds >= 0),
    quality_flags      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    share_with_company boolean     NOT NULL DEFAULT false,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_assessment_attempts_candidate ON assessment_attempts (candidate_id, created_at DESC);
CREATE INDEX ix_assessment_attempts_version ON assessment_attempts (version_id);

CREATE TABLE assessment_answers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id    uuid NOT NULL REFERENCES assessment_attempts (id) ON DELETE CASCADE,
    question_id   uuid NOT NULL REFERENCES assessment_questions (id) ON DELETE RESTRICT,
    option_id     uuid REFERENCES assessment_options (id) ON DELETE RESTRICT,
    numeric_value numeric(6, 2),
    text_value    text,
    time_ms       integer CHECK (time_ms >= 0),
    answered_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (attempt_id, question_id)
);

CREATE TABLE assessment_results (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      uuid NOT NULL UNIQUE REFERENCES assessment_attempts (id) ON DELETE CASCADE,
    overall_score   numeric(5, 2) CHECK (overall_score BETWEEN 0 AND 100),
    summary         text,
    limitations     text,
    disclaimer      text          NOT NULL,
    scoring_version varchar(30)   NOT NULL,
    computed_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE result_dimension_scores (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id        uuid NOT NULL REFERENCES assessment_results (id) ON DELETE CASCADE,
    dimension_id     uuid NOT NULL REFERENCES psychometric_dimensions (id) ON DELETE RESTRICT,
    raw_score        numeric(8, 3) NOT NULL,
    normalized_score numeric(5, 2) NOT NULL CHECK (normalized_score BETWEEN 0 AND 100),
    band             varchar(10)   NOT NULL CHECK (band IN ('low', 'moderate', 'high')),
    interpretation   text          NOT NULL,
    evidence         jsonb         NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (result_id, dimension_id)
);

-- Una version publicada es inmutable: se protege su contenido
CREATE OR REPLACE FUNCTION guard_assessment_version_content() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_rows    jsonb[];
    v_row     jsonb;
    v_version uuid;
    v_status  varchar;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_rows := ARRAY[to_jsonb(NEW)];
    ELSIF TG_OP = 'UPDATE' THEN
        v_rows := ARRAY[to_jsonb(OLD), to_jsonb(NEW)];
    ELSE
        v_rows := ARRAY[to_jsonb(OLD)];
    END IF;

    FOREACH v_row IN ARRAY v_rows LOOP
        IF TG_TABLE_NAME = 'assessment_options' THEN
            SELECT q.version_id INTO v_version
              FROM assessment_questions q WHERE q.id = (v_row ->> 'question_id')::uuid;
        ELSE
            v_version := (v_row ->> 'version_id')::uuid;
        END IF;

        SELECT status INTO v_status FROM assessment_versions WHERE id = v_version;
        IF v_status IS NOT NULL AND v_status <> 'draft' THEN
            RAISE EXCEPTION 'La version % del instrumento esta %; su contenido no puede modificarse. Cree una nueva version.',
                v_version, v_status;
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['psychometric_dimensions', 'psychometric_scales', 'assessment_questions',
                             'assessment_options', 'scoring_rules', 'interpretation_rules'] LOOP
        EXECUTE format('CREATE TRIGGER trg_%s_version_guard BEFORE INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION guard_assessment_version_content()', t, t);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION guard_assessment_version_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'draft' THEN
            RAISE EXCEPTION 'Solo se pueden eliminar versiones en borrador; retire la version %.', OLD.id;
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
        RAISE EXCEPTION 'Una version publicada o retirada no puede volver a borrador.';
    END IF;
    IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
        RAISE EXCEPTION 'Una version retirada no puede reactivarse.';
    END IF;
    IF NEW.status = 'published' AND OLD.status = 'draft' THEN
        NEW.published_at := COALESCE(NEW.published_at, now());
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_assessment_versions_status_guard
    BEFORE UPDATE OR DELETE ON assessment_versions
    FOR EACH ROW EXECUTE FUNCTION guard_assessment_version_status();

-- =============================================================================
-- MATCH, RECOMENDACIONES, CARRERA
-- =============================================================================
CREATE TABLE match_results (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id  uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    job_id        uuid NOT NULL REFERENCES job_postings (id) ON DELETE CASCADE,
    score         numeric(5, 2) NOT NULL,
    score_low     numeric(5, 2) NOT NULL,
    score_high    numeric(5, 2) NOT NULL,
    model_version varchar(50)   NOT NULL,
    breakdown     jsonb         NOT NULL DEFAULT '{}'::jsonb,
    strengths     jsonb         NOT NULL DEFAULT '[]'::jsonb,
    gaps          jsonb         NOT NULL DEFAULT '[]'::jsonb,
    explanation   jsonb         NOT NULL DEFAULT '{}'::jsonb,
    computed_at   timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (candidate_id, job_id, model_version),
    CHECK (0 <= score_low AND score_low <= score AND score <= score_high AND score_high <= 100)
);
CREATE INDEX ix_match_results_job_score ON match_results (job_id, score DESC);

CREATE TABLE learning_resources (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title          varchar(250) NOT NULL,
    provider       varchar(150),
    url            varchar(500) NOT NULL,
    description    text,
    level          varchar(15) CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    duration_hours numeric(6, 1) CHECK (duration_hours > 0),
    cost_type      varchar(10) CHECK (cost_type IN ('free', 'paid', 'freemium')),
    language_code  varchar(10) NOT NULL DEFAULT 'es',
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_resource_skills (
    resource_id uuid NOT NULL REFERENCES learning_resources (id) ON DELETE CASCADE,
    skill_id    uuid NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    PRIMARY KEY (resource_id, skill_id)
);
CREATE INDEX ix_learning_resource_skills_skill ON learning_resource_skills (skill_id);

CREATE TABLE recommendations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rec_type      varchar(15) NOT NULL
                  CHECK (rec_type IN ('job', 'skill', 'course', 'project', 'career_path', 'opportunity')),
    target_id     uuid,
    target_label  varchar(250),
    score         numeric(6, 4) NOT NULL,
    reason        jsonb         NOT NULL DEFAULT '{}'::jsonb,
    strategy      varchar(10)   NOT NULL
                  CHECK (strategy IN ('rule', 'content', 'embedding', 'hybrid')),
    model_version varchar(50),
    status        varchar(10)   NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'dismissed', 'acted', 'expired')),
    expires_at    timestamptz,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    updated_at    timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_recommendations_user_active ON recommendations (user_id, rec_type, score DESC)
    WHERE status = 'active';

CREATE TABLE recommendation_feedback (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id uuid NOT NULL REFERENCES recommendations (id) ON DELETE CASCADE,
    user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    action            varchar(10) NOT NULL
                      CHECK (action IN ('view', 'click', 'save', 'dismiss', 'apply')),
    created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recommendation_feedback_rec ON recommendation_feedback (recommendation_id);

CREATE TABLE career_paths (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id uuid NOT NULL REFERENCES candidate_profiles (id) ON DELETE CASCADE,
    title        varchar(200) NOT NULL,
    goal_role    varchar(200),
    generated_by varchar(5)   NOT NULL DEFAULT 'user' CHECK (generated_by IN ('user', 'aura')),
    status       varchar(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    deleted_at   timestamptz
);
CREATE INDEX ix_career_paths_candidate ON career_paths (candidate_id) WHERE deleted_at IS NULL;

CREATE TABLE career_nodes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id    uuid NOT NULL REFERENCES career_paths (id) ON DELETE CASCADE,
    node_type  varchar(10)  NOT NULL
               CHECK (node_type IN ('profile', 'skill', 'role', 'course', 'project', 'milestone')),
    ref_id     uuid,
    label      varchar(200) NOT NULL,
    status     varchar(12)  NOT NULL DEFAULT 'target'
               CHECK (status IN ('acquired', 'in_progress', 'gap', 'target')),
    pos_x      real         NOT NULL DEFAULT 0,
    pos_y      real         NOT NULL DEFAULT 0,
    pos_z      real         NOT NULL DEFAULT 0,
    meta       jsonb        NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_career_nodes_path ON career_nodes (path_id);

CREATE TABLE career_edges (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id        uuid NOT NULL REFERENCES career_paths (id) ON DELETE CASCADE,
    source_node_id uuid NOT NULL REFERENCES career_nodes (id) ON DELETE CASCADE,
    target_node_id uuid NOT NULL REFERENCES career_nodes (id) ON DELETE CASCADE,
    edge_type      varchar(10)   NOT NULL DEFAULT 'leads_to'
                   CHECK (edge_type IN ('requires', 'leads_to', 'related')),
    weight         numeric(4, 2) NOT NULL DEFAULT 1,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (source_node_id, target_node_id, edge_type),
    CHECK (source_node_id <> target_node_id)
);
CREATE INDEX ix_career_edges_path ON career_edges (path_id);

-- =============================================================================
-- AURA (IA), REPORTES, NOTIFICACIONES
-- =============================================================================
CREATE TABLE ai_commands (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  varchar(60)  NOT NULL UNIQUE,
    intent                varchar(60)  NOT NULL,
    description           text         NOT NULL,
    required_permission   varchar(100) NOT NULL REFERENCES permissions (code) ON UPDATE CASCADE,
    risk_level            varchar(6)   NOT NULL DEFAULT 'low'
                          CHECK (risk_level IN ('low', 'medium', 'high')),
    requires_confirmation boolean      NOT NULL DEFAULT false,
    allowed_roles         text[]       NOT NULL DEFAULT '{}',
    examples              text[]       NOT NULL DEFAULT '{}',
    is_enabled            boolean      NOT NULL DEFAULT true,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    CHECK (risk_level = 'low' OR requires_confirmation)
);

CREATE TABLE ai_interactions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid REFERENCES users (id) ON DELETE SET NULL,
    session_id       uuid,
    channel          varchar(10) NOT NULL CHECK (channel IN ('text', 'voice', 'gesture')),
    input_text       text,
    detected_intent  varchar(60),
    confidence       numeric(5, 4) CHECK (confidence BETWEEN 0 AND 1),
    entities         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    command_id       uuid REFERENCES ai_commands (id) ON DELETE SET NULL,
    tool_calls       jsonb       NOT NULL DEFAULT '[]'::jsonb,
    response_summary text,
    outcome          varchar(20) NOT NULL
                     CHECK (outcome IN ('ok', 'denied', 'error', 'needs_confirmation', 'cancelled')),
    latency_ms       integer CHECK (latency_ms >= 0),
    llm_used         boolean     NOT NULL DEFAULT false,
    llm_provider     varchar(50),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_interactions_user ON ai_interactions (user_id, created_at DESC);
CREATE INDEX ix_ai_interactions_session ON ai_interactions (session_id);

-- Acciones de riesgo medio/alto pendientes de confirmacion humana (token de un solo uso)
CREATE TABLE ai_pending_actions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    interaction_id uuid REFERENCES ai_interactions (id) ON DELETE SET NULL,
    command_id     uuid NOT NULL REFERENCES ai_commands (id) ON DELETE CASCADE,
    arguments      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    summary        text        NOT NULL,
    token_hash     char(64)    NOT NULL UNIQUE,
    expires_at     timestamptz NOT NULL,
    confirmed_at   timestamptz,
    cancelled_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_pending_actions_user ON ai_pending_actions (user_id, created_at DESC);

CREATE TABLE reports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    company_id    uuid REFERENCES companies (id) ON DELETE CASCADE,
    report_type   varchar(15) NOT NULL
                  CHECK (report_type IN ('candidate', 'talent', 'assessment', 'vacancy',
                                         'recruitment', 'career')),
    subject_id    uuid,
    format        varchar(4)  NOT NULL CHECK (format IN ('pdf', 'xlsx')),
    status        varchar(12) NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
    storage_key   varchar(300),
    params        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    error         text,
    generated_at  timestamptz,
    expires_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_reports_owner ON reports (owner_user_id, created_at DESC);
CREATE INDEX ix_reports_company ON reports (company_id, created_at DESC);

CREATE TABLE notifications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    notification_type varchar(40)  NOT NULL,
    title             varchar(200) NOT NULL,
    body              text,
    link              varchar(300),
    data              jsonb        NOT NULL DEFAULT '{}'::jsonb,
    read_at           timestamptz,
    created_at        timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user_unread ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX ix_notifications_user ON notifications (user_id, created_at DESC);

-- =============================================================================
-- VISION (biometria: solo embeddings cifrados, nunca imagenes; borrado fisico)
-- =============================================================================
CREATE TABLE facial_identity_records (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    embedding_encrypted bytea         NOT NULL,
    encryption_key_id   varchar(50)   NOT NULL,
    model_name          varchar(50)   NOT NULL,
    model_version       varchar(30)   NOT NULL,
    quality_score       numeric(5, 4) CHECK (quality_score BETWEEN 0 AND 1),
    consent_id          uuid NOT NULL REFERENCES consents (id) ON DELETE RESTRICT,
    enrolled_at         timestamptz   NOT NULL DEFAULT now(),
    expires_at          timestamptz   NOT NULL,
    revoked_at          timestamptz,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE facial_verification_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose         varchar(12) NOT NULL CHECK (purpose IN ('login', 'assessment')),
    similarity      numeric(6, 5),
    passed          boolean     NOT NULL,
    liveness_passed boolean,
    attempt_id      uuid REFERENCES assessment_attempts (id) ON DELETE SET NULL,
    ip              inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_facial_verification_events_user ON facial_verification_events (user_id, created_at DESC);

-- =============================================================================
-- ML Y TRABAJOS EN SEGUNDO PLANO
-- =============================================================================
CREATE TABLE ml_models (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          varchar(100) NOT NULL,
    version       varchar(30)  NOT NULL,
    task          varchar(50)  NOT NULL,
    metrics       jsonb        NOT NULL DEFAULT '{}'::jsonb,
    features      jsonb        NOT NULL DEFAULT '[]'::jsonb,
    artifact_key  varchar(300),
    status        varchar(10)  NOT NULL DEFAULT 'staging'
                  CHECK (status IN ('staging', 'prod', 'retired')),
    trained_at    timestamptz,
    data_snapshot varchar(200),
    notes         text,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);
CREATE UNIQUE INDEX uq_ml_models_prod ON ml_models (name) WHERE status = 'prod';

-- Cola de trabajos sobre PostgreSQL (SELECT ... FOR UPDATE SKIP LOCKED); sustituye a Redis
CREATE TABLE background_jobs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type     varchar(60) NOT NULL,
    payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status       varchar(10) NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
    attempts     smallint    NOT NULL DEFAULT 0,
    max_attempts smallint    NOT NULL DEFAULT 3,
    run_after    timestamptz NOT NULL DEFAULT now(),
    locked_at    timestamptz,
    locked_by    varchar(100),
    last_error   text,
    result       jsonb,
    created_by   uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_background_jobs_pending ON background_jobs (run_after) WHERE status = 'queued';

-- -----------------------------------------------------------------------------
-- Trigger updated_at en todas las tablas que tienen la columna
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables tb
            ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
         WHERE c.table_schema = 'public'
           AND c.column_name = 'updated_at'
           AND tb.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t.table_name, t.table_name);
    END LOOP;
END;
$$;

COMMIT;

RESET ROLE;
