-- Seed data for ICUPA Phase 1 local development
set search_path = public;

-- Minimal auth users for RLS testing
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-9000-0000000000aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'diner@example.com', '$2a$10$wH1XgPZkT1tGk6xhu1YxCO9ZCvGSqtEtFPi0P5xGX2YeliYg5Ot22', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-9000-0000000000bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@example.com', '$2a$10$wH1XgPZkT1tGk6xhu1YxCO9ZCvGSqtEtFPi0P5xGX2YeliYg5Ot22', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do update set email = excluded.email;

insert into public.tenants (id, name, region, settings)
values
  ('00000000-0000-4000-8000-000000000001', 'ICUPA Demo – Kigali', 'RW', '{"currency":"RWF"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'ICUPA Demo – Valletta', 'EU', '{"currency":"EUR"}'::jsonb)
on conflict (id) do update set name = excluded.name;

insert into public.locations (id, tenant_id, name, currency, timezone, region, vat_rate)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Kigali Flagship', 'RWF', 'Africa/Kigali', 'RW', 18.00),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002', 'Valletta Waterfront', 'EUR', 'Europe/Malta', 'EU', 18.00)
on conflict (id) do update set name = excluded.name;

insert into public.profiles (user_id, display_name, default_locale)
values
  ('00000000-0000-4000-9000-0000000000aa', 'Demo Diner', 'en'),
  ('00000000-0000-4000-9000-0000000000bb', 'Demo Manager', 'en')
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.user_roles (user_id, tenant_id, role)
values
  ('00000000-0000-4000-9000-0000000000bb', '00000000-0000-4000-8000-000000000001', 'manager'),
  ('00000000-0000-4000-9000-0000000000bb', '00000000-0000-4000-8000-000000000002', 'manager')
on conflict (user_id, tenant_id, role) do nothing;

insert into public.menus (id, tenant_id, location_id, name, is_active, version, published_at)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Rwanda Core', true, 1, now()),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'Malta Core', true, 1, now())
on conflict (id) do update set name = excluded.name;

insert into public.categories (id, menu_id, name, sort_order)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'Coffee & Tonics', 1),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000101', 'Bites', 2),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000201', 'Plates', 1),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000201', 'Drinks', 2)
on conflict (id) do update set name = excluded.name;

insert into public.items (id, tenant_id, location_id, menu_id, category_id, name, description, price_cents, currency, allergens, tags, is_alcohol, embedding)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'Nyamirambo Chill Brew', 'Cold brew concentrate with cardamom syrup.', 3200, 'RWF', '{"caffeine"}', '{"drink","cold"}', false, public.unit_embedding(1)),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'Akabanga Glazed Wings', 'Grilled wings glazed with Akabanga chilli oil.', 7800, 'RWF', '{"sesame"}', '{"spicy","shareable"}', false, public.unit_embedding(2)),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000303', 'Ftira Valletta', 'Maltese ftira with capers, olives, and sun-dried tomatoes.', 1450, 'EUR', '{"gluten"}', '{"vegetarian"}', false, public.unit_embedding(1)),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000304', 'Cisk Spritz', 'Light spritz with local lager and citrus bitters.', 850, 'EUR', '{"gluten"}', '{"drink"}', true, public.unit_embedding(3))
on conflict (id) do update set name = excluded.name, embedding = excluded.embedding;

insert into public.modifier_groups (id, item_id, name, min_selections, max_selections, required)
values
  ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-000000000401', 'Chill Brew Add-ons', 0, 2, false)
on conflict (id) do update set name = excluded.name;

insert into public.modifiers (id, group_id, name, price_delta_cents)
values
  ('00000000-0000-4000-8000-000000000f11', '00000000-0000-4000-8000-000000000f01', 'Extra Cardamom Syrup', 500),
  ('00000000-0000-4000-8000-000000000f12', '00000000-0000-4000-8000-000000000f01', 'Oat Milk Splash', 700)
on conflict (id) do update set name = excluded.name;

insert into public.tables (id, location_id, code, seats, qrtoken)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000011', 'T1', 2, 'signed-token-kigali'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000012', 'T1', 2, 'signed-token-valletta')
on conflict (id) do update set code = excluded.code;

insert into public.table_sessions (id, table_id, issued_for_ip, device_fingerprint, expires_at)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000501', '127.0.0.1', 'demo-device', now() + interval '4 hours'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000502', '127.0.0.1', 'demo-device-2', now() + interval '4 hours')
on conflict (id) do update set expires_at = excluded.expires_at;

insert into public.orders (id, tenant_id, location_id, table_id, table_session_id, status, subtotal_cents, tax_cents, service_cents, total_cents, currency)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000601', 'submitted', 11000, 1800, 600, 13400, 'RWF'),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000602', 'settled', 2300, 410, 115, 2825, 'EUR')
on conflict (id) do update set status = excluded.status;

insert into public.order_items (id, order_id, item_id, quantity, unit_price_cents)
values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000401', 2, 3200),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000402', 1, 7800),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000403', 1, 1450)
on conflict (id) do nothing;

