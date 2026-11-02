// Recherche d'un produit emballé par son code-barres dans Open Food Facts (gratuit, sans clé).
// Chaque produit trouvé est ensuite enregistré dans ta base : on ne le cherche qu'une fois.

const FIELDS = 'code,product_name,product_name_fr,brands,nutriments,serving_quantity,serving_size'

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10)

export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`
  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('Open Food Facts ne répond pas. Vérifie ta connexion.')
  }
  if (res.status === 404) return { found: false }
  if (!res.ok) throw new Error(`Open Food Facts a répondu ${res.status}. Réessaie dans un instant.`)
  const data = await res.json()
  if (!data.product || data.status === 0) return { found: false }
  return { found: true, ...fromProduct(code, data.product) }
}

export function fromProduct(code, p) {
  const n = p.nutriments || {}
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null && n.energy_100g != null) kcal = Math.round(Number(n.energy_100g) / 4.184)
  const food = {
    source: 'off',
    code,
    name: (p.product_name_fr || p.product_name || '').trim(),
    brand: (p.brands || '').split(',')[0].trim() || null,
    kcal,
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
    fiber: num(n.fiber_100g),
    portion_label: p.serving_quantity ? `1 portion (${p.serving_size || `${p.serving_quantity} g`})` : null,
    portion_g: p.serving_quantity ? num(p.serving_quantity) : null
  }
  const complete = Boolean(food.name) && [food.kcal, food.protein, food.carbs, food.fat].every((v) => v != null)
  return { complete, food }
}
