// Réglages et repères du module Alimentation (voir le document « Alimentation — plan nutrition »).

export const MEALS = [
  { key: 0, name: 'Petit-déjeuner', short: 'Matin' },
  { key: 1, name: 'Midi', short: 'Midi' },
  { key: 2, name: 'Collation', short: 'Collation' },
  { key: 3, name: 'Soir', short: 'Soir' },
  { key: 4, name: 'Avant de dormir', short: 'Coucher' }
]

// Repas proposé selon l'heure, quand tu ajoutes un aliment depuis l'accueil.
export function mealForTime(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  if (h < 10.5) return 0
  if (h < 14.5) return 1
  if (h < 18) return 2
  if (h < 21.5) return 3
  return 4
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
  auto_portions: true
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
