-- Life v0.11 — module Habitudes.
-- Catégories, habitudes (quotidiennes, hebdo, mensuelles, tâches du mois, défis),
-- journal, pauses et bilans du dimanche. À exécuter une fois dans Supabase › SQL Editor.

-- ---------- Catégories (créées par toi, avec une couleur) ----------
create table if not exists public.habit_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null default 'blue',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Habitudes ----------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text,
  -- check = oui/non ; quantity = nombre avec objectif ; avoid = à éviter (réussie sans écart)
  kind text not null default 'check' check (kind in ('check', 'quantity', 'avoid')),
  target numeric,          -- objectif (quantity)
  unit text,               -- « L », « min », « pages »…
  step numeric,            -- valeur du bouton « + »
  -- daily ; weekly = X fois par semaine ; monthly = X fois par mois ;
  -- monthly_task = une fois par mois à partir d'un jour ; challenge = défi de 30 jours
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'monthly', 'monthly_task', 'challenge')),
  times int not null default 1,
  day_of_month int check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  end_date date,           -- fin d'un défi
  moment text not null default 'day' check (moment in ('morning', 'day', 'evening')),
  category_id uuid references public.habit_categories on delete set null,
  reminder_time text,      -- « 21:30 » (rappels de l'app iPhone)
  -- coche automatique depuis les autres modules
  auto text check (auto in ('sport_session', 'protein', 'kcal', 'weigh_in')),
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Journal : une ligne par habitude et par jour ----------
-- check : value = 1 ; quantity : value = quantité du jour ; avoid : value = 1 signifie « écart »
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  date date not null,
  value numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);
create index if not exists habit_logs_user_date on public.habit_logs (user_id, date);

-- ---------- Pauses (une habitude ou toutes : habit_id vide) ----------
create table if not exists public.habit_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid references public.habits on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------- Bilan guidé du dimanche ----------
create table if not exists public.habit_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  went_well text,
  blocked text,
  goal text,
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------- Sécurité : chacun ne voit que ses lignes ----------
do $$
declare t text;
begin
  foreach t in array array['habit_categories','habits','habit_logs','habit_pauses','habit_reviews']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
