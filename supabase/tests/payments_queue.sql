begin;

-- Use service role context so we can manage queue state during the test
set local role service_role;

-- Drain any existing fiscalisation jobs to ensure deterministic assertions
DO $$
DECLARE
  drained RECORD;
BEGIN
  LOOP
    SELECT * INTO drained FROM pgmq.read_queue('fiscalization_jobs', 1);
    EXIT WHEN drained.msg_id IS NULL;
    PERFORM pgmq.delete('fiscalization_jobs', drained.msg_id);
  END LOOP;
END $$;

-- Enqueue a job for the Kigali order/payment pair
DO $$
DECLARE
  job_id bigint;
  message RECORD;
BEGIN
  SELECT public.enqueue_fiscalization_job(
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000901'
  ) INTO job_id;

  IF job_id IS NULL THEN
    RAISE EXCEPTION 'enqueue_fiscalization_job should return a message identifier';
  END IF;

  SELECT * INTO message FROM pgmq.read_queue('fiscalization_jobs', 1);
  IF message.msg_id IS NULL THEN
    RAISE EXCEPTION 'Expected fiscalization job to be enqueued';
  END IF;

  IF message.message ->> 'order_id' <> '00000000-0000-4000-8000-000000000701' THEN
    RAISE EXCEPTION 'Queued job order_id mismatch: %', message.message;
  END IF;

  IF message.message ->> 'payment_id' <> '00000000-0000-4000-8000-000000000901' THEN
    RAISE EXCEPTION 'Queued job payment_id mismatch: %', message.message;
  END IF;

  IF message.message ? 'enqueued_at' IS FALSE THEN
    RAISE EXCEPTION 'Queued job must include enqueued_at timestamp metadata';
  END IF;

  -- Clean up the message so subsequent tests start empty
  PERFORM pgmq.delete('fiscalization_jobs', message.msg_id);
END $$;

-- Queue should now be empty again
DO $$
DECLARE
  message RECORD;
BEGIN
  SELECT * INTO message FROM pgmq.read_queue('fiscalization_jobs', 1);
  IF message.msg_id IS NOT NULL THEN
    RAISE EXCEPTION 'Fiscalization queue expected to be empty after cleanup';
  END IF;
END $$;

rollback;