insert into public.order_item_mods (id, order_item_id, modifier_id, price_delta_cents)
values
  ('00000000-0000-4000-8000-000000000f21', '00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000f11', 500)
on conflict (id) do nothing;

insert into public.payments (id, order_id, method, provider_ref, status, amount_cents, currency)
values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000701', 'mtn_momo', 'mtn-demo-1', 'authorized', 13400, 'RWF'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000702', 'stripe', 'stripe-demo-1', 'captured', 2825, 'EUR')
on conflict (id) do nothing;

insert into public.receipts (id, order_id, region, fiscal_id, url, payload)
values
  ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000701', 'RW', 'EBM-001', 'https://example.com/receipts/rw/EBM-001', '{"status":"issued"}'::jsonb),
  ('00000000-0000-4000-8000-000000000a02', '00000000-0000-4000-8000-000000000702', 'EU', 'MT-001', 'https://example.com/receipts/mt/MT-001', '{"status":"issued"}'::jsonb)
on conflict (id) do update set fiscal_id = excluded.fiscal_id;

insert into public.agent_sessions (id, agent_type, tenant_id, location_id, table_session_id, context)
values
  ('00000000-0000-4000-8000-000000000b01', 'waiter', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000601', '{"language":"en"}'::jsonb)
on conflict (id) do update set agent_type = excluded.agent_type;

insert into public.agent_events (id, agent_type, session_id, input, output)
values
  ('00000000-0000-4000-8000-000000000c01', 'waiter', '00000000-0000-4000-8000-000000000b01', '{"prompt":"Hi"}'::jsonb, '{"reply":"Welcome to ICUPA"}'::jsonb)
on conflict (id) do update set output = excluded.output;

insert into public.recommendation_impressions (id, session_id, item_id, rationale, accepted)
values
  ('00000000-0000-4000-8000-000000000d01', '00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000402', 'Pairs with Chill Brew', true)
on conflict (id) do update set accepted = excluded.accepted;

insert into public.events (tenant_id, location_id, table_session_id, type, payload)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000601', 'order.submitted', '{"order_id":"00000000-0000-4000-8000-000000000701"}'::jsonb)
returning id;

insert into public.agent_runtime_configs (tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, metadata, instructions, tool_allowlist, autonomy_level, retrieval_ttl_minutes, experiment_flag, updated_by, sync_pending)
values
  ('00000000-0000-4000-8000-000000000001', 'waiter', true, 0.75, 45, '{"disclaimer":"Always cite menu sources"}'::jsonb, 'Be concise, greet by name when provided, cite menu sources, and never invent allergens.', ARRAY['get_menu','check_allergens','recommend_items','create_order','get_kitchen_load'], 'L1', 5, 'baseline', '00000000-0000-4000-9000-0000000000bb', false),
  ('00000000-0000-4000-8000-000000000001', 'allergen_guardian', true, 0.50, 25, '{"enforcement":"strict"}'::jsonb, 'Block risky items and remind diners to speak with staff for severe allergies.', ARRAY['check_allergens','get_menu'], 'L0', 5, 'baseline', '00000000-0000-4000-9000-0000000000bb', false),
  ('00000000-0000-4000-8000-000000000001', 'upsell_pairing', true, 0.60, 30, '{"epsilon":0.05}'::jsonb, 'Offer one or two contextual pairings with transparent pricing and allergen notes.', ARRAY['recommend_items','get_kitchen_load'], 'L1', 5, 'dessert-pilot', '00000000-0000-4000-9000-0000000000bb', false),
  ('00000000-0000-4000-8000-000000000002', 'waiter', true, 0.85, 55, '{"disclaimer":"Always reference allergen chips"}'::jsonb, 'Use a warm Maltese-English tone, cite menu or policy references, and respect age gates (17+ alcohol).', ARRAY['get_menu','check_allergens','recommend_items','create_order'], 'L1', 5, 'baseline', '00000000-0000-4000-9000-0000000000bb', false),
  ('00000000-0000-4000-8000-000000000002', 'promo_event', true, 0.40, 20, '{"budget_cap_cents":50000}'::jsonb, 'Propose promos within approved budgets and log fairness rationale before activation.', ARRAY['get_menu','recommend_items'], 'L1', 10, 'late-night-dessert', '00000000-0000-4000-9000-0000000000bb', false)
on conflict (tenant_id, agent_type) do update set
  enabled = excluded.enabled,
  session_budget_usd = excluded.session_budget_usd,
  daily_budget_usd = excluded.daily_budget_usd,
  metadata = excluded.metadata,
  instructions = excluded.instructions,
  tool_allowlist = excluded.tool_allowlist,
  autonomy_level = excluded.autonomy_level,
  retrieval_ttl_minutes = excluded.retrieval_ttl_minutes,
  experiment_flag = excluded.experiment_flag,
  updated_by = excluded.updated_by,
  sync_pending = excluded.sync_pending;

insert into public.compliance_tasks (tenant_id, region, category, title, status, severity, due_at, details)
values
  ('00000000-0000-4000-8000-000000000001', 'RW', 'fiscalisation', 'Validate EBM connectivity for lunch shift', 'in_progress', 'high', now() + interval '1 day', '{"sla_minutes":5,"last_success":"2024-03-18T10:00:00Z"}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'RW', 'ai_disclosure', 'Publish Kinyarwanda AI disclosure copy', 'pending', 'medium', now() + interval '3 days', '{"surface":"diner_chat"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'dsa_kybc', 'Upload updated KYBC documents', 'blocked', 'critical', now() + interval '2 days', '{"reason":"Awaiting signed director resolution"}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'gdpr', 'Confirm DSR runbook for deletion requests', 'in_progress', 'high', now() + interval '5 days', '{"owner":"ops@icupa.test"}'::jsonb)
on conflict (id) do nothing;

insert into public.compliance_notice_templates (tenant_id, region, notice_type, surface, content, last_reviewed_at)
values
  (null, 'RW', 'ai_disclosure', 'diner_chat', 'ICUPA AI helps you browse and order. Responses may be generated by AI; confirm allergens with staff before ordering.', now() - interval '14 days'),
  (null, 'RW', 'privacy_notice', 'rwanda_dpl', 'We process your data to serve your table session. Rwanda DPL rights: access, rectification, deletion via privacy@icupa.rw.', now() - interval '21 days'),
  (null, 'EU', 'ai_disclosure', 'diner_chat', 'ICUPA AI waiter provides suggestions. Identify as AI and escalate to staff on request. Always disclose pricing and allergens.', now() - interval '10 days'),
  (null, 'EU', 'privacy_notice', 'gdpr_footer', 'ICUPA Limited is the controller. GDPR rights include access, portability, and objection. Contact privacy@icupa.eu.', now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000001', 'RW', 'ai_disclosure', 'diner_chat', 'Murakaza neza! This AI assistant suggests dishes and cites menu sources. Confirm allergens with our team before ordering.', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', 'RW', 'privacy_notice', 'rwanda_dpl', 'ICUPA Rwanda processes limited data to run your order. Email privacy@tenant.rw to access or delete records under Rwanda DPL.', now() - interval '5 days'),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'ai_disclosure', 'diner_chat', 'Hi! ICUPA AI assists in English and Maltese. It cites menu sources and never finalises payments without your review.', now() - interval '4 days'),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'privacy_notice', 'gdpr_footer', 'ICUPA EU processes your booking and order data. Exercise GDPR rights at privacy@tenant.mt or in the Admin console.', now() - interval '8 days')
on conflict do nothing;

insert into public.kybc_checklist_items (tenant_id, region, requirement, status, notes, last_verified_at, verified_by)
values
  ('00000000-0000-4000-8000-000000000001', 'RW', 'Upload Rwanda trade licence', 'pending', '{"document":"licence.pdf"}'::jsonb, null, null),
  ('00000000-0000-4000-8000-000000000001', 'RW', 'Provide beneficial owner list', 'in_progress', '{"owner":"ops@icupa.test"}'::jsonb, null, null),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'Submit MFSA registration certificate', 'resolved', '{"reference":"MFSA-2024-11"}'::jsonb, now() - interval '12 days', '00000000-0000-4000-9000-0000000000bb'),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'Upload proof of bank account ownership', 'pending', '{"bank":"Bank of Valletta"}'::jsonb, null, null)
