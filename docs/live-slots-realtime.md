# Group live slots realtime channel

EcoTrips group flows publish realtime occupancy updates to Supabase Realtime so clients can animate live counter changes without polling. Updates originate from the `live-slots-update` Edge Function which recomputes counts for the `group.live_slots` table and broadcasts them through the standard `postgres_changes` feed.

## Channel naming

- **Channel**: `group-live-slots`
- **Scope**: `schema=group`, `table=live_slots`
- **Event types**: `INSERT`, `UPDATE`

Subscribe with the Supabase client:

```ts
const channel = supabase
  .channel("group-live-slots")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "group",
      table: "live_slots",
      filter: `itinerary_id=eq.${itineraryId}`,
    },
    (payload) => {
      // payload.new mirrors group.live_slots rows
    },
  )
  .subscribe();
```

The fixtures in `ops/fixtures/group_live_slots_event.json` and `ops/fixtures/concierge_presence_fixture.json` illustrate expected payloads for ops tooling and contract testing.

## Edge function trigger

Invoke the function whenever presence opt-in changes or contributions update slot counts:

```ts
await supabase.functions.invoke("live-slots-update", {
  body: { itinerary_id: itineraryId },
});
```

The function also accepts `group_id` or `escrow_id` if those identifiers are easier to surface from your workflow.

## Monitoring

- Supabase Realtime inspector: watch the `group-live-slots` channel for live updates.
- Edge function logs: filtered by `groups.live_slots.update` event (audit payload includes `presence_opt_in`, `presence_visible`, and `presence_online`).

For offline verification, load the new fixtures into your observability tooling to ensure ops dashboards reflect the same schema.

## Payload fields

Each realtime payload mirrors the `group.live_slots` row. Counters correspond to traveler presence filters in `concierge.presence`:

- `presence_opt_in`: travelers who opted in to presence sharing.
- `presence_visible`: opted-in travelers who left their visibility flag enabled.
- `presence_online`: visible travelers whose latest status is `online`.

Presence records are scoped per group with traveler-owned RLS, so opt-outs immediately reflect in the broadcast counters once the edge function runs.
