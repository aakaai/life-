// Réglages et repères du module Alimentation (voir le document « Alimentation — plan nutrition »).

// Repas de la journée, dans l'ordre. La clé est celle enregistrée dans la base :
// la collation du matin (5) a été ajoutée après coup, d'où l'ordre 0, 5, 1, 2, 3, 4.
// Toujours passer par mealInfo / mealRank, jamais MEALS[clé].
export const MEALS = [
  { key: 0, name: 'Petit-déjeuner', short: 'Matin' },
  { key: 5, name: 'Collation du matin', short: 'Coll. matin', snack: true },
  { key: 1, name: 'Midi', short: 'Midi' },
  { key: 2, name: 'Collation de l’après-midi', short: 'Coll. aprèm', snack: true },
  { key: 3, name: 'Soir', short: 'Soir' },
  { key: 4, name: 'Avant de dormir', short: 'Coucher' }
]
export const mealInfo = (key) => MEALS.find((m) => m.key === Number(key)) || MEALS[0]
export const mealRank = (key) => MEALS.findIndex((m) => m.key === Number(key))

// Repas du moment selon l'heure (horaires d'Esteban, 4 nov.) : avant 10 h petit-déjeuner, 10–12 h collation,
// 12–14 h 30 midi, 14 h 30–18 h collation, 18–21 h 30 soir, ensuite avant de dormir.
export const MEAL_START = { 0: 0, 5: 10, 1: 12, 2: 14.5, 3: 18, 4: 21.5 }
export function mealForTime(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  if (h < 10) return 0
  if (h < 12) return 5
  if (h < 14.5) return 1
  if (h < 18) return 2
  if (h < 21.5) return 3
  return 4
}
// « + Collation » : collation du matin avant 14 h 30, de l'après-midi avant 18 h, sinon avant de dormir.
export function snackForTime(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  return h < 14.5 ? 5 : h < 18 ? 2 : 4
}
// « + Repas » : le repas principal le plus proche.
export function mainMealForTime(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  return h < 10.5 ? 0 : h < 16 ? 1 : 3
}
// Heure d'un ajout au journal (« 10:02 »)
export const logTime = (log) => {
  if (!log?.created_at) return ''
  const d = new Date(log.created_at)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const DEFAULT_SETTINGS = {
  age: 22,
  height_cm: 170,
  sex: 'm',
  start_weight_kg: 55,
  activity: 1.4, // vie d'étudiant, hors entraînement
  surplus_kcal: 300,
  protein_g: 110,
  fat_pct: 28,
  exclude_fish: true,
  veggies: '',
  weigh_day: 5, // samedi (0 = lundi)
  shop_days: [0, 3], // courses le lundi et le jeudi
  auto_portions: true,
  school_lunch_days: [1, 2],
  fridge_days: 3,
  proposed_weeks: [],
  reset_weeks: []
}

export const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

// Portions toutes prêtes, devinées à partir du nom de l'aliment.
const PORTION_RULES = [
  [/^(oeuf|œuf)\b(?!.*(blanc|jaune))/i, '1 œuf', 50],
  [/^pain\b|baguette|pain de mie/i, '1 tranche', 35],
  [/^banane, chair/i, '1 banane', 120],
  [/^pomme, /i, '1 pomme', 150],
  [/^poire, /i, '1 poire', 150],
  [/^orange, /i, '1 orange', 150],
  [/^kiwi/i, '1 kiwi', 75],
  [/skyr/i, '1 pot', 150],
  [/yaourt|yogourt/i, '1 pot', 125],
  [/fromage blanc|maquée/i, '1 bol', 250],
  [/flocons d'avoine/i, '1 bol', 80],
  [/^(riz|pâtes|spaghetti|macaroni|semoule|quinoa|boulgour).*(cru|sec)/i, '1 portion', 100],
  [/^lait\b/i, '1 verre', 250],
  [/beurre de cacahuète|pâte d'arachide/i, '1 c. à soupe', 15],
  [/^huile/i, '1 c. à soupe', 10],
  [/^beurre\b/i, '1 noisette', 10],
  [/^(emmental|gouda|edam|cheddar|comté|fromage)/i, '1 tranche', 25],
  [/^poulet, filet|blanc de poulet|filet de poulet/i, '1 filet', 120],
  [/^jambon/i, '1 tranche', 40],
  [/^confiture/i, '1 c. à soupe', 20],
  [/^miel/i, '1 c. à soupe', 20],
  [/^sucre\b/i, '1 morceau', 5],
  [/barre de céréales|barre céréalière/i, '1 barre', 25]
]

export function guessPortions(name) {
  for (const [re, label, g] of PORTION_RULES) if (re.test(name)) return [{ label, g }]
  return []
}

export const norm = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Valeurs pour une quantité donnée (les aliments sont décrits pour 100 g).
export function forGrams(item, grams) {
  const k = (Number(grams) || 0) / 100
  const r = (v) => Math.round((Number(v) || 0) * k * 10) / 10
  return { kcal: Math.round((Number(item.kcal) || 0) * k), protein: r(item.protein), carbs: r(item.carbs), fat: r(item.fat) }
}

export function sumLogs(logs) {
  return logs.reduce(
    (t, l) => ({
      kcal: t.kcal + (Number(l.kcal) || 0),
      protein: t.protein + (Number(l.protein) || 0),
      carbs: t.carbs + (Number(l.carbs) || 0),
      fat: t.fat + (Number(l.fat) || 0)
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
}
