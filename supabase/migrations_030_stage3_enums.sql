-- JadePink Store OS — 030 Stage 3: enums
-- Run AFTER 020; first of the Stage 3 block (030-100).
-- Postgres has no `CREATE TYPE IF NOT EXISTS`, so this uses a guarded DO block.
-- Safe to re-run.

do $$
begin
  create type public.product_visit_status as enum (
    'SELECTED',
    'TRIAL_IN_PROGRESS',
    'TRIAL_COMPLETED',
    'LIKED',
    'DROPPED',
    'PURCHASED'
  );
exception
  when duplicate_object then null;
end $$;
