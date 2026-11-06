// Calculs du module Budget. Fonctions pures (testées dans tests/budget.test.mjs).
import { parseDay, keyOf } from '../sport/planner.js'

export const DEFAULT_CATEGORIES = [
  { name: 'Courses', emoji: 'courses', color: 'green', monthly_budget: 220 },
  { name: 'Repas dehors', emoji: 'resto', color: 'orange', monthly_budget: null },
  { name: 'Logement', emoji: 'logement', color: 'brown', monthly_budget: null },
  { name: 'Transport', emoji: 'transport', color: 'blue', monthly_budget: null },
  { name: 'Sport', emoji: 'sport', color: 'red', monthly_budget: null },
  { name: 'École', emoji: 'ecole', color: 'purple', monthly_budget: null },
  { name: 'Sorties', emoji: 'sorties', color: 'pink', monthly_budget: null },
  { name: 'Abonnements', emoji: 'abos', color: 'yellow', monthly_budget: null, kind: 'subscriptions' },
  { name: 'Voyages', emoji: 'voyages', color: 'blue', monthly_budget: null },
  { name: 'Divers', emoji: 'divers', color: 'gray', monthly_budget: null }
]

export const INCOME_SOURCES = ['Job étudiant', 'Parents', 'Remboursement', 'Autre']
export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100
export const parseAmount = (s) => round2(String(s ?? '').replace(/\s/g, '').replace(',', '.'))

