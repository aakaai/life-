// Budget : comptes d'épargne (v0.27).
import assert from 'node:assert/strict'
import { accountEntries, balanceOf, balances, savedInMonth, savedInPeriod, totalEntries, goalsProgress, balanceSeries, accountPlan, initialMovesFor, availableFor } from '../src/modules/budget/accounts.js'
import { monthSummary, periodSummary, periodOf, shiftPeriod, periodLabel, periodIn, periodRemaining, toCsv } from '../src/modules/budget/logic.js'

const accounts = [
  { id: 'vac', name: 'Vacances', target: 1000, deadline: '2027-01-20', saved: 0, created_at: '2026-09-01T10:00:00Z' },
  { id: 'velo', name: 'Vélo', target: null, deadline: null, saved: 0 },
  { id: 'old', name: 'Casque', target: 120, saved: 120, created_at: '2026-10-02T10:00:00Z' }
]
const moves = [
  { id: 'm1', account_id: 'vac', date: '2026-09-01', amount: 530, kind: 'initial' },
  { id: 'm2', account_id: 'vac', date: '2026-10-03', amount: 80, kind: 'deposit', note: 'job chez Max' },
  { id: 'm3', account_id: 'velo', date: '2026-10-15', amount: -100, kind: 'transfer', peer_id: 'vac', transfer_id: 't1' },
  { id: 'm4', account_id: 'vac', date: '2026-10-15', amount: 100, kind: 'transfer', peer_id: 'velo', transfer_id: 't1' },
  { id: 'm5', account_id: 'velo', date: '2026-10-01', amount: 250, kind: 'initial' },
  { id: 'm6', account_id: 'vac', date: '2026-11-03', amount: 50, kind: 'deposit' },
  { id: 'm7', account_id: 'velo', date: '2026-11-04', amount: 100, kind: 'deposit' },
  { id: 'm8', account_id: 'velo', date: '2026-11-05', amount: -20, kind: 'withdraw' }
]
const txs = [
  { id: 't-vols', kind: 'expense', amount: 120, category_id: 'voy', date: '2026-10-28', merchant: 'Vols Bangkok', account_id: 'vac' },
  { id: 't-deca', kind: 'expense', amount: 89.9, category_id: 'sport', date: '2026-11-04', merchant: 'Decathlon', account_id: 'velo' },
  { id: 't-colr', kind: 'expense', amount: 40, category_id: 'courses', date: '2026-11-02', merchant: 'Colruyt' },
  { id: 't-job', kind: 'income', amount: 650, date: '2026-11-01', merchant: 'Job' }
]
const accById = Object.fromEntries(accounts.map((a) => [a.id, a]))
const round = (v) => Math.round(v * 100) / 100

// soldes : mouvements − dépenses payées avec le compte
const bal = balances(accounts, moves, txs)
assert.equal(bal.vac, 530 + 80 + 100 + 50 - 120) // 640
assert.equal(bal.velo, 250 - 100 + 100 - 20 - 89.9) // 140,1
assert.equal(bal.old, 0) // pas encore de mouvement
const e = accountEntries('vac', moves, txs, accById)
assert.equal(balanceOf(e), 640)
assert.deepEqual(e.map((x) => x.date), ['2026-11-03', '2026-10-28', '2026-10-15', '2026-10-03', '2026-09-01'])
assert.equal(e.find((x) => x.kind === 'transfer').label, 'Viré depuis Vélo')
assert.equal(accountEntries('velo', moves, txs, accById).find((x) => x.kind === 'transfer').label, 'Viré vers Vacances')
assert.equal(e.find((x) => x.type === 'spend').label, 'Vols Bangkok (dépense)')
assert.equal(e.find((x) => x.type === 'spend').amount, -120)

// courbe : solde en fin de journée
assert.deepEqual(balanceSeries(e), [
  { date: '2026-09-01', value: 530 }, { date: '2026-10-03', value: 610 }, { date: '2026-10-15', value: 710 },
  { date: '2026-10-28', value: 590 }, { date: '2026-11-03', value: 640 }
])

// épargné du mois : versements − retraits (pas les virements, pas les soldes de départ)
assert.deepEqual(savedInMonth(moves, '2026-11'), { saved: 130, byAccount: { vac: 50, velo: 80 } })
assert.equal(savedInMonth(moves, '2026-10').saved, 80)

// objectif facultatif
const p = accountPlan(accounts[0], 640, '2026-11-05')
assert.equal(p.hasGoal, true)
assert.equal(p.left, 360)
assert.equal(Math.round(p.ratio * 100), 64)
assert.equal(p.perWeek, Math.ceil(360 / (76 / 7)))
assert.equal(accountPlan(accounts[1], 140, '2026-11-05').hasGoal, false)
assert.equal(accountPlan({ target: 100 }, 120, '2026-11-05').reached, true)
assert.equal(accountPlan({ target: 100, deadline: '2026-11-01' }, 50, '2026-11-05').late, true)

