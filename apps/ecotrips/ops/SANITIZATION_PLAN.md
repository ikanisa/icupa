# Itinerary Sanitization Plan (Offline-Safe)

## 1. Identify Candidate Test Itineraries
Use read-only queries (see `ops/sanitization/queries.sql`) to surface rows that are likely test data. Common heuristics:
- `is_test = true` or `notes` referencing internal QA.
- `total_cents = 0` **and** no rows in `booking.items` for the itinerary.
- Itineraries created by known test/automation accounts (`user_id` of QA users).
- Very old drafts (e.g., `created_at < '2024-01-01'`) that never moved beyond `status='draft'`.

## 2. Preview the Impact
Before archiving, run `SELECT *` for each candidate itinerary and its items to confirm they are safe to remove from active tables. Keep the snapshots in your local notes for quick reference.

## 3. Stage IDs for Archiving
1. Ensure `ops/sanitization/CONFIRM_ARCHIVE.txt` remains `PENDING` while you collect candidates.
2. Add one UUID per line to `ops/sanitization/itinerary_ids.txt` (leave existing comments in place for documentation).
3. When the list is final, replace `PENDING` with `APPROVED` in `CONFIRM_ARCHIVE.txt`.

## 4. Execute the Archive Procedure
Run the helper script, which in turn calls the Postgres function `booking.archive_itineraries`:
```sh
./ops/sanitization/archive_itineraries.sh
```
- The script aborts unless `CONFIRM_ARCHIVE.txt` is exactly `APPROVED`.
- It reads UUIDs from `itinerary_ids.txt` (ignoring comments/blank lines).
- The output reports how many itineraries were moved to the archive tables.

## 5. Verify Results
After the script completes:
- Confirm the rows are gone from `booking.itineraries` / `booking.items`.
- Check `booking.itineraries_archive` / `booking.items_archive` for the copied data (the archive captures the original values plus `archived_at`).

## 6. Restoring an Archived Itinerary (Manual)
If you need to reverse an archive:
1. Insert the row back into the live tables from the archive snapshots:
   ```sql
   insert into booking.itineraries (id, user_id, group_id, currency, total_cents, status, created_at, is_test, notes)
   select id, user_id, group_id, currency, total_cents, status, created_at, is_test, notes
   from booking.itineraries_archive
   where id = '<itinerary_uuid>';

   insert into booking.items (id, itinerary_id, item_type, supplier_ref, start_at, end_at, pax, price_cents, currency)
   select id, itinerary_id, item_type, supplier_ref, start_at, end_at, pax, price_cents, currency
   from booking.items_archive
   where itinerary_id = '<itinerary_uuid>';
   ```
2. Optionally remove the restored rows from the archive tables (or leave as audit trail).

## 7. Post-Run Documentation
Record the archived IDs, reasoning, and verification notes in your ops log. This ensures long-term traceability when the offline sandbox eventually reconnects to production systems.
