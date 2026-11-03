-- Life v0.18.1 — Évènements d'agenda en double.
-- Cause : deux synchronisations des agendas lancées en même temps (par ex. l'app ouverte sur l'iPhone
-- et sur l'ordinateur) effacent puis réécrivent chacune les mêmes évènements → tout apparaît deux fois.
-- Ce script supprime les doublons existants et ajoute une fonction que l'app appelle après chaque synchro.
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

-- 1. Nettoyage tout de suite (garde un exemplaire de chaque évènement)
delete from public.calendar_events a
using public.calendar_events b
where a.user_id = b.user_id
  and a.source_id = b.source_id
  and a.uid is not distinct from b.uid
  and a.title is not distinct from b.title
  and a.start_at is not distinct from b.start_at
  and a.end_at is not distinct from b.end_at
  and a.day_start is not distinct from b.day_start
  and a.id > b.id;

-- 2. La même chose, appelée par l'app après chaque synchronisation (seulement tes lignes)
create or replace function public.dedupe_calendar_events()
returns integer
language sql
security invoker
set search_path = public
as $$
  with gone as (
    delete from public.calendar_events a
    using public.calendar_events b
    where a.user_id = (select auth.uid())
      and b.user_id = a.user_id
      and a.source_id = b.source_id
      and a.uid is not distinct from b.uid
      and a.title is not distinct from b.title
      and a.start_at is not distinct from b.start_at
      and a.end_at is not distinct from b.end_at
      and a.day_start is not distinct from b.day_start
      and a.id > b.id
    returning 1
  )
  select count(*)::int from gone;
$$;
grant execute on function public.dedupe_calendar_events() to authenticated;
