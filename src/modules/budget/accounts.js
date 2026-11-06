// Comptes d'épargne (v0.27) : enveloppes où tu mets de l'argent de côté (Vacances, Vélo, Déco…).
// Un compte = une ligne de savings_goals (objectif facultatif) ; son solde = mouvements (savings_moves)
// − dépenses payées avec ce compte (budget_transactions.account_id).
// Fonctions pures, testées dans tests/comptes.test.mjs.
import { round2, monthKey, inPeriod } from './logic.js'
import { parseDay } from '../sport/planner.js'

export const MOVE_LABEL = { initial: 'Solde de départ', deposit: 'Mis de côté', withdraw: 'Retiré', transfer: 'Virement' }

/* ---------- Le gros compte « Épargne » (v0.29) ----------
   L'argent mis de côté arrive dans Épargne (une ligne de savings_goals marquée emoji = 'principal'),
   puis tu le répartis dans tes sous-comptes. Son solde = l'argent libre, pas encore réparti. */
export const MAIN_KEY = 'principal'
export const isMain = (a) => a?.emoji === MAIN_KEY
export function splitAccounts(accounts = []) {
  const mains = accounts.filter(isMain)
  return { main: mains[0] || null, envelopes: accounts.filter((a) => !isMain(a)) }
}

/**
 * Tous les mouvements d'un compte, du plus récent au plus ancien.
 * @returns [{ key, date, amount (signé), type: 'move'|'spend', kind, label, note, move?, tx? }]
 */
export function accountEntries(accountId, moves = [], txs = [], accById = {}) {
  const out = []
  for (const m of moves.filter((x) => x.account_id === accountId)) {
    const amount = round2(m.amount)
    let label = MOVE_LABEL[m.kind] || 'Mouvement'
    if (m.kind === 'transfer') {
      const peer = accById[m.peer_id]
      const self = accById[accountId]
      const name = peer?.name || 'un compte supprimé'
      if (isMain(self)) label = amount < 0 ? `Réparti vers ${name}` : `Rendu par ${name}`
      else if (isMain(peer)) label = amount >= 0 ? `Reçu d’${name}` : `Remis dans ${name}`
      else label = amount >= 0 ? `Viré depuis ${name}` : `Viré vers ${name}`
    }
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
        const peer = accById[e.move.peer_id]
        const label = isMain(a) ? `Réparti vers ${peer?.name || 'compte supprimé'}` : isMain(peer) ? `${a.name} remis dans ${peer.name}` : `Virement ${a.name} → ${peer?.name || 'compte supprimé'}`
        out.push({ ...e, key: `x${e.move.transfer_id || e.move.id}`, amount: 0, shown: -e.amount, label, account: a })
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

// Ce qu'un sous-compte a reçu sur la période (répartitions et virements reçus − rendus, versements − retraits).
export function receivedInPeriod(moves, period) {
  const by = {}
  for (const m of moves) {
    if (!inPeriod(period, m.date) || m.kind === 'initial') continue
    by[m.account_id] = round2((by[m.account_id] || 0) + (Number(m.amount) || 0))
  }
  return by
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
 * Mois pour atteindre l'objectif, mois en cours compris : du 6 nov. au 20 janv. → 3 (nov., déc., janv.) ;
 * du 6 nov. au 3 janv. → 2 (le 3 janvier arrive avant le « 6 » du mois).
 */
export function monthsLeft(today, deadline) {
  const [ty, tm, td] = today.split('-').map(Number)
  const [dy, dm, dd] = deadline.split('-').map(Number)
  return Math.max(1, (dy - ty) * 12 + (dm - tm) + (dd >= td ? 1 : 0))
}

/**
 * Objectif d'un compte (v0.29.1 : rythme par mois).
 * `monthIn` = ce que le compte a gagné ce mois-ci (mis de côté, réparti, virements, moins les dépenses payées avec lui ;
 * pas le solde de départ).
 * Le montant par mois est calculé depuis le solde du début du mois : il ne baisse pas quand tu mets
 * de l'argent de côté pendant le mois, c'est « ce mois-ci : 50 € sur 94 € » qui avance.
 * @returns { hasGoal, ratio, left, reached, late, months, perMonth, monthIn, monthLeft }
 */
export function accountPlan(account, balance, today, monthIn = 0) {
  const target = account.target == null || account.target === '' ? null : Number(account.target)
  const none = { months: null, perMonth: null, monthIn: round2(monthIn), monthLeft: null, late: false }
  if (!target) return { hasGoal: false, ratio: null, left: null, reached: false, ...none }
  const left = Math.max(0, round2(target - balance))
  const ratio = Math.max(0, Math.min(1, balance / target))
  const reached = left === 0
  if (!account.deadline) return { hasGoal: true, ratio, left, reached, ...none }
  if (account.deadline < today) return { hasGoal: true, ratio, left, reached, ...none, late: !reached }
  const months = monthsLeft(today, account.deadline)
  const startLeft = Math.max(0, target - (balance - monthIn))
  const perMonth = reached ? 0 : Math.ceil(startLeft / months)
  return { hasGoal: true, ratio, left, reached, late: false, months, perMonth, monthIn: round2(monthIn), monthLeft: reached ? 0 : Math.max(0, round2(Math.min(perMonth - monthIn, left))) }
}

/**
 * Ce que chaque compte a gagné (ou perdu) ce mois-ci : mouvements sans le solde de départ, moins les dépenses
 * payées avec lui. Une dépense prise sur Vacances en novembre fait donc monter ce qu'il reste à mettre en novembre.
 */
export function monthNets(moves = [], txs = [], today) {
  const p = { mode: 'month', key: monthKey(today) }
  const out = { ...receivedInPeriod(moves, p) }
  for (const t of txs) if (t.account_id && t.kind !== 'income' && inPeriod(p, t.date)) out[t.account_id] = round2((out[t.account_id] || 0) - (Number(t.amount) || 0))
  return out
}

/** Les plans de tous les comptes, avec ce que chacun a gagné ce mois-ci. */
export function accountPlans(accounts, bal, moves, today, txs = []) {
  const net = monthNets(moves, txs, today)
  return Object.fromEntries(accounts.map((a) => [a.id, accountPlan(a, bal[a.id] || 0, today, net[a.id] || 0)]))
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
