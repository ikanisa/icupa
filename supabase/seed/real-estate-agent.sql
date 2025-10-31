-- Sample seed data for Real Estate Agent testing
-- This file provides minimal test data for acceptance testing

set search_path = public;

-- Sample source
insert into public.sources (id, domain, tos_url, crawl_policy, last_seen_at)
values (
  '10000000-0000-4000-8000-000000000001',
  'example-realtor.com',
  'https://example-realtor.com/terms',
  '{"rate_limit": 60, "allowed_paths": ["/listings/*"]}'::jsonb,
  now()
) on conflict (id) do nothing;

-- Sample contacts
insert into public.contacts (id, kind, name, phone, email, whatsapp_waid, consent_status)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'individual',
    'John Property Owner',
    '+35699123456',
    'owner@example.com',
    '35699123456',
    'granted'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'individual',
    'Jane Seeker',
    '+35699234567',
    'seeker@example.com',
    '35699234567',
    'granted'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'agency',
    'Malta Real Estate Agency',
    '+35621234567',
    'agency@example.com',
    '35621234567',
    'granted'
  )
on conflict (id) do nothing;

-- Mark first contact as owner
insert into public.owners (id, proof_status, notes)
values (
  '20000000-0000-4000-8000-000000000001',
  'verified',
  'Verified via title deed upload'
) on conflict (id) do nothing;

-- Sample listings
insert into public.listings (
  id,
  source_id,
  external_id,
  url,
  title,
  description,
  type,
  longlet_bool,
  shortlet_bool,
  location_text,
  lat,
  lng,
  price_eur,
  beds,
  baths,
  area_m2,
  furnished,
  pets,
  amenities,
  photos,
  available_from,
  owner_contact_id
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'EXT-12345',
    'https://example-realtor.com/listings/12345',
    'Modern 2BR Apartment in Sliema',
    'Beautiful modern apartment with sea views, close to all amenities. Fully furnished with high-quality appliances.',
    'apartment',
    true,
    false,
    'Sliema, Malta',
    35.9106, -- Sliema coordinates
    14.5047,
    1200.00,
    2,
    1,
    85.5,
    true,
    false,
    '["wifi", "air_conditioning", "dishwasher", "washing_machine", "sea_view"]'::jsonb,
    '["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]'::jsonb,
    '2025-11-01',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'EXT-12346',
    'https://example-realtor.com/listings/12346',
    'Cozy Studio in Valletta',
    'Charming studio in the heart of Valletta, perfect for one person. Walking distance to restaurants and shops.',
    'studio',
    true,
    true,
    'Valletta, Malta',
    35.8989,
    14.5146,
    800.00,
    0, -- studio typically has 0 bedrooms
    1,
    45.0,
    true,
    true,
    '["wifi", "air_conditioning", "central_location"]'::jsonb,
    '["https://example.com/photo3.jpg"]'::jsonb,
    '2025-11-15',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'EXT-12347',
    'https://example-realtor.com/listings/12347',
    'Spacious 3BR House with Garden',
    'Large family house with private garden and garage. Quiet residential area, close to schools.',
    'house',
    true,
    false,
    'Naxxar, Malta',
    35.9136,
    14.4436,
    1500.00,
    3,
    2,
    150.0,
    false,
    true,
    '["wifi", "garden", "garage", "bbq_area"]'::jsonb,
    '["https://example.com/photo4.jpg", "https://example.com/photo5.jpg"]'::jsonb,
    '2025-12-01',
    '20000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

-- Sample lead request
insert into public.lead_requests (
  id,
  seeker_contact_id,
  prefs,
  budget_min,
  budget_max,
  locations,
  long_or_short
)
values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '{"beds": 2, "furnished": true, "amenities": ["wifi", "air_conditioning"]}'::jsonb,
  900.00,
  1300.00,
  ARRAY['Sliema', 'St Julians', 'Gzira'],
  'long'
) on conflict (id) do nothing;

-- Sample match
insert into public.matches (
  id,
  lead_request_id,
  listing_id,
  score,
  reasons,
  status
)
values (
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  0.95,
  '["Price within budget", "Desired location", "2 bedrooms as requested", "Fully furnished"]'::jsonb,
  'pending_owner'
) on conflict (id) do nothing;

-- Sample communication
insert into public.comms (
  id,
  channel,
  direction,
  listing_id,
  contact_id,
  thread_id,
  transcript,
  consent_snapshot,
  started_at
)
values (
  '60000000-0000-4000-8000-000000000001',
  'whatsapp',
  'outbound',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'thread-12345',
  'Agent: Hello John, we have a potential tenant interested in your property at Sliema. Are you available to show it?',
  '{"consent_status": "granted", "timestamp": "2025-10-30T12:00:00Z"}'::jsonb,
  now() - interval '2 hours'
) on conflict (id) do nothing;

-- Sample consent record
insert into public.consents (
  id,
  contact_id,
  channel,
  purpose,
  granted_bool,
  evidence
)
values (
  '70000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'whatsapp',
  'property_matching',
  true,
  '{"method": "opt_in_message", "timestamp": "2025-10-30T10:00:00Z", "message": "Yes, I agree to receive messages about my property"}'::jsonb
) on conflict (id) do nothing;

-- Note: Embeddings are not seeded here as they should be generated by the embed_listings function
