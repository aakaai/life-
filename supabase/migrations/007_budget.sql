-- Module Budget : catégories, opérations, abonnements, revenus réguliers, objectifs d'épargne.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Sans danger si tu le relances.

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text,
  color text not null default 'gray',
  monthly_budget numeric,            -- null = pas de plafond
  kind text not null default 'normal' check (kind in ('normal', 'subscriptions')),
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount numeric not null check (amount >= 0),
  category_id uuid references public.budget_categories on delete set null,
  date date not null,
  merchant text,                     -- commerçant (dépense) ou source (revenu)
  note text,
  origin text not null default 'manual' check (origin in ('manual', 'subscription', 'recurring')),
  origin_id uuid,                    -- abonnement ou revenu régulier d'origine
  created_at timestamptz not null default now()
);
create index if not exists budget_tx_user_date on public.budget_transactions (user_id, date);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  amount numeric not null,
  period text not null default 'monthly' check (period in ('weekly', 'monthly', 'yearly')),
  next_date date not null,           -- prochain prélèvement
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,                -- job étudiant, parents…
  amount numeric not null,
  next_date date not null,           -- prochaine rentrée (puis chaque mois)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text,
  target numeric not null,
  saved numeric not null default 0,
  deadline date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['budget_categories','budget_transactions','subscriptions','recurring_incomes','savings_goals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.budget_categories, public.budget_transactions, public.subscriptions,
  public.recurring_incomes, public.savings_goals
to authenticated;
