-- Recettes d'Esteban : wok bœuf-cajou, riz cantonais + steak pané (8 nov. 2026) (généré par scripts/recette-sql.mjs depuis scripts/recettes/021_recettes_esteban.json).
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
    ('boeuf_emince', 'Bœuf émincé (maigre)', 'Viande et charcuterie', '6206', 118, 23.5, 0.4, 2.5, 300, '300 g', 5.49, null, null, false, false),
    ('nouilles', 'Nouilles aux œufs', 'Épicerie', '9863', 371, 11.9, 71, 3, 500, '500 g', 1.79, null, null, true, false),
    ('carotte', 'Carottes', 'Fruits et légumes', '20009', 30, 0.8, 5.2, 0, 1000, '1 kg', 0.99, 100, 'carotte', false, false),
    ('poivron', 'Poivrons', 'Fruits et légumes', '20041', 23, 0.8, 3.5, 0.3, 450, '3 pièces', 2.29, 150, 'poivron', false, false),
    ('oignon', 'Oignons', 'Fruits et légumes', '20034', 39, 1.1, 6.2, 0.6, 1000, '1 kg', 1.29, 150, 'oignon', false, false),
    ('cajou', 'Noix de cajou', 'Épicerie', '15054', 618, 17.4, 21.3, 48.1, 200, '200 g', 2.99, null, null, false, true),
    ('epices', 'Épices (paprika, cumin)', 'Épicerie', null, 300, 14, 40, 10, 50, '50 g', 1.49, null, null, false, true),
    ('bouillon_legumes', 'Bouillon de légumes', 'Épicerie', '11041', 287, 9.7, 26, 16, 100, '10 cubes', 1.29, 10, 'cube', false, true),
    ('huile', 'Huile d’olive', 'Épicerie', '17270', 899, 0.2, 0, 99.9, 1000, '1 L', 8.99, null, null, false, true),
    ('riz', 'Riz blanc', 'Épicerie', '9100', 350, 7, 77.5, 0.8, 1000, '1 kg', 1.69, null, null, true, false),
    ('poulet', 'Filet de poulet', 'Viande et charcuterie', '36017', 110, 23.4, 0, 1.5, 1000, '1 kg', 9.99, null, null, false, false),
    ('oeuf', 'Œufs', 'Produits laitiers et œufs', '22000', 140, 12.8, 0.1, 9.8, 600, 'boîte de 12', 3.29, 50, 'œuf', false, false),
    ('soja', 'Sauce soja', 'Épicerie', '11104', 40, 7.2, 1.7, 0, 250, '25 cl', 1.79, null, null, false, true),
    ('steak_pane', 'Steak pané dinde ou poulet', 'Viande et charcuterie', null, 228, 12, 18, 11, 400, '4 pièces', 3.99, 100, 'steak', false, false);

  create temp table _rec (name text, category text, servings int, prep_min int, batch boolean, steps text) on commit drop;
  insert into _rec values
    ('Wok bœuf, nouilles et cajou', 'rapide', 1, 20, false, 'Cuire les nouilles comme indiqué sur le paquet, égoutter.
Couper la carotte en bâtonnets fins, le demi-poivron et l''oignon en lamelles.
Poêle ou wok bien chaud avec l''huile : saisir le bœuf 2 min, réserver.
Faire sauter les légumes 4-5 min, ajouter le demi-cube de bouillon délayé dans 3 c. à soupe d''eau chaude et les épices.
Remettre le bœuf, ajouter les nouilles et les noix de cajou, mélanger 1 min.'),
    ('Riz cantonais au poulet', 'rapide', 1, 25, false, 'Cuire le riz (ou prendre du riz cuit de la veille, encore meilleur), laisser refroidir un peu.
Couper le poulet en dés et la carotte en petits cubes.
Poêle chaude avec l''huile : cuire le poulet 5-6 min, ajouter la carotte 3 min.
Pousser sur le côté, casser l''œuf dans la poêle et le brouiller.
Ajouter le riz et la sauce soja, faire sauter 2-3 min en mélangeant.');

  create temp table _line (recipe text, ord int, key text, grams numeric) on commit drop;
  insert into _line values
    ('Wok bœuf, nouilles et cajou', 1, 'boeuf_emince', 100),
    ('Wok bœuf, nouilles et cajou', 2, 'nouilles', 80),
    ('Wok bœuf, nouilles et cajou', 3, 'carotte', 100),
    ('Wok bœuf, nouilles et cajou', 4, 'poivron', 75),
    ('Wok bœuf, nouilles et cajou', 5, 'oignon', 75),
    ('Wok bœuf, nouilles et cajou', 6, 'cajou', 15),
    ('Wok bœuf, nouilles et cajou', 7, 'epices', 3),
    ('Wok bœuf, nouilles et cajou', 8, 'bouillon_legumes', 5),
    ('Wok bœuf, nouilles et cajou', 9, 'huile', 5),
    ('Riz cantonais au poulet', 1, 'riz', 80),
    ('Riz cantonais au poulet', 2, 'poulet', 120),
    ('Riz cantonais au poulet', 3, 'oeuf', 50),
    ('Riz cantonais au poulet', 4, 'carotte', 80),
    ('Riz cantonais au poulet', 5, 'soja', 15),
    ('Riz cantonais au poulet', 6, 'huile', 5);

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
