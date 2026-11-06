-- Life v0.30 — Tâches : projets et rappels iPhone.
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null default 'blue',
  icon text,                  -- clé d'icône (voyage, ecole…) : facultative
  due_date date,              -- date de fin du projet (facultative)
  done boolean not null default false,
  done_at timestamptz,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists project_id uuid references public.task_projects on delete set null;
-- rappel : 'at' à l'heure, '15' / '60' minutes avant, 'morning' le jour même à 9 h, 'eve' la veille à 20 h
alter table public.tasks add column if not exists reminder text;
alter table public.tasks drop constraint if exists tasks_reminder_check;
alter table public.tasks add constraint tasks_reminder_check check (reminder is null or reminder in ('at', '15', '60', 'morning', 'eve'));
create index if not exists tasks_user_project on public.tasks (user_id, project_id);

alter table public.task_projects enable row level security;
drop policy if exists "own rows" on public.task_projects;
create policy "own rows" on public.task_projects for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.task_projects to authenticated;
