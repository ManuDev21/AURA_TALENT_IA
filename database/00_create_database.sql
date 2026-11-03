-- =============================================================================
-- AURA TALENT AI - 00: Rol de aplicacion y base de datos
-- Ejecutar conectado como superusuario (postgres) desde psql:
--
--   psql -U postgres -v app_password=TU_CLAVE_SEGURA -f 00_create_database.sql
--
-- La clave se pasa como variable para no dejarla escrita en el archivo.
-- =============================================================================
\set ON_ERROR_STOP on

\if :{?app_password}
\else
  \echo 'ERROR: falta la variable app_password.'
  \echo 'Uso: psql -U postgres -v app_password=TU_CLAVE -f 00_create_database.sql'
  \quit
\endif

CREATE ROLE aura_app WITH LOGIN PASSWORD :'app_password';

CREATE DATABASE aura_talent
    WITH OWNER = aura_app
         ENCODING = 'UTF8'
         TEMPLATE = template0;

REVOKE ALL ON DATABASE aura_talent FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE aura_talent TO aura_app;
