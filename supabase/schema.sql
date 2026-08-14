-- Run this once in the Supabase project's SQL editor to set up feature
-- request logging for the app's in-app "Feature Idea" form.
--
-- Row Level Security is enabled with no policies defined, which means the
-- table is completely inaccessible via the public anon key - only the
-- service_role key (used server-side only, in server.ts, never shipped to
-- the client) can read or write it. This is intentional: it's the simplest
-- way to keep the table private on a project that otherwise uses Supabase's
-- default public API exposure.

create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  description text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'declined', 'done')),
  device_info text,
  app_version text
);

alter table feature_requests enable row level security;
