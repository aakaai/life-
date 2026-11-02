// Recherche dans la table Ciqual (chargée à la demande, puis gardée en mémoire).
import { norm, guessPortions } from './data.js'

let cache = null

export async function loadCiqual() {
  if (!cache) {
    const mod = await import('./ciqual-data.js')
    cache = mod.default.map((r) => ({ r, n: norm(r[1]) }))
  }
  return cache
}

export function ciqualItem(r) {
  return {
    ref: `ciqual:${r[0]}`,
    source: 'ciqual',
    code: r[0],
    name: r[1],
    kcal: r[2],
    protein: r[3],
    carbs: r[4],
    fat: r[5],
    fiber: r[6],
    fish: r[7] === 1,
    portions: guessPortions(r[1])
  }
}

export function findCiqual(list, code) {
  const hit = list.find((x) => x.r[0] === code)
  return hit ? ciqualItem(hit.r) : null
}

// Découpe la recherche en mots ; « oeufs » trouve aussi « oeuf ».
export function tokens(q) {
  return norm(q)
    .split(/[\s,'’()/-]+/)
    .filter((t) => t.length > 0)
    .map((t) => (t.length > 3 ? t.replace(/(s|x)$/, '') : t))
}

// Score d'un nom pour une recherche : début du nom > début d'un mot > ailleurs ; noms courts d'abord.
export function scoreName(n, toks) {
  let score = 0
  for (const t of toks) {
    const i = n.indexOf(t)
    if (i === -1) return -1
    if (i === 0) score += 20
    else if (/[\s,'(-]/.test(n[i - 1])) score += 8
    else score += 2
  }
  return score - n.length / 25
}

export function searchCiqual(list, q, { limit = 40, excludeFish = false } = {}) {
  const toks = tokens(q)
  if (!toks.length) return []
  const out = []
  for (const x of list) {
    const s = scoreName(x.n, toks)
    if (s < 0) continue
    const item = ciqualItem(x.r)
    // les aliments exclus restent trouvables, mais passent en dernier
    out.push({ item, s: s - (excludeFish && item.fish ? 100 : 0) })
  }
  return out
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item)
}
