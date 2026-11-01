-- Étape 0 — Fondations
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > coller > Run.
--
-- Principe de sécurité pour TOUTES les tables de l'app :
-- Row Level Security activé + règles « chacun ne voit que ses lignes ».
-- La clé publique de l'app peut donc être visible sans risque :
-- sans connexion, personne ne lit ni n'écrit rien.

create table if not exists public.profiles (
  id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  first_name  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profil — lire le sien" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profil — créer le sien" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

create policy "profil — modifier le sien" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "profil — supprimer le sien" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

grant select, insert, update, delete on public.profiles to authenticated;

-- Met à jour updated_at automatiquement (réutilisé par les tables des modules).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
