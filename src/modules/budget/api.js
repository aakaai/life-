// Données du module Budget (via la couche commune `store`).
import { store } from '../../lib/store'
import { DEFAULT_CATEGORIES, duePostings, round2 } from './logic'
import { balances, initialMovesFor, MAIN_KEY } from './accounts'
import { keyOf } from '../sport/planner'

export const BUDGET_TABLES = ['budget_categories', 'budget_transactions', 'subscriptions', 'recurring_incomes', 'savings_goals', 'savings_moves']

export const listCategories = () => store.list('budget_categories', { orderBy: 'sort' })
export const listTransactions = () => store.list('budget_transactions', { orderBy: 'date', ascending: false })
export const listSubscriptions = () => store.list('subscriptions', { orderBy: 'next_date' })
export const listIncomes = () => store.list('recurring_incomes', { orderBy: 'next_date' })
export const listGoals = () => store.list('savings_goals', { orderBy: 'created_at' })

// Premier lancement : crée les catégories avec les montants choisis.
export async function createCategories(rows) {
  return store.insertMany('budget_categories', rows.map((r, i) => ({
    name: r.name, emoji: r.emoji, color: r.color, kind: r.kind || 'normal', sort: i, archived: false,
    monthly_budget: r.monthly_budget === '' || r.monthly_budget == null ? null : round2(r.monthly_budget)
  })))
}
export { DEFAULT_CATEGORIES }

export function saveCategory(c) {
  const row = {
    name: c.name.trim(), emoji: c.emoji || null, color: c.color || 'gray', kind: c.kind || 'normal',
    monthly_budget: c.monthly_budget === '' || c.monthly_budget == null ? null : round2(c.monthly_budget),
    sort: c.sort ?? 99, archived: !!c.archived
  }
  return c.id ? store.update('budget_categories', c.id, row) : store.insert('budget_categories', row)
}

// Nouvel ordre des cases (seules les cases visibles bougent ; les autres gardent leur place).
export async function saveCategoryOrder(visibleIds, categories) {
  const active = categories.filter((c) => !c.archived).map((c) => c.id)
  const moved = new Set(visibleIds)
  let k = 0
  const final = [...active.map((id) => (moved.has(id) ? visibleIds[k++] : id)), ...categories.filter((c) => c.archived).map((c) => c.id)]
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]))
  for (const [i, id] of final.entries()) if (Number(byId[id].sort) !== i) await store.update('budget_categories', id, { sort: i })
}

export async function saveTransaction(t) {
  const row = {
    kind: t.kind, amount: round2(t.amount), category_id: t.kind === 'income' ? null : t.category_id || null,
    date: t.date, merchant: t.merchant?.trim() || null, note: t.note?.trim() || null,
    origin: t.origin || 'manual', origin_id: t.origin_id || null
  }
  // « payé avec » un compte (018_comptes.sql) : on n'écrit la colonne que si elle sert ou existe déjà
  const account = t.kind === 'income' ? null : t.account_id || null
  if (account || 'account_id' in t) row.account_id = account
  const saved = t.id ? await store.update('budget_transactions', t.id, row) : await store.insert('budget_transactions', row)
  const touched = [account, t.previousAccount].filter(Boolean)
  if (touched.length) await syncSaved(touched)
  return saved
}
export async function removeTransaction(id, accountId = null) {
  await store.remove('budget_transactions', id)
  if (accountId) await syncSaved([accountId])
}

export function saveSubscription(s) {
  const row = { name: s.name.trim(), amount: round2(s.amount), period: s.period, next_date: s.next_date, active: s.active !== false }
  return s.id ? store.update('subscriptions', s.id, row) : store.insert('subscriptions', row)
}
export const removeSubscription = (id) => store.remove('subscriptions', id)

export function saveIncome(r) {
  const row = { name: r.name.trim(), amount: round2(r.amount), next_date: r.next_date, active: r.active !== false }
  return r.id ? store.update('recurring_incomes', r.id, row) : store.insert('recurring_incomes', row)
}
export const removeIncome = (id) => store.remove('recurring_incomes', id)

/* ---------- Comptes d'épargne (v0.27, 018_comptes.sql) ---------- */
// Un compte = une ligne de savings_goals ; `saved` garde une copie du solde (calculé depuis les mouvements).

export async function listMoves() {
  try {
    return { moves: await store.list('savings_moves', { orderBy: 'date' }), movesMissing: false }
  } catch {
    return { moves: [], movesMissing: true }
  }
}

// Recalcule la copie du solde des comptes touchés.
export async function syncSaved(ids) {
  const [accounts, { moves }, txs] = await Promise.all([store.list('savings_goals'), listMoves(), store.list('budget_transactions')])
  const bal = balances(accounts, moves, txs)
  for (const id of new Set(ids)) {
    const a = accounts.find((x) => x.id === id)
    if (a && round2(a.saved) !== bal[id]) await store.update('savings_goals', id, { saved: bal[id] })
  }
}

export async function saveAccount(a, { initial = 0, date } = {}) {
  const target = a.target === '' || a.target == null ? null : round2(a.target)
  const row = { name: a.name.trim(), emoji: a.emoji || null, target, deadline: target ? a.deadline || null : null, done: false }
  if (a.id) return store.update('savings_goals', a.id, row)
  const created = await store.insert('savings_goals', { ...row, saved: round2(initial) })
  if (initial > 0) await store.insert('savings_moves', { account_id: created.id, date, amount: round2(initial), kind: 'initial', note: null })
  return created
}

