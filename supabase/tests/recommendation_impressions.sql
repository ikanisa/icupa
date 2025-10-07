begin;

set local role service_role;
update public.recommendation_impressions
   set accepted = false
 where id = '00000000-0000-4000-8000-000000000d01';

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000601"}';

select public.accept_recommendation_impression('00000000-0000-4000-8000-000000000d01');

set local role service_role;
DO $$
DECLARE
  status boolean;
BEGIN
  SELECT accepted INTO status
    FROM public.recommendation_impressions
   WHERE id = '00000000-0000-4000-8000-000000000d01';
  IF status IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Accepted flag should be true after diner acknowledgement';
  END IF;
END $$;

set local role authenticated;
set local "request.headers" = '{"x-icupa-session":"00000000-0000-4000-8000-000000000602"}';

DO $$
BEGIN
  BEGIN
    PERFORM public.accept_recommendation_impression('00000000-0000-4000-8000-000000000d01');
    RAISE EXCEPTION 'Foreign table session should not accept impressions';
  EXCEPTION
    WHEN others THEN
      IF SQLSTATE <> '42501' THEN
        RAISE;
      END IF;
  END;
END $$;

rollback;
