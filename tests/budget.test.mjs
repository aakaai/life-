import assert from 'node:assert/strict'
import { nextDate, duePostings, monthSummary, guessCategory, frequentShortcuts, goalPlan, upcomingRenewals, monthlyCost, toCsv, parseAmount, shiftMonth, monthEnd } from '../src/modules/budget/logic.js'

assert.equal(nextDate('2026-01-31', 'monthly'), '2026-02-28')
assert.equal(nextDate('2026-02-28', 'monthly', 31), '2026-03-31')
assert.equal(nextDate('2026-11-02', 'yearly'), '2027-11-02')
assert.equal(nextDate('2026-11-02', 'weekly'), '2026-11-09')
assert.equal(shiftMonth('2026-12', 1), '2027-01')
assert.equal(monthEnd('2026-02'), '2026-02-28')
assert.equal(parseAmount('12,5'), 12.5)

const subs = [{ id: 'z', name: 'Zwift', amount: 19.99, period: 'monthly', next_date: '2026-09-15', active: true }, { id: 'y', name: 'iCloud', amount: 35.88, period: 'yearly', next_date: '2027-03-01', active: true }]
const inc = [{ id: 'j', name: 'Job étudiant', amount: 400, next_date: '2026-10-05', active: true }]
const due = duePostings({ subscriptions: subs, incomes: inc, today: '2026-11-02', subsCategoryId: 'abo' })
console.log(due.txs.map((t) => `${t.date} ${t.kind} ${t.merchant} ${t.amount}`), due.updates)
assert.equal(due.txs.filter((t) => t.origin === 'subscription').length, 2) // 15 sept + 15 oct
assert.equal(due.txs.filter((t) => t.origin === 'recurring').length, 1)
assert.deepEqual(due.updates.find((u) => u.id === 'z').next_date, '2026-11-15')
assert.equal(monthlyCost(subs[1]), 2.99)

const cats = [{ id: 'c', name: 'Courses', monthly_budget: 220 }, { id: 'r', name: 'Repas dehors', monthly_budget: 50 }, { id: 'abo', name: 'Abonnements', kind: 'subscriptions' }, { id: 'd', name: 'Divers', monthly_budget: null }]
const txs = [
  { kind: 'expense', amount: 45.2, category_id: 'c', date: '2026-11-02', merchant: 'Colruyt', origin: 'manual' },
  { kind: 'expense', amount: 3.2, category_id: 'r', date: '2026-11-02', merchant: 'Café', origin: 'manual' },
  { kind: 'expense', amount: 3.2, category_id: 'r', date: '2026-11-03', merchant: 'café', origin: 'manual' },
  { kind: 'expense', amount: 38, category_id: 'r', date: '2026-11-04', merchant: 'Resto', origin: 'manual' },
  { kind: 'expense', amount: 19.99, category_id: 'abo', date: '2026-11-15', merchant: 'Zwift', origin: 'subscription' },
  { kind: 'income', amount: 400, date: '2026-11-05', merchant: 'Job étudiant', origin: 'recurring' },
  { kind: 'expense', amount: 100, category_id: 'c', date: '2026-10-20', merchant: 'Colruyt', origin: 'manual' }
]
const sum = monthSummary({ txs, categories: cats, subscriptions: subs, mk: '2026-11' })
console.log(sum.rows.map((r) => `${r.cat.name} ${r.spent}/${r.budget} ${r.level}`), sum.expenses, sum.income, sum.balance, sum.left)
assert.equal(sum.rows.find((r) => r.cat.id === 'r').level, 'warn')
assert.equal(sum.rows.find((r) => r.cat.id === 'abo').budget, 22.98)
assert.equal(guessCategory(txs, 'colruyt'), 'c')
assert.equal(frequentShortcuts(txs)[0].merchant.toLowerCase(), 'café')
const g = goalPlan({ target: 1000, saved: 0, deadline: '2027-01-23' }, '2026-11-02')
console.log(g)
assert.ok(g.perWeek >= 80 && g.perWeek <= 90)
assert.equal(upcomingRenewals([{ ...subs[0], next_date: '2026-11-04' }], '2026-11-02').length, 1)
assert.ok(toCsv(txs, { c: cats[0] }).includes('Colruyt'))
console.log('OK')
