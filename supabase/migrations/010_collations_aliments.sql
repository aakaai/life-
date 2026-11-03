-- Life v0.12 — Alimentation : collation du matin + aliments seuls dans le planning.
-- À exécuter une fois dans Supabase › SQL Editor.

-- Repas possibles : 0 petit-déj, 5 collation du matin, 1 midi, 2 collation de l'après-midi,
-- 3 soir, 4 avant de dormir (jusqu'à 9 pour la suite).
alter table public.food_logs drop constraint if exists food_logs_meal_check;
alter table public.food_logs add constraint food_logs_meal_check check (meal between 0 and 9);
alter table public.meal_plans drop constraint if exists meal_plans_meal_check;
alter table public.meal_plans add constraint meal_plans_meal_check check (meal between 0 and 9);

-- Un repas prévu peut être une recette OU un aliment seul (ex. 1 banane = 120 g).
alter table public.meal_plans alter column recipe_id drop not null;
alter table public.meal_plans add column if not exists ingredient_id uuid references public.ingredients on delete cascade;
alter table public.meal_plans add column if not exists grams numeric;
alter table public.meal_plans drop constraint if exists meal_plans_what_check;
alter table public.meal_plans add constraint meal_plans_what_check check (recipe_id is not null or ingredient_id is not null);
