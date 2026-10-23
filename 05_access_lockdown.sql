-- =============================================================================
-- FILE: 05_access_lockdown.sql
-- PROJECT: Digital Twin Warehouse Management System
-- DESCRIPTION: Runs last. Hosted PostgreSQL providers such as Supabase publish
--              the public schema through an auto-generated REST API (roles
--              anon / authenticated, usable with a public key). This app only
--              accesses the database from the Express backend, so:
--                1. Row Level Security is enabled on every table with no
--                   policies - roles without BYPASSRLS see no rows.
--                   Views are made security_invoker (PostgreSQL 15+) so they
--                   cannot be used to read around RLS.
--                2. Privileges of the anon / authenticated roles are revoked.
--              The backend connects as the table owner / postgres role, which
--              bypasses RLS, so the application is unaffected. On plain
--              PostgreSQL the role checks below simply skip step 2.
-- =============================================================================

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;

    -- Pin search_path on our functions/procedures so callers cannot hijack
    -- unqualified table names by putting their own schema first
    FOR t IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p') LOOP
        EXECUTE format('ALTER ROUTINE public.%I(%s) SET search_path = public', t.proname, t.args);
    END LOOP;

    -- PostgreSQL 15+: views check RLS as the querying user, not the view owner
    IF current_setting('server_version_num')::INT >= 150000 THEN
        FOR t IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
            EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', t.viewname);
        END LOOP;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon, authenticated';
    END IF;
END;
$$;

-- =============================================================================
-- END OF ACCESS LOCKDOWN SCRIPT
-- =============================================================================
