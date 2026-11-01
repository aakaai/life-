// Couche de données unique pour toute l'app.
// Les modules n'appellent jamais Supabase directement : ils passent par `store`.
// Deux implémentations derrière la même interface :
//   - cloud : Supabase (synchronisé entre téléphone et ordi)
//   - local : localStorage (mode test, sans compte)
//
// Chaque ligne appartient à l'utilisateur connecté : côté Supabase, la colonne
// user_id est remplie automatiquement et protégée par les règles RLS (voir supabase/).

import { supabase, isCloud } from './supabase'

/* ---------- Mode local ---------- */

const KEY = (table) => `life:${table}`

function readTable(table) {
  try {
    return JSON.parse(localStorage.getItem(KEY(table))) || []
  } catch {
    return []
  }
}

function writeTable(table, rows) {
  localStorage.setItem(KEY(table), JSON.stringify(rows))
}

function sortRows(rows, orderBy, ascending) {
  if (!orderBy) return rows
  return [...rows].sort((a, b) => {
    const x = a[orderBy]
    const y = b[orderBy]
    if (x === y) return 0
    return (x > y ? 1 : -1) * (ascending ? 1 : -1)
  })
}

const local = {
  async list(table, { orderBy, ascending = true, where = {} } = {}) {
    const rows = readTable(table).filter((r) =>
      Object.entries(where).every(([k, v]) => r[k] === v)
    )
    return sortRows(rows, orderBy, ascending)
  },
  async get(table, id) {
    return readTable(table).find((r) => r.id === id) || null
  },
  async insert(table, row) {
    const now = new Date().toISOString()
    const created = { id: crypto.randomUUID(), created_at: now, ...row }
    writeTable(table, [...readTable(table), created])
    return created
  },
  async update(table, id, patch) {
    let updated = null
    writeTable(
      table,
      readTable(table).map((r) => (r.id === id ? (updated = { ...r, ...patch }) : r))
    )
    return updated
  },
  async upsert(table, row) {
    const rows = readTable(table)
    const exists = rows.some((r) => r.id === row.id)
    if (exists) return local.update(table, row.id, row)
    return local.insert(table, row)
  },
  async remove(table, id) {
    writeTable(table, readTable(table).filter((r) => r.id !== id))
  }
}

/* ---------- Mode cloud (Supabase) ---------- */

function check({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

const cloud = {
  async list(table, { orderBy, ascending = true, where = {} } = {}) {
    let q = supabase.from(table).select('*').match(where)
    if (orderBy) q = q.order(orderBy, { ascending })
    return check(await q)
  },
  async get(table, id) {
    return check(await supabase.from(table).select('*').eq('id', id).maybeSingle())
  },
  async insert(table, row) {
    return check(await supabase.from(table).insert(row).select().single())
  },
  async update(table, id, patch) {
    return check(await supabase.from(table).update(patch).eq('id', id).select().single())
  },
  async upsert(table, row) {
    return check(await supabase.from(table).upsert(row).select().single())
  },
  async remove(table, id) {
    check(await supabase.from(table).delete().eq('id', id))
  }
}

export const store = isCloud ? cloud : local
export const storageMode = isCloud ? 'cloud' : 'local'

// L'id de l'utilisateur courant (sert de clé pour la table profiles).
export async function currentUserId() {
  if (!isCloud) return 'local'
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
