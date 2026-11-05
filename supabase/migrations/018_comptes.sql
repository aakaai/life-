-- Life v0.27 — Budget : comptes d'épargne (Vacances, Vélo, Déco…).
-- Les objectifs deviennent des comptes (objectif facultatif). Chaque versement, retrait ou virement est noté,
-- et une dépense peut être « payée avec » un compte.
-- À exécuter une fois dans Supabase › SQL Editor. Sans danger si tu le relances.

-- Un compte peut ne pas avoir d'objectif
alter table public.savings_goals alter column target drop not null;

-- Mouvements des comptes (montant positif = entrée, négatif = sortie)
create table if not exists public.savings_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references public.savings_goals on delete cascade,
  date date not null default current_date,
  amount numeric not null,
  kind text not null check (kind in ('initial', 'deposit', 'withdraw', 'transfer')),
  peer_id uuid references public.savings_goals on delete set null, -- l'autre compte d'un virement
  transfer_id uuid,                                                 -- relie les deux moitiés d'un virement
  note text,
  created_at timestamptz not null default now()
);
create index if not exists savings_moves_user_account on public.savings_moves (user_id, account_id);

alter table public.savings_moves enable row level security;
drop policy if exists "own rows" on public.savings_moves;
create policy "own rows" on public.savings_moves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.savings_moves to authenticated;

-- Dépense payée avec un compte (vide = budget du mois)
alter table public.budget_transactions add column if not exists account_id uuid references public.savings_goals on delete set null;

-- Objectifs existants : ce qui était déjà mis de côté devient le solde de départ
insert into public.savings_moves (user_id, account_id, date, amount, kind)
select g.user_id, g.id, g.created_at::date, g.saved, 'initial'
from public.savings_goals g
where g.saved > 0 and not exists (select 1 from public.savings_moves m where m.account_id = g.id);
