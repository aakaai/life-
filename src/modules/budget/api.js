// Données du module Budget (via la couche commune `store`).
import { store } from '../../lib/store'
import { DEFAULT_CATEGORIES, duePostings, round2 } from './logic'
import { keyOf } from '../sport/planner'

export const BUDGET_TABLES = ['budget_categories', 'budget_transactions', 'subscriptions', 'recurring_incomes', 'savings_goals']

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

export function saveTransaction(t) {
  const row = {
    kind: t.kind, amount: round2(t.amount), category_id: t.kind === 'income' ? null : t.category_id || null,
    date: t.date, merchant: t.merchant?.trim() || null, note: t.note?.trim() || null,
    origin: t.origin || 'manual', origin_id: t.origin_id || null
  }
  return t.id ? store.update('budget_transactions', t.id, row) : store.insert('budget_transactions', row)
}
export const removeTransaction = (id) => store.remove('budget_transactions', id)

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

export function saveGoal(g) {
  const row = { name: g.name.trim(), emoji: g.emoji || null, target: round2(g.target), saved: round2(g.saved || 0), deadline: g.deadline || null, done: !!g.done }
  return g.id ? store.update('savings_goals', g.id, row) : store.insert('savings_goals', row)
}
export const removeGoal = (id) => store.remove('savings_goals', id)

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
  const [categories, txs, subscriptions, incomes, goals] = await Promise.all([
    listCategories(), listTransactions(), listSubscriptions(), listIncomes(), listGoals()
  ])
  return { categories, txs, subscriptions, incomes, goals, today }
}
