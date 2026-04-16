-- Cloud Planner Supabase schema
-- Run this in the Supabase SQL editor or via the Supabase CLI migration flow.

create table if not exists public.nodes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id text references public.nodes(id) on delete set null,
  type text not null check (type in ('area', 'goal', 'project', 'task')),
  title text not null default '',
  description text not null default '',
  status text not null default 'not-started' check (status in ('not-started', 'in-progress', 'completed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  deadline date,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists nodes_user_id_idx on public.nodes (user_id);
create index if not exists nodes_parent_id_idx on public.nodes (parent_id);
create index if not exists nodes_type_idx on public.nodes (type);
create index if not exists nodes_status_idx on public.nodes (status);

create table if not exists public.notes (
  node_id text primary key references public.nodes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notes_user_id_idx on public.notes (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_nodes_updated_at on public.nodes;
create trigger set_nodes_updated_at
before update on public.nodes
for each row
execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

alter table public.nodes enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Users can view own nodes" on public.nodes;
create policy "Users can view own nodes"
on public.nodes
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own nodes" on public.nodes;
create policy "Users can insert own nodes"
on public.nodes
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own nodes" on public.nodes;
create policy "Users can update own nodes"
on public.nodes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own nodes" on public.nodes;
create policy "Users can delete own nodes"
on public.nodes
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own notes" on public.notes;
create policy "Users can view own notes"
on public.notes
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notes" on public.notes;
create policy "Users can insert own notes"
on public.notes
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notes" on public.notes;
create policy "Users can update own notes"
on public.notes
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notes" on public.notes;
create policy "Users can delete own notes"
on public.notes
for delete
using (auth.uid() = user_id);
