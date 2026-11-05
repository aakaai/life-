-- 016 · Notes de séance et contrôle de gêne (v0.25, 5 nov.)
-- Une note par exercice et par séance : gêne / douleur (+ zone) et texte libre.
create table if not exists public.exercise_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workout_logs on delete cascade,
  exercise_key text not null,
  pain boolean not null default false,
  area text,
  note text,
  created_at timestamptz not null default now(),
  unique (workout_id, exercise_key)
);
-- Réponse au début de la séance suivante : comme prévu (ok), un cran plus bas (lower) ou pas aujourd'hui (skip).
create table if not exists public.exercise_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references public.planned_sessions on delete cascade,
  exercise_key text not null,
  note_id uuid references public.exercise_notes on delete set null,
  choice text not null check (choice in ('ok', 'lower', 'skip')),
  created_at timestamptz not null default now(),
  unique (session_id, exercise_key)
);

do $$
declare t text;
begin
  foreach t in array array['exercise_notes','exercise_checks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
grant select, insert, update, delete on public.exercise_notes, public.exercise_checks to authenticated;
