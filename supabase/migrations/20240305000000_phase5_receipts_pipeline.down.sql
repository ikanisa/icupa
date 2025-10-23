set search_path = public, pgmq;

drop function if exists public.delete_fiscalization_job(bigint);
drop function if exists public.dequeue_fiscalization_job(integer);
