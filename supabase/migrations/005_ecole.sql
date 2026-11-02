-- Module École : on garde aussi le lieu (salle) et la description des événements d'agenda.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Sans danger si tu le relances.
-- Ensuite : mettre à jour la fonction calendar-sync (nouveau code dans supabase/functions/calendar-sync/index.ts).
alter table public.calendar_events add column if not exists location text;
alter table public.calendar_events add column if not exists description text;
