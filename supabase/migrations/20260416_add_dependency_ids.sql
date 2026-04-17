-- Add dependency links to planner nodes.
-- This lets a node depend on multiple other nodes.

alter table public.nodes
add column if not exists dependency_ids jsonb not null default '[]'::jsonb;