// anciens objectifs : « déjà mis de côté » → solde de départ, une seule fois
assert.deepEqual(initialMovesFor(accounts, moves), [{ account_id: 'old', date: '2026-10-02', amount: 120, kind: 'initial', note: null }])
assert.deepEqual(initialMovesFor(accounts, [...moves, { account_id: 'old', amount: 120, kind: 'initial' }]), [])

// payer avec un compte : en modifiant une dépense déjà payée avec ce compte, son montant compte comme disponible
assert.equal(availableFor('velo', bal), 140.1)
assert.equal(availableFor('velo', bal, txs[1]), 230)
assert.equal(availableFor('vac', bal, txs[1]), 640)

// bilan du mois : dépenses payées avec un compte à part, ligne « Épargné », solde = revenus − dépenses − épargné
const cats = [{ id: 'sport', name: 'Sport', monthly_budget: 30 }, { id: 'courses', name: 'Courses', monthly_budget: 220 }]
const sum = monthSummary({ txs, categories: cats, mk: '2026-11', moves })
assert.equal(sum.expenses, 40)
assert.equal(sum.rows.find((r) => r.cat.id === 'sport').spent, 0, 'la dépense payée avec Vélo ne touche pas le budget Sport')
assert.equal(sum.saved, 130)
assert.equal(sum.balance, 650 - 40 - 130)
assert.equal(sum.fromAccounts.length, 1)
assert.equal(sum.fromAccountsTotal, 89.9)
// sans mouvements (avant 018) : comme avant
assert.equal(monthSummary({ txs: txs.filter((t) => !t.account_id), categories: cats, mk: '2026-11' }).balance, 610)

// export CSV : colonne « Payé avec »
const csv = toCsv(txs, { sport: { name: 'Sport' } }, accById)
assert.ok(csv.includes(';Payé avec'))
assert.ok(csv.includes('Decathlon;;Saisie;Vélo'))
assert.ok(csv.includes('Colruyt;;Saisie;Budget du mois'))

/* ---------- v0.28 : période mois / année, case Total ---------- */
const nov = periodOf('month', '2026-11-05')
const y26 = periodOf('year', '2026-11-05')
assert.deepEqual(nov, { mode: 'month', key: '2026-11' })
assert.deepEqual(shiftPeriod(nov, 2), { mode: 'month', key: '2027-01' })
assert.deepEqual(shiftPeriod(y26, -1), { mode: 'year', key: '2025' })
assert.equal(periodLabel(nov), 'Novembre 2026')
assert.equal(periodLabel(y26), '2026')
assert.equal(periodIn(nov, '2026-11-05'), 'en novembre')
assert.equal(periodIn({ mode: 'month', key: '2025-11' }, '2026-11-05'), 'en novembre 2025')
assert.equal(periodIn(y26, '2026-11-05'), 'en 2026')
assert.equal(periodRemaining(nov, '2026-11-06'), '24 jours restants')
assert.equal(periodRemaining(y26, '2026-11-06'), '1 mois restant')
assert.equal(periodRemaining({ mode: 'month', key: '2026-10' }, '2026-11-06'), null)

// année : budget × 12, toutes les opérations de l'année
const yearSum = periodSummary({ txs, categories: cats, period: y26, moves })
assert.equal(yearSum.rows.find((r) => r.cat.id === 'courses').budget, 2640)
assert.equal(yearSum.totalBudget, (30 + 220) * 12)
assert.equal(yearSum.saved, 80 + 130)
assert.equal(yearSum.fromAccountsTotal, 120 + 89.9)
assert.deepEqual(periodSummary({ txs, categories: cats, period: nov, moves }), monthSummary({ txs, categories: cats, mk: '2026-11', moves }))

// ajouté par compte sur la période
assert.deepEqual(savedInPeriod(moves, nov), savedInMonth(moves, '2026-11'))
assert.deepEqual(savedInPeriod(moves, y26).byAccount, { vac: 130, velo: 80 })

// Total : un virement n'apparaît qu'une fois et ne change pas le total
const te = totalEntries(accounts, moves, txs)
const transfers = te.filter((x) => x.kind === 'transfer')
assert.equal(transfers.length, 1)
assert.equal(transfers[0].label, 'Virement Vélo → Vacances')
assert.equal(transfers[0].shown, 100)
assert.equal(balanceOf(te), round(bal.vac + bal.velo + bal.old))
assert.equal(balanceSeries(te).at(-1).value, round(bal.vac + bal.velo))
// objectifs réunis (plafonnés à chaque objectif)
assert.deepEqual(goalsProgress(accounts, { vac: 640, velo: 140.1, old: 500 }), { have: 640 + 120, target: 1000 + 120 })

console.log('comptes : ok')
