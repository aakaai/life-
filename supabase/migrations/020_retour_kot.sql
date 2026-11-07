-- Life v0.31 — « Retour au kot » : ce qu'il faut prendre le dimanche.
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

create table if not exists public.kot_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  sunday date not null,       -- le dimanche pour lequel la chose est notée (effacée dès le lundi)
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists kot_items_user_sunday on public.kot_items (user_id, sunday);

alter table public.kot_items enable row level security;
drop policy if exists "own rows" on public.kot_items;
create policy "own rows" on public.kot_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.kot_items to authenticated;
