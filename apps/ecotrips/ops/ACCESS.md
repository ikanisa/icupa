# Ops Access Checklist

1. **Create/Update Profile**
   ```sql
   insert into core.profiles (auth_user_id, persona)
   values ('<user_uuid>', 'ops')
   on conflict (auth_user_id) do update set persona = 'ops';
   ```

2. **Verify Sign-In**
   - Log in as the operator user (Supabase Auth).
   - Ensure a valid session/JWT is issued; RLS policies rely on `auth.uid()`.

3. **Smoke Test via cURL**
   ```sh
   curl -s "https://woyknezboamabahknmjr.supabase.co/rest/v1/ops.v_bookings?select=id,status" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer <operator_jwt>"
   ```
   - Expect HTTP 200 with booking rows when persona is `ops`.
   - Non-ops personas receive 403/401 with RLS message.

4. **Revoke Access**
   ```sql
   update core.profiles set persona = 'consumer' where auth_user_id = '<user_uuid>';
   ```
   - User immediately loses Ops view permissions.
