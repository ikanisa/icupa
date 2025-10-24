# @ecotrips/client UI Manifest

## Chat Experiences

### `/app/(public)/chat/page.tsx`
- Server entry for the chat showcase. Wraps the chat OptionCards in a glass panel that documents which
  edge functions are triggered (inventory-hold + air-price-watch).
- Uses the shared `CardGlass` component for parity with the rest of the PWA.

### `app/(public)/components/ChatOptionBoard.tsx`
- Client component that renders the actionable OptionCards inside chat.
- Calls `@ecotrips/api` `inventory.hold` (with idempotency headers) and the new `air.price.watch` descriptor.
- Emits a compare modal when travellers want side-by-side deltas for pace, supplier, and target fare.
- Surfaces hold/watch status lines per option so the chat transcript can reference the underlying
  hold reference and fare watch id.

### `packages/ui/src/components/OptionCard.tsx`
- New design-system primitive for itinerary or bundle tiles with highlights, metadata, actions, and status slots.
- Exported via `@ecotrips/ui` for reuse across web and ops surfaces.

## Edge Functions referenced
- `inventory-hold` – 15 minute idempotent hold (supplies source + expiry metadata).
- `air-price-watch` – new audit-level fare watcher that records submission timestamps.