export const monthKey = (dateKey) => dateKey.slice(0, 7) // AAAA-MM
export const monthStart = (mk) => `${mk}-01`
export function monthEnd(mk) {
  const [y, m] = mk.split('-').map(Number)
  return keyOf(new Date(y, m, 0))
}
export function shiftMonth(mk, n) {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Date suivante d'un abonnement (même jour du mois ; 31 → dernier jour du mois).
export function nextDate(key, period, anchorDay = parseDay(key).getDate()) {
  const d = parseDay(key)
  if (period === 'weekly') {
    d.setDate(d.getDate() + 7)
    return keyOf(d)
  }
  const add = period === 'yearly' ? 12 : 1
  const target = new Date(d.getFullYear(), d.getMonth() + add, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(anchorDay, last))
  return keyOf(target)
}

/**
 * Prélèvements et rentrées dus jusqu'à aujourd'hui (rattrapage si l'app n'a pas été ouverte).
 * @returns { txs: [opérations à créer], updates: [{ table, id, next_date }] }
 */
export function duePostings({ subscriptions = [], incomes = [], today, subsCategoryId = null, max = 60 }) {
  const txs = []
  const updates = []
  for (const s of subscriptions.filter((x) => x.active)) {
    let d = s.next_date
    const anchor = parseDay(s.next_date).getDate()
    let n = 0
    while (d <= today && n++ < max) {
      txs.push({ kind: 'expense', amount: round2(s.amount), category_id: subsCategoryId, date: d, merchant: s.name, note: null, origin: 'subscription', origin_id: s.id })
      d = nextDate(d, s.period, anchor)
    }
    if (d !== s.next_date) updates.push({ table: 'subscriptions', id: s.id, next_date: d })
  }
  for (const r of incomes.filter((x) => x.active)) {
    let d = r.next_date
    const anchor = parseDay(r.next_date).getDate()
    let n = 0
    while (d <= today && n++ < max) {
      txs.push({ kind: 'income', amount: round2(r.amount), category_id: null, date: d, merchant: r.name, note: null, origin: 'recurring', origin_id: r.id })
      d = nextDate(d, 'monthly', anchor)
    }
    if (d !== r.next_date) updates.push({ table: 'recurring_incomes', id: r.id, next_date: d })
  }
  return { txs, updates }
}

export const monthlyCost = (s) => round2(s.period === 'yearly' ? s.amount / 12 : s.period === 'weekly' ? (s.amount * 52) / 12 : s.amount)

/* ---------- Période : un mois ('2026-11') ou une année ('2026') (v0.28) ---------- */
export const periodOf = (mode, today) => ({ mode, key: mode === 'year' ? today.slice(0, 4) : monthKey(today) })
export const inPeriod = (p, date) => (p.mode === 'year' ? String(date).slice(0, 4) === p.key : monthKey(date) === p.key)
export const shiftPeriod = (p, n) => (p.mode === 'year' ? { ...p, key: String(Number(p.key) + n) } : { ...p, key: shiftMonth(p.key, n) })
export const isCurrentPeriod = (p, today) => inPeriod(p, today)
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
// « Novembre 2026 » / « 2026 »
export function periodLabel(p) {
  if (p.mode === 'year') return p.key
  const [y, m] = p.key.split('-').map(Number)
  return `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`
}
// « en novembre » (« en novembre 2025 » si ce n'est pas l'année en cours) / « en 2026 »
export function periodIn(p, today) {
  if (p.mode === 'year') return `en ${p.key}`
  const [y, m] = p.key.split('-').map(Number)
  return `en ${MONTHS[m - 1]}${String(y) === today.slice(0, 4) ? '' : ` ${y}`}`
}
// Ce qui reste de la période en cours : « 24 jours restants » / « 2 mois restants » (null si période passée ou future)
export function periodRemaining(p, today) {
  if (!inPeriod(p, today)) return null
  const [y, m, d] = today.split('-').map(Number)
  if (p.mode === 'year') {
    const n = 12 - m
    return n ? `${n} mois restant${n > 1 ? 's' : ''}` : 'dernier mois'
  }
  const n = new Date(y, m, 0).getDate() - d
  return n ? `${n} jour${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}` : 'dernier jour'
}

/**
 * Bilan d'une période : dépensé par catégorie, reste à dépenser, revenus, épargné, solde.
 * En année, le budget = budget mensuel × 12. Les dépenses payées avec un compte d'épargne (account_id)
 * ne comptent pas dans la période : elles sont listées à part.
 */
export function periodSummary({ txs, categories, subscriptions = [], period, moves = [] }) {
  const months = period.mode === 'year' ? 12 : 1
  const inP = txs.filter((t) => inPeriod(period, t.date))
  const spent = {}
  let expenses = 0
  let income = 0
  const fromAccounts = []
  for (const t of inP) {
    if (t.kind === 'income') income += Number(t.amount)
    else if (t.account_id) fromAccounts.push(t)
    else {
      expenses += Number(t.amount)
      const k = t.category_id || 'none'
      spent[k] = round2((spent[k] || 0) + Number(t.amount))
    }
  }
  const subsBudget = round2(subscriptions.filter((s) => s.active).reduce((t, s) => t + monthlyCost(s), 0) * months)
  const rows = categories
    .filter((c) => !c.archived)
    .map((c) => {
      const budget = c.kind === 'subscriptions' ? subsBudget || null : c.monthly_budget == null || c.monthly_budget === '' ? null : round2(Number(c.monthly_budget) * months)
      const s = spent[c.id] || 0
      const ratio = budget ? s / budget : null
      return { cat: c, budget, spent: s, left: budget != null ? round2(budget - s) : null, ratio, level: ratio == null ? 'none' : ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok' }
    })
  const budgeted = rows.filter((r) => r.budget != null)
  const totalBudget = round2(budgeted.reduce((t, r) => t + r.budget, 0))
  const totalSpentBudgeted = round2(budgeted.reduce((t, r) => t + r.spent, 0))
  // épargné = mis de côté − retiré sur la période (virements entre comptes et soldes de départ exclus)
  let saved = 0
  for (const m of moves) if (inPeriod(period, m.date) && (m.kind === 'deposit' || m.kind === 'withdraw')) saved += Number(m.amount) || 0
  return {
    rows,
    uncategorized: spent.none || 0,
    expenses: round2(expenses),
    income: round2(income),
    saved: round2(saved),
    balance: round2(income - expenses - saved),
    fromAccounts,
    fromAccountsTotal: round2(fromAccounts.reduce((t, x) => t + Number(x.amount), 0)),
    totalBudget,
    left: round2(totalBudget - totalSpentBudgeted),
    count: inP.length
  }
}

// Bilan d'un mois (ancienne API, gardée pour l'accueil et les tests)
export const monthSummary = ({ mk, ...rest }) => periodSummary({ ...rest, period: { mode: 'month', key: mk } })

// Catégorie devinée d'après les dépenses précédentes chez le même commerçant.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
export function guessCategory(txs, merchant) {
  const m = norm(merchant)
  if (!m) return null
  const hit = [...txs]
    .filter((t) => t.kind === 'expense' && t.category_id && norm(t.merchant) === m)
    .sort((a, b) => (a.date + (a.created_at || '') < b.date + (b.created_at || '') ? 1 : -1))[0]
  return hit ? hit.category_id : null
}

// Raccourcis : dépenses manuelles les plus fréquentes (même commerçant, même montant).
export function frequentShortcuts(txs, limit = 4) {
  const by = new Map()
  for (const t of txs.filter((x) => x.kind === 'expense' && x.origin === 'manual' && x.merchant)) {
    const k = `${norm(t.merchant)}|${round2(t.amount)}`
    const cur = by.get(k) || { merchant: t.merchant, amount: round2(t.amount), category_id: t.category_id, n: 0 }
    cur.n++
    by.set(k, cur)
  }
  return [...by.values()].filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, limit)
}

// Commerçants connus (pour l'autocomplétion).
export function knownMerchants(txs, kind = 'expense') {
  const count = new Map()
  for (const t of txs.filter((x) => x.kind === kind && x.merchant)) count.set(t.merchant, (count.get(t.merchant) || 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
}

// Objectif d'épargne : combien mettre de côté par semaine.
export function goalPlan(goal, today) {
  const left = Math.max(0, round2(goal.target - goal.saved))
  const ratio = goal.target ? Math.min(1, goal.saved / goal.target) : 0
  if (!goal.deadline) return { left, ratio, perWeek: null, weeks: null }
  const days = Math.round((parseDay(goal.deadline) - parseDay(today)) / 86400000)
  const weeks = Math.max(days / 7, 0)
  return { left, ratio, weeks: Math.ceil(weeks), perWeek: left === 0 ? 0 : weeks >= 1 ? Math.ceil(left / weeks) : left, late: days < 0 && left > 0 }
}

// Renouvellements dans les `days` prochains jours.
export function upcomingRenewals(subscriptions, today, days = 3) {
  const limit = keyOf(new Date(parseDay(today).getTime() + days * 86400000))
  return subscriptions
    .filter((s) => s.active && s.next_date > today && s.next_date <= limit)
    .sort((a, b) => (a.next_date < b.next_date ? -1 : 1))
}

export function toCsv(txs, catById, accById = {}) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ['Date', 'Type', 'Montant', 'Catégorie', 'Commerçant / source', 'Note', 'Origine', 'Payé avec']
  const lines = [...txs]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => [
      t.date, t.kind === 'income' ? 'Revenu' : 'Dépense', String(round2(t.amount)).replace('.', ','),
      catById[t.category_id]?.name || '', t.merchant || '', t.note || '',
      t.origin === 'subscription' ? 'Abonnement' : t.origin === 'recurring' ? 'Revenu régulier' : 'Saisie',
      t.account_id ? accById[t.account_id]?.name || 'Compte supprimé' : t.kind === 'income' ? '' : 'Budget du mois'
    ].map(esc).join(';'))
  return '﻿' + [head.join(';'), ...lines].join('\n')
}
