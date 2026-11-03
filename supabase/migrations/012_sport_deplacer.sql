-- Life v0.16 — Déplacer une séance sport à la main (calendrier de l'accueil).
-- Une séance « pinned » reste là où tu l'as mise ; le reste de la semaine s'organise autour.
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.
alter table public.planned_sessions add column if not exists pinned boolean not null default false;
