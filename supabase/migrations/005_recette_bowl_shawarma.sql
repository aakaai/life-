-- Recette : Bowl poulet shawarma (d'après fit_foodie_lulu, adaptée le 2 nov. 2026).
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Sans danger si tu le relances :
-- les ingrédients déjà présents ne sont pas recréés et la recette est mise à jour.
--
-- Adaptations : grammes au lieu des cups ; mélange d'épices shawarma tout prêt au lieu de 8 épices ;
-- skyr au lieu du yaourt grec ; plus de tahin, sumac, pignons ni oignon rouge (achats en plus pour
-- presque rien) ; salade réduite à tomates cerises + cornichons ; version boîtes pour le batch cooking.
-- Valeurs : table Ciqual 2025 (code indiqué), sinon étiquette. Prix : estimations Colruyt, modifiables.

do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
  rid uuid;
  rlines jsonb;
  tg numeric; tk numeric; tp numeric; tc numeric; tf numeric;
  rsteps text := concat_ws(E'\n',
    'Marinade (la veille au soir ou 30 min avant) : mélanger le poulet avec 15 g de jus de citron, les épices shawarma, 5 g d''huile et une pincée de sel. Au frigo au moins 30 min.',
    'Riz : faire revenir l''oignon haché dans 5 g d''huile 3-4 min, ajouter 3 gousses d''ail et le curry. Ajouter le riz rincé, remuer 2 min, puis 500 ml d''eau et le cube de bouillon. Porter à ébullition, couvrir et cuire 12-15 min à feu doux. Laisser reposer 5 min couvert.',
    'Poulet : poêle bien chaude, 5-6 min par face, en 2 fois pour qu''il dore (ou airfryer 195 °C, 16-17 min, retourner à 10 min). Laisser reposer 5 min puis couper en lamelles.',
    'Sauce : mélanger le skyr, la mayo allégée, 2 gousses d''ail râpées, 15 g de jus de citron, une pincée de sel et 1-2 c. à soupe d''eau. Si tu as du tahin : 1 c. à soupe en plus.',
    'Salade (le jour même) : tomates cerises coupées en deux, cornichons en rondelles, 15 g de jus de citron, sel et une pincée de paprika (à la place du sumac). Persil si tu en as.',
    'Boîtes : riz + poulet dans les boîtes, sauce dans un petit pot à part. Se garde 3 jours au frigo. Réchauffer riz + poulet 2 min au micro-ondes ; sauce et salade froides.'
  );
begin
  if uid is null then
    raise exception 'Aucun compte trouvé dans auth.users';
  end if;

  create temp table _r (
    ord int, key text, name text, rayon text, ciqual_code text,
    kcal numeric, protein numeric, carbs numeric, fat numeric,
    pack_g numeric, pack_label text, pack_price numeric,
    unit_g numeric, unit_name text, scalable boolean, pantry boolean,
    grams numeric
  ) on commit drop;

  insert into _r values
    ( 1, 'poulet_cuisse',   'Hauts de cuisse de poulet sans peau', 'Viande et charcuterie',     '36019', 116, 19.7, 0,    4.1,  600,  '600 g',      6.49, null, null,    false, false, 600),
    ( 2, 'citron',          'Jus de citron (bouteille)',           'Épicerie',                  '2028',   29,  0.4, 6.1,  0.3,  250,  '25 cl',      1.29, null, null,    false, true,   45),
    ( 3, 'epices_shawarma', 'Épices shawarma (mélange)',           'Épicerie',                  null,    300, 14,   40,   10,    90,  '90 g',       1.99, null, null,    false, true,   12),
    ( 4, 'huile',           'Huile d’olive',                       'Épicerie',                  '17270', 899,  0.2, 0,   99.9, 1000,  '1 L',        8.99, null, null,    false, true,   10),
    ( 5, 'oignon',          'Oignons',                             'Fruits et légumes',         '20034',  39,  1.1, 6.2,  0.6, 1000,  '1 kg',       1.29, 150, 'oignon', false, false, 100),
    ( 6, 'ail',             'Ail',                                 'Fruits et légumes',         '11000', 109,  5.3, 18.6, 0,    250,  '1 filet',    1.49,   5, 'gousse', false, true,   25),
    ( 7, 'curry',           'Curry en poudre',                     'Épicerie',                  '11005', 301, 14.5, 2.6,  14,    50,  '50 g',       1.49, null, null,    false, true,    2),
    ( 8, 'riz',             'Riz blanc',                           'Épicerie',                  '9100',  350,  7,   77.5, 0.8, 1000,  '1 kg',       1.69, null, null,    true,  false, 250),
    ( 9, 'bouillon',        'Bouillon de volaille',                'Épicerie',                  '11174', 193, 13,   17,   8,    100,  '10 cubes',   1.29,  10, 'cube',   false, true,   10),
    (10, 'skyr',            'Skyr nature',                         'Produits laitiers et œufs', null,     63, 11,   4,    0.2,  450,  '450 g',      1.99, null, null,    false, false, 200),
    (11, 'mayo_light',      'Mayonnaise allégée',                  'Conserves et sauces',       '11079', 297,  1.1, 8.8, 28.5,  460,  '50 cl',      1.99, null, null,    false, true,   40),
    (12, 'tomates_cerises', 'Tomates cerises',                     'Fruits et légumes',         '20172',  32,  1.3, 5.6,  0,    250,  '250 g',      1.59, null, null,    false, false, 250),
    (13, 'cornichons',      'Cornichons au vinaigre',              'Conserves et sauces',       '11004',  16,  1.1, 0.8,  0,    190,  '1 bocal',    1.39,  20, 'cornichon', false, true, 60);

  -- Ingrédients manquants (on reconnaît les tiens par la clé ou par le nom)
  insert into public.ingredients
    (user_id, key, name, rayon, ciqual_code, kcal, protein, carbs, fat, pack_g, pack_label, pack_price, unit_g, unit_name, scalable, pantry)
  select uid, r.key, r.name, r.rayon, r.ciqual_code, r.kcal, r.protein, r.carbs, r.fat,
         r.pack_g, r.pack_label, r.pack_price, r.unit_g, r.unit_name, r.scalable, r.pantry
  from _r r
  where not exists (
    select 1 from public.ingredients i
    where i.user_id = uid and (i.key = r.key or lower(i.name) = lower(r.name))
  );

  -- Lignes de la recette (4 portions) avec les ingrédients tels qu'ils sont dans ta base
  select jsonb_agg(jsonb_build_object('ingredient_id', i.id, 'grams', r.grams) order by r.ord),
         sum(r.grams),
         sum(i.kcal * r.grams / 100), sum(i.protein * r.grams / 100),
         sum(i.carbs * r.grams / 100), sum(i.fat * r.grams / 100)
  into rlines, tg, tk, tp, tc, tf
  from _r r
  cross join lateral (
    select * from public.ingredients i
    where i.user_id = uid and (i.key = r.key or lower(i.name) = lower(r.name))
    order by (i.key = r.key) desc nulls last, i.created_at
    limit 1
  ) i;

  select id into rid from public.recipes where user_id = uid and name = 'Bowl poulet shawarma' limit 1;
  if rid is null then
    insert into public.recipes (user_id, name) values (uid, 'Bowl poulet shawarma') returning id into rid;
  end if;

  update public.recipes set
    category = 'plat', servings = 4, prep_min = 45, batch = true,
    steps = rsteps, lines = rlines, items = '[]', cooked_measured = false,
    cooked_g = round(tg),
    kcal = round(tk / tg * 100),
    protein = round(tp / tg * 100, 1),
    carbs = round(tc / tg * 100, 1),
    fat = round(tf / tg * 100, 1)
  where id = rid;
end $$;
