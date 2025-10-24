alter table payment.payments
  add column if not exists provider_ref text;
