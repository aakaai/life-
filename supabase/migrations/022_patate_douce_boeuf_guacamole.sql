-- Recette d'Esteban : patate douce, bœuf haché et guacamole (10 nov. 2026) (généré par scripts/recette-sql.mjs depuis scripts/recettes/022_patate_douce_boeuf_guacamole.json).
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Sans danger si tu le relances :
-- les ingrédients déjà présents (même clé ou même nom) ne sont pas recréés, les recettes du même nom sont mises à jour.
-- Valeurs : table Ciqual 2025 (code indiqué), sinon étiquette. Prix : estimations Colruyt, modifiables dans l'app.

do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
  rec record;
  rid uuid;
  rlines jsonb;
  tg numeric; tk numeric; tp numeric; tc numeric; tf numeric;
begin
  if uid is null then
    raise exception 'Aucun compte trouvé dans auth.users';
  end if;

  create temp table _ing (
    key text, name text, rayon text, ciqual_code text,
    kcal numeric, protein numeric, carbs numeric, fat numeric,
    pack_g numeric, pack_label text, pack_price numeric,
    unit_g numeric, unit_name text, scalable boolean, pantry boolean
  ) on commit drop;
  insert into _ing values
    ('patate_douce', 'Patates douces', 'Fruits et légumes', '4101', 81, 1.6, 17.1, 0.1, 1000, '1 kg', 2.49, null, null, true, false),
    ('hache', 'Haché pur bœuf 5 %', 'Viande et charcuterie', '6250', 130, 21.9, 0.3, 4.6, 500, '500 g', 6.49, null, null, false, false),
    ('avocat', 'Avocat', 'Fruits et légumes', '13004', 203, 1.6, 0, 20.6, 140, '1 avocat', 0.99, 140, 'avocat', false, false),
    ('citron', 'Jus de citron (bouteille)', 'Épicerie', '2028', 29, 0.4, 6.1, 0.3, 250, '25 cl', 1.29, null, null, false, true),
    ('huile', 'Huile d’olive', 'Épicerie', '17270', 899, 0.2, 0, 99.9, 1000, '1 L', 8.99, null, null, false, true),
    ('epices', 'Épices (paprika, cumin)', 'Épicerie', null, 300, 14, 40, 10, 50, '50 g', 1.49, null, null, false, true);

  create temp table _rec (name text, category text, servings int, prep_min int, batch boolean, steps text) on commit drop;
  insert into _rec values
    ('Patate douce, bœuf haché et guacamole', 'rapide', 1, 25, false, 'Couper la patate douce en cubes ou en frites, mélanger avec l''huile, sel et paprika.
Airfryer 200 °C, 15-18 min en secouant à mi-cuisson.
Pendant ce temps, cuire le haché à la poêle 6-8 min, sel, poivre et épices.
Guacamole : écraser le demi-avocat à la fourchette avec le jus de citron et une pincée de sel.
Servir la patate douce et le haché, le guacamole par-dessus.');

  create temp table _line (recipe text, ord int, key text, grams numeric) on commit drop;
  insert into _line values
    ('Patate douce, bœuf haché et guacamole', 1, 'patate_douce', 150),
    ('Patate douce, bœuf haché et guacamole', 2, 'hache', 150),
    ('Patate douce, bœuf haché et guacamole', 3, 'avocat', 70),
    ('Patate douce, bœuf haché et guacamole', 4, 'citron', 10),
    ('Patate douce, bœuf haché et guacamole', 5, 'huile', 5),
    ('Patate douce, bœuf haché et guacamole', 6, 'epices', 2);

  -- Ingrédients manquants (on reconnaît les tiens par la clé ou par le nom)
  insert into public.ingredients
    (user_id, key, name, rayon, ciqual_code, kcal, protein, carbs, fat, pack_g, pack_label, pack_price, unit_g, unit_name, scalable, pantry)
  select uid, i.key, i.name, i.rayon, i.ciqual_code, i.kcal, i.protein, i.carbs, i.fat,
         i.pack_g, i.pack_label, i.pack_price, i.unit_g, i.unit_name, i.scalable, i.pantry
  from _ing i
  where not exists (
    select 1 from public.ingredients x
    where x.user_id = uid and (x.key = i.key or lower(x.name) = lower(i.name))
  );

  for rec in select * from _rec loop
    -- Lignes de la recette avec les ingrédients tels qu'ils sont dans ta base
    select jsonb_agg(jsonb_build_object('ingredient_id', x.id, 'grams', l.grams) order by l.ord),
           sum(l.grams), sum(x.kcal * l.grams / 100), sum(x.protein * l.grams / 100),
           sum(x.carbs * l.grams / 100), sum(x.fat * l.grams / 100)
    into rlines, tg, tk, tp, tc, tf
    from _line l
    join _ing i on i.key = l.key
    cross join lateral (
      select * from public.ingredients x
      where x.user_id = uid and (x.key = i.key or lower(x.name) = lower(i.name))
      order by (x.key = i.key) desc nulls last, x.created_at
      limit 1
    ) x
    where l.recipe = rec.name;

    select id into rid from public.recipes where user_id = uid and name = rec.name limit 1;
    if rid is null then
      insert into public.recipes (user_id, name) values (uid, rec.name) returning id into rid;
    end if;

    -- key reste vide : l'app supprime les recettes qui ont une clé (anciennes recettes de base)
    update public.recipes set
      category = rec.category, servings = rec.servings, prep_min = rec.prep_min, batch = rec.batch,
      steps = rec.steps, lines = rlines, items = '[]', cooked_measured = false,
      cooked_g = round(tg),
      kcal = round(tk / tg * 100),
      protein = round(tp / tg * 100, 1),
      carbs = round(tc / tg * 100, 1),
      fat = round(tf / tg * 100, 1)
    where id = rid;
  end loop;
end $$;
