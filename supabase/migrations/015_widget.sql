-- 015 · Widget iPhone « Ma journée » (v0.23, 4 nov.)
-- L'app (web ou iPhone) écrit ici un résumé de ta journée (calendrier, tâches, habitudes).
-- Le widget le lit avec ta clé privée, via la fonction Edge « widget » ; seule l'empreinte (SHA-256)
-- de la clé est gardée. Cocher sur le widget passe aussi par la fonction.
create table if not exists public.widget_feed (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  key_hash text not null unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.widget_feed enable row level security;
drop policy if exists "own rows" on public.widget_feed;
create policy "own rows" on public.widget_feed for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.widget_feed to authenticated;
