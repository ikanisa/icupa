DO $$
BEGIN
  RAISE EXCEPTION 'Irreversible migration: 20251015000000_user_profile_automation modifies auth bootstrap flows';
END;
$$;