on conflict (id) do nothing;

insert into public.dsr_requests (tenant_id, region, subject_identifier, contact_email, request_type, status, notes, requested_by)
values
  ('00000000-0000-4000-8000-000000000001', 'RW', 'guest-49321', 'privacy@icupa.test', 'export', 'queued', '{"source":"seed","notes":"Prepare Rwanda export package."}'::jsonb, '00000000-0000-4000-9000-0000000000bb'),
  ('00000000-0000-4000-8000-000000000002', 'EU', 'sofia@example.mt', 'privacy@icupa.eu', 'delete', 'in_progress', '{"source":"seed","notes":"Awaiting finance sign-off before deletion."}'::jsonb, '00000000-0000-4000-9000-0000000000bb')
on conflict (id) do nothing;

insert into public.tenant_kpi_snapshots (tenant_id, window, captured_at, gmv_cents, aov_cents, attach_rate, prep_sla_p95_minutes, ai_acceptance_rate, safety_blocks)
values
  ('00000000-0000-4000-8000-000000000001', '7d', now(), 248000, 124000, 0.420, 11.5, 0.780, 1),
  ('00000000-0000-4000-8000-000000000001', '30d', now() - interval '1 day', 1088000, 118000, 0.390, 12.2, 0.755, 3),
  ('00000000-0000-4000-8000-000000000002', '7d', now(), 186500, 93250, 0.365, 9.8, 0.702, 0),
  ('00000000-0000-4000-8000-000000000002', '30d', now() - interval '1 day', 812300, 101500, 0.342, 10.4, 0.684, 2)
on conflict (id) do nothing;