// Supprime le compte et ses mouvements ; les dépenses payées avec repassent dans le budget de leur mois.
export async function removeAccount(id) {
  const { moves } = await listMoves()
  const peers = new Set()
  for (const m of moves) {
    if (m.account_id === id) await store.remove('savings_moves', m.id)
    else if (m.peer_id === id) {
      peers.add(m.account_id)
      await store.update('savings_moves', m.id, { peer_id: null })
    }
  }
  for (const t of await store.list('budget_transactions', { where: { account_id: id } }).catch(() => [])) {
    await store.update('budget_transactions', t.id, { account_id: null })
  }
  await store.remove('savings_goals', id)
  if (peers.size) await syncSaved([...peers])
}

// Mettre de côté (montant > 0) ou retirer (montant < 0).
export async function addMove({ account_id, amount, date, note = null }) {
  const row = await store.insert('savings_moves', { account_id, date, amount: round2(amount), kind: amount >= 0 ? 'deposit' : 'withdraw', note: note?.trim() || null })
  await syncSaved([account_id])
  return row
}

export async function transfer({ from, to, amount, date, note = null }) {
  const transfer_id = crypto.randomUUID()
  const a = round2(Math.abs(amount))
  const n = note?.trim() || null
  await store.insertMany('savings_moves', [
    { account_id: from, peer_id: to, transfer_id, date, amount: -a, kind: 'transfer', note: n },
    { account_id: to, peer_id: from, transfer_id, date, amount: a, kind: 'transfer', note: n }
  ])
  await syncSaved([from, to])
}

// Répartir l'argent libre d'Épargne entre plusieurs sous-comptes (un virement par sous-compte).
export async function distribute({ from, parts, date }) {
  const rows = []
  for (const { to, amount } of parts) {
    const a = round2(Math.abs(amount))
    if (!a) continue
    const transfer_id = crypto.randomUUID()
    rows.push(
      { account_id: from, peer_id: to, transfer_id, date, amount: -a, kind: 'transfer', note: null },
      { account_id: to, peer_id: from, transfer_id, date, amount: a, kind: 'transfer', note: null }
    )
  }
  if (!rows.length) return
  await store.insertMany('savings_moves', rows)
  await syncSaved([from, ...parts.map((p) => p.to)])
}

// Corriger un mouvement (un virement : les deux moitiés).
export async function updateMove(move, { amount, date, note }) {
  const n = note?.trim() || null
  if (move.kind === 'transfer' && move.transfer_id) {
    const { moves } = await listMoves()
    const pair = moves.filter((m) => m.transfer_id === move.transfer_id)
    for (const m of pair) await store.update('savings_moves', m.id, { amount: Math.sign(Number(m.amount)) * round2(Math.abs(amount)), date, note: n })
    return syncSaved(pair.map((m) => m.account_id))
  }
  const sign = move.kind === 'withdraw' ? -1 : 1
  await store.update('savings_moves', move.id, { amount: sign * round2(Math.abs(amount)), date, note: n })
  return syncSaved([move.account_id])
}

export async function removeMove(move) {
  if (move.kind === 'transfer' && move.transfer_id) {
    const { moves } = await listMoves()
    const pair = moves.filter((m) => m.transfer_id === move.transfer_id)
    for (const m of pair) await store.remove('savings_moves', m.id)
    return syncSaved(pair.map((m) => m.account_id))
  }
  await store.remove('savings_moves', move.id)
  return syncSaved([move.account_id])
}

// Ajoute les prélèvements d'abonnements et les revenus réguliers arrivés à échéance.
let posting = null
export function postDue(today = keyOf(new Date())) {
  posting ||= (async () => {
    const [cats, subs, incomes] = await Promise.all([listCategories(), listSubscriptions(), listIncomes()])
    const subsCat = cats.find((c) => c.kind === 'subscriptions' && !c.archived)
    const { txs, updates } = duePostings({ subscriptions: subs, incomes, today, subsCategoryId: subsCat?.id || null })
    for (const u of updates) await store.update(u.table, u.id, { next_date: u.next_date })
    if (txs.length) await store.insertMany('budget_transactions', txs)
    return txs.length
  })().finally(() => setTimeout(() => (posting = null), 0))
  return posting
}

export async function loadBudget(today = keyOf(new Date())) {
  await postDue(today).catch(() => 0)
  let [categories, txs, subscriptions, incomes, accounts, movesRes] = await Promise.all([
    listCategories(), listTransactions(), listSubscriptions(), listIncomes(), listGoals(), listMoves()
  ])
  let { moves, movesMissing } = movesRes
  // anciens objectifs : « déjà mis de côté » devient un solde de départ (le script 018 le fait aussi dans Supabase)
  const initial = movesMissing ? [] : initialMovesFor(accounts, moves).map((m) => ({ ...m, date: m.date || today }))
  if (initial.length) {
    await store.insertMany('savings_moves', initial).catch(() => {})
    moves = (await listMoves()).moves
  }
  // le gros compte « Épargne » (v0.29) : créé une fois, à 0 € ; tes comptes existants deviennent ses sous-comptes
  if (!movesMissing && !accounts.some((a) => a.emoji === MAIN_KEY)) {
    try {
      const main = await store.insert('savings_goals', { name: 'Épargne', emoji: MAIN_KEY, target: null, deadline: null, saved: 0, done: false })
      accounts = [main, ...accounts]
    } catch {
      /* réessayé au prochain chargement */
    }
  }
  return { categories, txs, subscriptions, incomes, accounts, moves, movesMissing, today }
}
