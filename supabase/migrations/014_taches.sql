-- Life v0.19 — Espace Tâches (et liste « À faire aujourd'hui » de l'accueil).
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null default 'gray',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  category_id uuid references public.task_categories on delete set null,
  priority int not null default 2 check (priority between 1 and 3), -- 1 basse, 2 moyenne, 3 haute
  planned_date date,          -- le jour où tu comptes la faire (vide = sans date)
  time text,                  -- « 16:30 » (facultatif) : la tâche apparaît dans le calendrier
  duration_min int,           -- durée prévue (facultative, 30 min par défaut dans le calendrier)
  due_date date,              -- date limite
  busy boolean not null default false, -- avec une heure : bloque le planning sport
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_planned on public.tasks (user_id, planned_date);

do $$
declare t text;
begin
  foreach t in array array['task_categories','tasks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
