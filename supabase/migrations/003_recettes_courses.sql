-- Alimentation v0.5 : ingrédients avec prix, recettes, planning des repas, liste de courses.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Sans danger si tu le relances.

-- ---------- Réglages : pesée du samedi, jours de courses, portions ajustées ----------
alter table public.nutrition_settings add column if not exists weigh_day int not null default 5;           -- 0 = lundi … 6 = dimanche
alter table public.nutrition_settings add column if not exists shop_days jsonb not null default '[0, 3]';   -- lundi et jeudi
alter table public.nutrition_settings add column if not exists auto_portions boolean not null default true;

-- ---------- Ingrédients (valeurs pour 100 g, paquet et prix) ----------
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text,                       -- clé des ingrédients de base (null pour les tiens)
  name text not null,
  rayon text not null default 'Épicerie',
  ciqual_code text,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  pack_g numeric,                 -- contenu d'un paquet (g ou ml)
  pack_label text,
  pack_price numeric,             -- prix d'un paquet (€)
  price_date date,
  unit_g numeric,                 -- poids d'une pièce (œuf, tranche…)
  unit_name text,
  scalable boolean not null default false,   -- féculent ajusté selon la cible du jour
  pantry boolean not null default false,     -- placard : à vérifier plutôt qu'à acheter
  created_at timestamptz not null default now()
);
create index if not exists ingredients_user_key on public.ingredients (user_id, key);

-- ---------- Recettes : ajout des champs de la base de recettes ----------
alter table public.recipes add column if not exists key text;
alter table public.recipes add column if not exists category text not null default 'plat';
alter table public.recipes add column if not exists servings int not null default 1;
alter table public.recipes add column if not exists prep_min int;
alter table public.recipes add column if not exists batch boolean not null default false;
alter table public.recipes add column if not exists steps text;
alter table public.recipes add column if not exists lines jsonb not null default '[]';  -- [{ ingredient_id, grams }] pour toute la recette
alter table public.recipes add column if not exists cooked_measured boolean not null default false;  -- poids cuit pesé (sinon somme des ingrédients crus)

-- ---------- Planning des repas ----------
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  meal smallint not null check (meal between 0 and 4),
  recipe_id uuid not null references public.recipes on delete cascade,
  servings numeric not null default 1,
  eaten boolean not null default false,
  log_id uuid references public.food_logs on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists meal_plans_user_date on public.meal_plans (user_id, date);

-- ---------- Listes de courses (ce que tu as coché) ----------
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  start date not null,
  checked jsonb not null default '[]',   -- ingrédients achetés
  skipped jsonb not null default '[]',   -- ingrédients que tu as déjà
  created_at timestamptz not null default now(),
  unique (user_id, start)
);

-- ---------- Sécurité ----------
do $$
declare t text;
begin
  foreach t in array array['ingredients','meal_plans','shopping_lists']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.ingredients, public.meal_plans, public.shopping_lists to authenticated;
