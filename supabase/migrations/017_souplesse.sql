-- Life v0.26 — Souplesse : étirements du soir et séances de mobilité.
-- Nouveaux types de séance dans le planning sport, coche automatique de l'habitude « Étirements »,
-- et un repère pour ne pas recréer l'habitude si tu la supprimes.
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

-- Séances prévues : en plus de muscu et vélo, 'etirements' (10 min le soir) et 'mobilite' (2 × 20 min par semaine)
alter table public.planned_sessions drop constraint if exists planned_sessions_kind_check;
alter table public.planned_sessions add constraint planned_sessions_kind_check
  check (kind in ('muscu', 'velo', 'etirements', 'mobilite'));

-- Habitudes : nouvelle coche automatique « stretch » (étirements ou mobilité faits ce jour-là)
alter table public.habits drop constraint if exists habits_auto_check;
alter table public.habits add constraint habits_auto_check
  check (auto in ('sport_session', 'protein', 'kcal', 'weigh_in', 'stretch'));

-- Réglages sport : { habit_created: true } une fois l'habitude créée
alter table public.sport_settings add column if not exists souplesse jsonb;
