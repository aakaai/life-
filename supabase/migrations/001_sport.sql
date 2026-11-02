-- Module Sport : à coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Sans danger si tu le relances : rien n'est supprimé.

-- ---------- Réglages sport (une ligne par personne) ----------
create table if not exists public.sport_settings (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  ftp int not null default 210,
  handle_kg numeric not null default 2,
  plates_total_kg numeric not null default 22,
  plate_step_kg numeric not null default 1,
  availability jsonb,
  keywords jsonb,
  rest_sound boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Agendas connectés (adresse iCal secrète) ----------
create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  url text not null,
  last_error text,
  created_at timestamptz not null default now()
);

-- ---------- Événements lus dans ces agendas (copie, remplacée à chaque synchro) ----------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references public.calendar_sources on delete cascade,
  uid text,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  all_day boolean not null default false,
  day_start date,
  day_end date,
  created_at timestamptz not null default now()
);
create index if not exists calendar_events_user_start on public.calendar_events (user_id, start_at);

-- ---------- Séances prévues ----------
create table if not exists public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  date date not null,
  start_time text,
  duration_min int,
  kind text not null check (kind in ('muscu', 'velo')),
  template_key text not null,
  label text,
  variant text not null default 'normal',
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped', 'missed', 'unplaced')),
  note text,
  preferred_date date not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists planned_sessions_user_week on public.planned_sessions (user_id, week_start);

-- ---------- Journal musculation ----------
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid references public.planned_sessions on delete set null,
  template_key text not null,
  variant text not null default 'normal',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workout_logs on delete cascade,
  exercise_key text not null,
  set_index int not null,
  weight_kg numeric,
  reps int,
  seconds int,
  rir int,
  created_at timestamptz not null default now()
);
create index if not exists set_logs_user_ex on public.set_logs (user_id, exercise_key);

-- ---------- Journal vélo ----------
create table if not exists public.ride_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid references public.planned_sessions on delete set null,
  template_key text,
  date date not null,
  duration_min int,
  avg_power int,
  rpe int,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Sécurité : chacun ne voit que ses lignes ----------
alter table public.sport_settings enable row level security;
drop policy if exists "own settings" on public.sport_settings;
create policy "own settings" on public.sport_settings
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['calendar_sources','calendar_events','planned_sessions','workout_logs','set_logs','ride_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.sport_settings, public.calendar_sources, public.calendar_events,
  public.planned_sessions, public.workout_logs, public.set_logs, public.ride_logs
to authenticated;

drop trigger if exists sport_settings_touch on public.sport_settings;
create trigger sport_settings_touch before update on public.sport_settings
  for each row execute function public.touch_updated_at();
