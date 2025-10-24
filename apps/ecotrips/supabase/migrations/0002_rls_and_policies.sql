-- Enable row level security on key tables
alter table core.profiles enable row level security;
alter table booking.itineraries enable row level security;
alter table booking.items enable row level security;
alter table payment.payments enable row level security;

-- core.profiles policies
create policy "Profiles select own" on core.profiles
  for select
  using (auth.uid() = auth_user_id);

-- booking.itineraries policies
create policy "Itineraries select own" on booking.itineraries
  for select
  using (auth.uid() = user_id);

create policy "Itineraries insert own" on booking.itineraries
  for insert
  with check (auth.uid() = user_id);

create policy "Itineraries update own" on booking.itineraries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- booking.items policies tied to parent itinerary ownership
create policy "Items select via itinerary" on booking.items
  for select
  using (
    exists (
      select 1
      from booking.itineraries i
      where i.id = itinerary_id
        and i.user_id = auth.uid()
    )
  );

create policy "Items insert via itinerary" on booking.items
  for insert
  with check (
    exists (
      select 1
      from booking.itineraries i
      where i.id = itinerary_id
        and i.user_id = auth.uid()
    )
  );

create policy "Items update via itinerary" on booking.items
  for update
  using (
    exists (
      select 1
      from booking.itineraries i
      where i.id = itinerary_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from booking.itineraries i
      where i.id = itinerary_id
        and i.user_id = auth.uid()
    )
  );

create policy "Items delete via itinerary" on booking.items
  for delete
  using (
    exists (
      select 1
      from booking.itineraries i
      where i.id = itinerary_id
        and i.user_id = auth.uid()
    )
  );

-- payment.payments select tied to itinerary ownership
create policy "Payments select via itinerary" on payment.payments
  for select
  using (
    exists (
      select 1
      from booking.itineraries i
      where i.id = itinerary_id
        and i.user_id = auth.uid()
    )
  );
