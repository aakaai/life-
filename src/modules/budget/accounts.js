// Comptes d'épargne (v0.27) : enveloppes où tu mets de l'argent de côté (Vacances, Vélo, Déco…).
// Un compte = une ligne de savings_goals (objectif facultatif) ; son solde = mouvements (savings_moves)
// − dépenses payées avec ce compte (budget_transactions.account_id).
// Fonctions pures, testées dans tests/comptes.test.mjs.
import { round2, monthKey, inPeriod } from './logic.js'
import { parseDay } from '../sport/planner.js'

export const MOVE_LABEL = { initial: 'Solde de départ', deposit: 'Mis de côté', withdraw: 'Retiré', transfer: 'Virement' }

/**
 * Tous les mouvements d'un compte, du plus récent au plus ancien.
 * @returns [{ key, date, amount (signé), type: 'move'|'spend', kind, label, note, move?, tx? }]
 */
export function accountEntries(accountId, moves = [], txs = [], accById = {}) {
  const out = []
  for (const m of moves.filter((x) => x.account_id === accountId)) {
    const amount = round2(m.amount)
    let label = MOVE_LABEL[m.kind] || 'Mouvement'
    if (m.kind === 'transfer') label = amount >= 0 ? `Viré depuis ${accById[m.peer_id]?.name || 'un compte supprimé'}` : `Viré vers ${accById[m.peer_id]?.name || 'un compte supprimé'}`
    out.push({ key: `m${m.id}`, date: m.date, amount, type: 'move', kind: m.kind, label, note: m.note || null, created_at: m.created_at || '', move: m })
  }
  for (const t of txs.filter((x) => x.account_id === accountId && x.kind !== 'income')) {
    out.push({ key: `t${t.id}`, date: t.date, amount: -round2(t.amount), type: 'spend', kind: 'spend', label: `${t.merchant || t.note || 'Dépense'} (dépense)`, note: t.merchant && t.note ? t.note : null, created_at: t.created_at || '', tx: t })
  }
  return out.sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1))
}

export const balanceOf = (entries) => round2(entries.reduce((s, e) => s + e.amount, 0))

// Solde de chaque compte : { id: solde }
export function balances(accounts, moves = [], txs = []) {
  const out = Object.fromEntries(accounts.map((a) => [a.id, 0]))
  for (const m of moves) if (m.account_id in out) out[m.account_id] += Number(m.amount) || 0
  for (const t of txs) if (t.account_id && t.account_id in out && t.kind !== 'income') out[t.account_id] -= Number(t.amount) || 0
  for (const k of Object.keys(out)) out[k] = round2(out[k])
  return out
}

/**
 * Épargné sur un mois : mis de côté − retiré (les virements entre comptes et les soldes de départ ne comptent pas,
 * les dépenses payées avec un compte non plus : elles ont leur propre liste).
 */
export function savedInMonth(moves, mk) {
  let saved = 0
  const by = {}
  for (const m of moves) {
    if (monthKey(m.date) !== mk || !['deposit', 'withdraw'].includes(m.kind)) continue
    saved += Number(m.amount) || 0
    by[m.account_id] = round2((by[m.account_id] || 0) + (Number(m.amount) || 0))
  }
  return { saved: round2(saved), byAccount: by }
}

// Ajouté sur une période (mois ou année) : même calcul que « Épargné », compte par compte.
export function savedInPeriod(moves, period) {
  let saved = 0
  const by = {}
  for (const m of moves) {
    if (!inPeriod(period, m.date) || !['deposit', 'withdraw'].includes(m.kind)) continue
    saved += Number(m.amount) || 0
    by[m.account_id] = round2((by[m.account_id] || 0) + (Number(m.amount) || 0))
  }
  return { saved: round2(saved), byAccount: by }
}

/**
 * Case « Total » : tous les mouvements de tous les comptes. Un virement entre deux comptes n'apparaît
 * qu'une fois (« Virement Vélo → Déco », montant 0 pour le total).
 */
export function totalEntries(accounts, moves = [], txs = []) {
  const accById = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const out = []
  for (const a of accounts) {
    for (const e of accountEntries(a.id, moves, txs, accById)) {
      if (e.kind === 'transfer') {
        if (e.amount > 0) continue // la moitié « reçue » : déjà représentée par la moitié « envoyée »
        out.push({ ...e, key: `x${e.move.transfer_id || e.move.id}`, amount: 0, shown: -e.amount, label: `Virement ${a.name} → ${accById[e.move.peer_id]?.name || 'compte supprimé'}`, account: a })
      } else out.push({ ...e, account: a })
    }
  }
  return out.sort((x, y) => (x.date === y.date ? (x.created_at < y.created_at ? 1 : -1) : x.date < y.date ? 1 : -1))
}

// Objectifs réunis : ce qui est déjà là (plafonné à chaque objectif) sur la somme des objectifs.
export function goalsProgress(accounts, bal) {
  let have = 0
  let target = 0
  for (const a of accounts) {
    const t = a.target == null || a.target === '' ? 0 : Number(a.target)
    if (!t) continue
    target += t
    have += Math.max(0, Math.min(t, bal[a.id] || 0))
  }
  return { have: round2(have), target: round2(target) }
}

// Courbe du solde : valeur en fin de chaque jour où il s'est passé quelque chose (ordre chronologique).
export function balanceSeries(entries) {
  const byDay = new Map()
  for (const e of [...entries].reverse()) byDay.set(e.date, round2((byDay.get(e.date) || 0) + e.amount))
  let run = 0
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, v]) => {
    run = round2(run + v)
    return { date, value: run }
  })
}

/**
 * Objectif facultatif : où en est le compte et combien mettre de côté par semaine.
 * @returns { hasGoal, ratio, left, perWeek, weeks, late, reached }
 */
export function accountPlan(account, balance, today) {
  const target = account.target == null || account.target === '' ? null : Number(account.target)
  if (!target) return { hasGoal: false, ratio: null, left: null, perWeek: null, weeks: null, late: false, reached: false }
  const left = Math.max(0, round2(target - balance))
  const ratio = Math.max(0, Math.min(1, balance / target))
  const reached = left === 0
  if (!account.deadline) return { hasGoal: true, ratio, left, perWeek: null, weeks: null, late: false, reached }
  const days = Math.round((parseDay(account.deadline) - parseDay(today)) / 86400000)
  const weeks = Math.max(days / 7, 0)
  return {
    hasGoal: true, ratio, left, reached,
    weeks: Math.ceil(weeks),
    perWeek: reached ? 0 : weeks >= 1 ? Math.ceil(left / weeks) : left,
    late: days < 0 && !reached
  }
}

// Anciens objectifs (v0.8 → v0.26) : ce qui était « déjà mis de côté » devient un solde de départ.
export function initialMovesFor(accounts, moves) {
  const has = new Set(moves.map((m) => m.account_id))
  return accounts
    .filter((a) => Number(a.saved) > 0 && !has.has(a.id))
    .map((a) => ({ account_id: a.id, date: (a.created_at || '').slice(0, 10) || null, amount: round2(a.saved), kind: 'initial', note: null }))
}

// Montant disponible pour payer `amount` avec un compte (en tenant compte de l'opération qu'on modifie).
export function availableFor(accountId, bal, editingTx = null) {
  const back = editingTx && editingTx.account_id === accountId ? Number(editingTx.amount) || 0 : 0
  return round2((bal[accountId] || 0) + back)
}
