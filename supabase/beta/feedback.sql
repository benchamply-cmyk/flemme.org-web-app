-- MANUAL ONLY: apply to a separate beta Supabase project after approval.
-- Kept outside migrations so production db push cannot apply this experiment.
begin;
create table public.beta_feedback (
 id uuid primary key,
 created_at timestamptz not null default now(),
 variant jsonb not null check (jsonb_typeof(variant) = 'object'),
 page text not null,
 rating smallint not null check (rating between 1 and 5),
 comment text not null check (length(comment) between 10 and 3000),
 consent boolean not null check (consent),
 notified_at timestamptz
);
alter table public.beta_feedback enable row level security;
revoke all on public.beta_feedback from public, anon, authenticated;
grant select, insert, update on public.beta_feedback to service_role;
create index beta_feedback_created_at_idx on public.beta_feedback(created_at);
commit;
-- Retention and pending notification monitoring: configure after project creation.
-- delete from public.beta_feedback where created_at < now() - interval '90 days';
-- select id from public.beta_feedback where notified_at is null;
