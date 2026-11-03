-- Life v0.15 — Agenda de l'accueil : tes propres évènements (catégories, répétitions, rappels).
-- Les agendas Google / Hyperplanning restent dans calendar_events (lecture seule).
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

-- ---------- Catégories (couleur Notion + « bloque le sport » par défaut) ----------
create table if not exists public.agenda_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null default 'gray',
  blocks_sport boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Évènements ----------
-- Avec heure : start_at / end_at. Journée entière : day_start / day_end (day_end exclu,
-- comme dans les agendas iCal). Répétition : repeat + repeat_days (0 = lundi) +
-- repeat_until ; exdates = occurrences supprimées ou modifiées à part.
create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  category_id uuid references public.agenda_categories on delete set null,
  all_day boolean not null default false,
  start_at timestamptz,
  end_at timestamptz,
  day_start date,
  day_end date,
  location text,
  note text,
  busy boolean not null default true,      -- bloque le planning sport
  reminder_min int,                        -- minutes avant le début (vide = pas de rappel)
  repeat text check (repeat in ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  repeat_days int[],
  repeat_until date,
  exdates date[] not null default '{}',
  created_at timestamptz not null default now(),
  check ((all_day and day_start is not null and day_end > day_start)
      or (not all_day and start_at is not null and end_at > start_at))
);
create index if not exists agenda_events_user_start on public.agenda_events (user_id, start_at);
create index if not exists agenda_events_user_day on public.agenda_events (user_id, day_start);

-- ---------- Sécurité : chacun ne voit que ses lignes ----------
do $$
declare t text;
begin
  foreach t in array array['agenda_categories','agenda_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
