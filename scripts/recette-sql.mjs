// Génère un script SQL qui ajoute des recettes (et les ingrédients qui manquent) dans Supabase.
// Usage : node scripts/recette-sql.mjs scripts/recettes/010_collations.json > supabase/migrations/010_recettes_collations.sql
//
// Fichier JSON :
// {
//   "titre": "…",
//   "ingredients": [ { "key", "name", "nutrition": "code Ciqual" | [kcal, prot, gluc, lip], "rayon",
//                      "pack": [g, "libellé", prix], "unit": [g, "nom"], "scalable", "pantry" } ],
//   "recipes": [ { "name", "category", "servings", "prep_min", "batch", "steps": ["…"], "lines": [["clé", grammes]] } ]
// }
// Les ingrédients de base (src/modules/alimentation/seed.js) sont connus d'office : on peut les citer par leur clé.
// Les valeurs par portion sont affichées sur la sortie d'erreur pour vérification.
import fs from 'fs'
import { SEED_INGREDIENTS } from '../src/modules/alimentation/seed.js'
import ciqual from '../src/modules/alimentation/ciqual-data.js'

const file = process.argv[2]
if (!file) throw new Error('Donne le fichier JSON des recettes')
const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
spec.recipes = spec.recipes || []

const byCode = Object.fromEntries(ciqual.map((r) => [r[0], r]))
function resolve(i) {
  let n = i.nutrition
  let code = null
  if (typeof n === 'string') {
    code = n
    const r = byCode[n]
    if (!r) throw new Error(`Code Ciqual inconnu : ${n} (${i.name})`)
    n = [r[2], r[3], r[4], r[5]]
  }
  return { ...i, code, kcal: n[0], protein: n[1], carbs: n[2], fat: n[3] }
}

const known = new Map()
for (const s of SEED_INGREDIENTS) known.set(s.key, resolve(s))
for (const s of spec.ingredients || []) known.set(s.key, resolve(s))

const q = (v) => (v == null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const b = (v) => (v ? 'true' : 'false')

// Ingrédients des recettes + ingrédients ajoutés seuls (déclarés dans « ingredients »)
const used = new Set([...spec.recipes.flatMap((r) => r.lines.map(([k]) => k)), ...(spec.ingredients || []).map((i) => i.key)])
for (const k of used) if (!known.has(k)) throw new Error(`Ingrédient inconnu : ${k}`)

const ingRows = [...used].map((k) => {
  const i = known.get(k)
  return `    (${[q(i.key), q(i.name), q(i.rayon), q(i.code), i.kcal, i.protein, i.carbs, i.fat,
    q(i.pack?.[0]), q(i.pack?.[1]), q(i.pack?.[2]), q(i.unit?.[0]), q(i.unit?.[1]), b(i.scalable), b(i.pantry)].join(', ')})`
})

const recRows = spec.recipes.map((r) =>
  `    (${[q(r.name), q(r.category), r.servings || 1, q(r.prep_min), b(r.batch), q((r.steps || []).join('\n'))].join(', ')})`)
const lineRows = spec.recipes.flatMap((r) => r.lines.map(([k, g], i) => `    (${q(r.name)}, ${i + 1}, ${q(k)}, ${g})`))

// Résumé par portion (valeurs de base, avant les modifications que tu as pu faire dans l'app)
for (const r of spec.recipes) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, cost: 0 }
  for (const [k, g] of r.lines) {
    const i = known.get(k)
    t.kcal += (i.kcal * g) / 100; t.p += (i.protein * g) / 100; t.c += (i.carbs * g) / 100; t.f += (i.fat * g) / 100
    if (i.pack) t.cost += (i.pack[2] / i.pack[0]) * g
  }
  const s = r.servings || 1
  console.error(`${r.name} — par portion : ${Math.round(t.kcal / s)} kcal, ${(t.p / s).toFixed(1)} g P, ${(t.c / s).toFixed(1)} g G, ${(t.f / s).toFixed(1)} g L, ${(t.cost / s).toFixed(2)} €`)
}

const sql = `-- ${spec.titre || 'Recettes'} (généré par scripts/recette-sql.mjs depuis ${file.replace(/^.*scripts\//, 'scripts/')}).
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
${ingRows.join(',\n')};

  create temp table _rec (name text, category text, servings int, prep_min int, batch boolean, steps text) on commit drop;
  insert into _rec values
${recRows.join(',\n')};

  create temp table _line (recipe text, ord int, key text, grams numeric) on commit drop;
  insert into _line values
${lineRows.join(',\n')};

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
`
process.stdout.write(sql)
