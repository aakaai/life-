-- Module Alimentation : à coller dans Supabase > SQL Editor > New query, puis « Run ».
-- Sans danger si tu le relances : rien n'est supprimé.

-- ---------- Réglages (une ligne par personne) ----------
create table if not exists public.nutrition_settings (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  age int not null default 22,
  height_cm numeric not null default 170,
  sex text not null default 'm',
  start_weight_kg numeric not null default 55,
  activity numeric not null default 1.4,
  surplus_kcal int not null default 300,
  protein_g int not null default 110,
  fat_pct int not null default 28,
  exclude_fish boolean not null default true,
  veggies text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Tes aliments : produits scannés, aliments créés, favoris ----------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null default 'custom' check (source in ('custom', 'off', 'ciqual')),
  code text,                -- code-barres (off) ou code Ciqual
  name text not null,
  brand text,
  kcal numeric not null default 0,   -- pour 100 g
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric,
  portion_label text,
  portion_g numeric,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists foods_user_code on public.foods (user_id, code);

-- ---------- Recettes et plats en lot ----------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  items jsonb not null default '[]',   -- [{ ref, name, grams, kcal, protein, carbs, fat }]
  cooked_g numeric,                    -- poids total une fois cuit
  kcal numeric not null default 0,     -- pour 100 g de plat cuit
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Ce que tu as mangé ----------
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  meal smallint not null default 0 check (meal between 0 and 4),
  ref text,           -- ciqual:<code>, food:<id> ou recipe:<id>
  name text not null,
  grams numeric not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date on public.food_logs (user_id, date);

-- ---------- Pesées (partagées avec le Sport) ----------
create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  kg numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- Ajustements automatiques de la cible ----------
create table if not exists public.nutrition_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  delta int not null default 0,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Sécurité : chacun ne voit que ses lignes ----------
alter table public.nutrition_settings enable row level security;
drop policy if exists "own settings" on public.nutrition_settings;
create policy "own settings" on public.nutrition_settings
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['foods','recipes','food_logs','weights','nutrition_adjustments']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.nutrition_settings, public.foods, public.recipes, public.food_logs,
  public.weights, public.nutrition_adjustments
to authenticated;

drop trigger if exists nutrition_settings_touch on public.nutrition_settings;
create trigger nutrition_settings_touch before update on public.nutrition_settings
  for each row execute function public.touch_updated_at();

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
