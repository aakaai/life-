-- Life v0.9 — Sport : écran « Progrès ».
-- Historique des tests FTP (pour suivre la FTP dans le temps et calculer
-- l'intensité de chaque sortie). À exécuter une fois dans Supabase › SQL Editor.

create table if not exists public.ftp_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  ftp int not null check (ftp between 50 and 600),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ftp_tests_user_date on public.ftp_tests (user_id, date);

alter table public.ftp_tests enable row level security;
drop policy if exists "own rows" on public.ftp_tests;
create policy "own rows" on public.ftp_tests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ftp_tests to authenticated;

-- Point de départ : la FTP actuelle des réglages, datée du jour de sa dernière modification.
insert into public.ftp_tests (user_id, date, ftp, note)
select s.id, coalesce(s.updated_at, s.created_at)::date, s.ftp, 'FTP de départ'
from public.sport_settings s
where not exists (select 1 from public.ftp_tests f where f.user_id = s.id);
