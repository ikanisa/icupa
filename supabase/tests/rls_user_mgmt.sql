begin;

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"role":"authenticated"}';

-- diner user should not access merchant profiles
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';

do $$
begin
  begin
    perform * from public.merchant_profiles limit 1;
    raise exception 'Diner should not read merchant_profiles';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- merchant user (manager@example.com) should read own profile but not others
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';

-- select own profile
perform 1 from public.merchant_profiles where user_id = '00000000-0000-4000-9000-0000000000bb';

-- ensure no access to other profiles
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';

do $$
begin
  begin
    perform * from public.merchant_profiles where user_id <> '00000000-0000-4000-9000-0000000000bb';
    raise exception 'Merchant should not read other profiles';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- whatsapp_otps restricted to service role
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';

do $$
begin
  begin
    perform * from public.whatsapp_otps limit 1;
    raise exception 'Authenticated user should not access whatsapp_otps';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- customer preferences accessible to self only
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000aa';

-- ensure user can insert/update own prefs
insert into public.customer_prefs (user_id, language)
values ('00000000-0000-4000-9000-0000000000aa', 'en')
on conflict (user_id) do update set language = excluded.language;

-- other user cannot select
set local "request.jwt.claim.sub" = '00000000-0000-4000-9000-0000000000bb';

do $$
begin
  begin
    perform * from public.customer_prefs where user_id = '00000000-0000-4000-9000-0000000000aa';
    raise exception 'Other users should not access customer prefs';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

rollback;
