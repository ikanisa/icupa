-- Phase 1 introduces core enums, extensions, and catalog tables that underpin the application.
-- Rolling it back safely would drop data critical to all subsequent migrations, so we mark it irreversible.
DO $$
BEGIN
  RAISE EXCEPTION 'Irreversible migration: 20240215000000_phase1_schema installs base schema';
END;
$$;
