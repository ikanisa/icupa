set search_path = public, extensions;

drop function if exists public.enqueue_fiscalization_job(uuid, uuid);

do $$
begin
  if exists (
    select 1
    from pgmq.list_queues()
    where queue_name = 'fiscalization_jobs'
  ) then
    perform pgmq.drop_queue('fiscalization_jobs');
  end if;
end;
$$;
