-- Collations : 5 recettes riches en protéines (3 nov. 2026) (généré par scripts/recette-sql.mjs depuis scripts/recettes/010_collations.json).
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
    ('skyr', 'Skyr nature', 'Produits laitiers et œufs', null, 63, 11, 4, 0.2, 450, '450 g', 1.99, null, null, false, false),
    ('fruits_rouges', 'Fruits rouges surgelés', 'Surgelés', '13136', 50, 1, 7, 0.5, 750, '750 g', 3.49, null, null, false, false),
    ('flocons', 'Flocons d’avoine', 'Épicerie', '32140', 369, 10.6, 57.7, 7.8, 1000, '1 kg', 1.79, null, null, true, false),
    ('miel', 'Miel', 'Épicerie', '31008', 331, 0.7, 82.1, 0, 500, '500 g', 4.29, null, null, false, false),
    ('maquee', 'Maquée (fromage blanc 0 %)', 'Produits laitiers et œufs', '19644', 48, 7.3, 4.2, 0, 1000, '1 kg', 2.29, null, null, false, false),
    ('banane', 'Bananes', 'Fruits et légumes', '13005', 88, 1.1, 19.7, 0, 1000, '1 kg', 1.69, 120, 'banane', false, false),
    ('cacahuete', 'Beurre de cacahuète', 'Épicerie', '15202', 643, 22.2, 17.3, 51.4, 350, '350 g', 2.49, null, null, false, false),
    ('lait', 'Lait demi-écrémé', 'Produits laitiers et œufs', '19041', 48, 3.5, 5, 1.6, 1000, '1 L', 0.99, null, null, false, false),
    ('proteine', 'Protéine en poudre (XXL Perfect Milk Protein)', 'Épicerie', null, 349, 78, 7.4, 1.3, 1000, '1 kg', 29.99, 30, 'dose', false, true),
    ('pain_complet', 'Pain complet tranché', 'Boulangerie', '7110', 234, 8.7, 41.2, 1.7, 800, '800 g', 1.99, 35, 'tranche', true, false),
    ('jambon', 'Jambon cuit', 'Viande et charcuterie', '28900', 113, 21, 0.8, 2.8, 300, '300 g', 2.99, 40, 'tranche', false, false),
    ('gouda', 'Gouda en tranches', 'Produits laitiers et œufs', '12736', 369, 24.7, 0, 30.2, 400, '400 g', 3.99, 25, 'tranche', false, false),
    ('oeuf', 'Œufs', 'Produits laitiers et œufs', '22000', 140, 12.8, 0.1, 9.8, 600, 'boîte de 12', 3.29, 50, 'œuf', false, false),
    ('pomme', 'Pommes', 'Fruits et légumes', '13039', 54, 0.2, 11.6, 0.2, 1500, '1,5 kg', 2.49, 150, 'pomme', false, false);

  create temp table _rec (name text, category text, servings int, prep_min int, batch boolean, steps text) on commit drop;
  insert into _rec values
    ('Bol skyr, fruits rouges et avoine', 'collation', 1, 3, false, 'Verser le skyr dans un bol.
Ajouter les fruits rouges (sortis du congélateur la veille, ou 1 min au micro-ondes), les flocons et le miel.'),
    ('Maquée, banane et cacahuète', 'collation', 1, 3, false, 'Verser la maquée dans un bol.
Couper la banane en rondelles par-dessus et ajouter le beurre de cacahuète (1 c. à soupe bombée).'),
    ('Shake protéiné et banane', 'collation', 1, 2, false, 'Mettre le lait puis la dose de protéine dans un shaker, secouer 20 s.
Manger la banane à côté (ou tout mixer ensemble si tu as un mixeur).'),
    ('Tartines jambon-gouda', 'collation', 1, 3, false, 'Garnir 2 tranches de pain complet avec le jambon et la tranche de gouda.
Option : 2 min au four ou à l''airfryer pour faire fondre le fromage.'),
    ('Œufs durs et pomme', 'collation', 1, 12, false, 'Cuire 6 œufs d''un coup : 10 min dans l''eau bouillante, puis eau froide.
Ils se gardent 5 jours au frigo dans leur coquille : 3 œufs + 1 pomme par collation, une pincée de sel.');

  create temp table _line (recipe text, ord int, key text, grams numeric) on commit drop;
  insert into _line values
    ('Bol skyr, fruits rouges et avoine', 1, 'skyr', 250),
    ('Bol skyr, fruits rouges et avoine', 2, 'fruits_rouges', 100),
    ('Bol skyr, fruits rouges et avoine', 3, 'flocons', 30),
    ('Bol skyr, fruits rouges et avoine', 4, 'miel', 10),
    ('Maquée, banane et cacahuète', 1, 'maquee', 250),
    ('Maquée, banane et cacahuète', 2, 'banane', 120),
    ('Maquée, banane et cacahuète', 3, 'cacahuete', 15),
    ('Shake protéiné et banane', 1, 'lait', 300),
    ('Shake protéiné et banane', 2, 'proteine', 30),
    ('Shake protéiné et banane', 3, 'banane', 120),
    ('Tartines jambon-gouda', 1, 'pain_complet', 70),
    ('Tartines jambon-gouda', 2, 'jambon', 80),
    ('Tartines jambon-gouda', 3, 'gouda', 25),
    ('Œufs durs et pomme', 1, 'oeuf', 150),
    ('Œufs durs et pomme', 2, 'pomme', 150);

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
