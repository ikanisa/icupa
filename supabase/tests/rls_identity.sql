begin;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

-- Diner should only see their own profile row
DO $$
DECLARE
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.profiles;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'Diner should see exactly one profile, saw %', visible_count;
  END IF;
END $$;

-- Diner can update their own display name
DO $$
DECLARE
  updated_name text;
BEGIN
  UPDATE public.profiles
  SET display_name = 'Demo Diner Updated'
  WHERE user_id = '00000000-0000-4000-9000-0000000000aa'
  RETURNING display_name INTO updated_name;

  IF updated_name <> 'Demo Diner Updated' THEN
    RAISE EXCEPTION 'Expected profile update to succeed for diner';
  END IF;
END $$;

-- Attempting to touch another profile must fail
DO $$
DECLARE
  sql_state text;
BEGIN
  BEGIN
    UPDATE public.profiles
    SET display_name = 'Not allowed'
    WHERE user_id = '00000000-0000-4000-9000-0000000000bb';
    RAISE EXCEPTION 'Expected RLS failure when updating foreign profile';
  EXCEPTION
    WHEN others THEN
      GET STACKED DIAGNOSTICS sql_state = returned_sqlstate;
      IF sql_state <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

-- Diner without user_roles should see zero tenant assignments
DO $$
DECLARE
  role_count integer;
BEGIN
  SELECT count(*) INTO role_count FROM public.user_roles;
  IF role_count <> 0 THEN
    RAISE EXCEPTION 'Diner should not see tenant role rows, saw %', role_count;
  END IF;
END $$;

-- Switch to staff context (manager)
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';

DO $$
DECLARE
  role_count integer;
BEGIN
  SELECT count(*) INTO role_count FROM public.user_roles;
  IF role_count <> 2 THEN
    RAISE EXCEPTION 'Manager should see both tenant assignments, saw %', role_count;
  END IF;
END $$;

-- Staff cannot insert new roles without service role privileges
DO $$
DECLARE
  sql_state text;
BEGIN
  BEGIN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES ('00000000-0000-4000-9000-0000000000aa', '00000000-0000-4000-8000-000000000001', 'cashier');
    RAISE EXCEPTION 'Expected insert into user_roles to be blocked for staff';
  EXCEPTION
    WHEN others THEN
      GET STACKED DIAGNOSTICS sql_state = returned_sqlstate;
      IF sql_state <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

rollback;
