-- =============================================================================
-- AURA TALENT AI - Instalacion completa con psql (desde la carpeta database/):
--
--   psql -U postgres -v app_password=TU_CLAVE_SEGURA -f install.sql
--
-- Crea el rol aura_app, la base aura_talent, el esquema y los datos semilla.
-- =============================================================================
\set ON_ERROR_STOP on

\ir 00_create_database.sql
\c aura_talent
\ir 01_schema.sql
\ir 02_seed.sql
\ir 03_learning_resources.sql
\ir 04_trust_and_portability.sql

\echo 'AURA TALENT AI: base de datos aura_talent instalada correctamente.'
