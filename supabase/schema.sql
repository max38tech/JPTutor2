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

-- Storage bucket for screenshots attached to in-app bug reports. Marked
-- public so the URLs the server embeds in GitHub issues (as markdown images)
-- render for anyone viewing the issue - GitHub itself has no credentials to
-- fetch a private bucket. Uploads still only ever happen server-side with the
-- service_role key, so nothing here lets a client write directly.
insert into storage.buckets (id, name, public)
values ('bug-report-screenshots', 'bug-report-screenshots', true)
on conflict (id) do nothing;
