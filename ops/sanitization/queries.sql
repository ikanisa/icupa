-- List itineraries that look like test data (zero total, no items)
select i.id,
       i.user_id,
       i.status,
       i.total_cents,
       i.created_at,
       i.is_test,
       i.notes
from booking.itineraries i
left join booking.items bi on bi.itinerary_id = i.id
where bi.id is null
  and i.total_cents = 0
order by i.created_at
limit 50;

-- Count itineraries by month (helps spot stale batches)
select date_trunc('month', created_at) as month,
       count(*)
from booking.itineraries
group by 1
order by 1 desc;

-- Count itineraries by user (top suspected test owners)
select user_id,
       count(*) as itinerary_count,
       sum(case when is_test then 1 else 0 end) as flagged_tests
from booking.itineraries
group by user_id
order by itinerary_count desc
limit 20;

-- Inspect items for a specific itinerary (replace :itinerary_id)
select id,
       item_type,
       supplier_ref,
       start_at,
       end_at,
       price_cents,
       currency
from booking.items
where itinerary_id = '00000000-0000-0000-0000-000000000000';
