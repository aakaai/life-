import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadBudget, createCategories, saveCategoryOrder, DEFAULT_CATEGORIES } from './api'
import { monthSummary, monthKey, shiftMonth, upcomingRenewals, monthlyCost, toCsv, parseAmount } from './logic'
import { balances, accountPlan, savedInMonth } from './accounts'
import { AccountSheet, MoveSheet, TransferSheet, AccountDetail, accIcon, planText } from './accountSheets'
import { BudgetNav, euro, fmtMonth } from './ui'
import CategoryGrid, { CaseBody } from './CategoryGrid'
import { BudgetIcon, IconTile, iconOf } from './icons'
import { TxSheet, SubscriptionSheet, IncomeSheet, CategorySheet, CategoryDetail } from './sheets'
import { parseDay } from '../sport/planner'

const Ctx = createContext(null)
const useBudget = () => useContext(Ctx)
const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Module Budget : saisie manuelle, abonnements et revenus réguliers automatiques.
export default function BudgetModule() {
  const [data, setData] = useState(null)
  const [sheet, setSheet] = useState(null) // { type, item }
  const [month, setMonth] = useState(null)
  const reload = useCallback(async () => {
    const d = await loadBudget()
    setData(d)
    setMonth((m) => m || monthKey(d.today))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // une fiche ouverte depuis le détail d'un compte y revient (avec les chiffres à jour)
  const done = async () => {
    const back = sheet?.back || null
    await reload()
    setSheet(back)
  }
  const close = () => setSheet(sheet?.back || null)

  if (!data) return <div className="page food"><h1 className="large-title">Budget</h1><p className="muted-line">Chargement…</p></div>
  if (!data.categories.length) return <Setup onDone={reload} />

  return (
    <Ctx.Provider value={{ data, reload, month, setMonth, open: setSheet }}>
      <div className="page food budget">
        <header className="sport-head">
          <h1 className="large-title">Budget</h1>
          <Link to="reglages" className="icon-btn" aria-label="Réglages budget"><Icon name="settings" size={22} /></Link>
        </header>
        <BudgetNav />
        <Routes>
          <Route index element={<Month />} />
          <Route path="operations" element={<Operations />} />
          <Route path="comptes" element={<Accounts />} />
          <Route path="objectifs" element={<Accounts />} />
          <Route path="abonnements" element={<Subscriptions />} />
          <Route path="reglages" element={<Settings />} />
        </Routes>
        <button className="fab" aria-label="Ajouter une dépense ou un revenu" onClick={() => setSheet({ type: 'tx' })}>
          <Icon name="plus" size={28} stroke={2.2} />
        </button>
      </div>
      {sheet?.type === 'tx' && <TxSheet tx={sheet.item} data={data} defaultCategory={sheet.category} defaultAccount={sheet.account} onDone={done} onClose={close} />}
      {sheet?.type === 'sub' && <SubscriptionSheet sub={sheet.item} onDone={done} onClose={() => setSheet(null)} />}
      {sheet?.type === 'income' && <IncomeSheet income={sheet.item} onDone={done} onClose={() => setSheet(null)} />}
      <AccountSheets sheet={sheet} setSheet={setSheet} data={data} done={done} close={close} />
      {sheet?.type === 'cat' && <CategorySheet cat={sheet.item} onDone={done} onClose={() => setSheet(null)} />}
      {sheet?.type === 'catDetail' && (
        <CategoryDetail
          row={sheet.item}
          month={month}
          txs={data.txs}
          onAdd={() => setSheet({ type: 'tx', category: sheet.item.cat.id })}
          onEditTx={(t) => setSheet({ type: 'tx', item: t })}
          onEditCat={() => setSheet({ type: 'cat', item: sheet.item.cat })}
          onClose={() => setSheet(null)}
          accName={(id) => data.accounts.find((a) => a.id === id)?.name}
        />
      )}
    </Ctx.Provider>
  )
}

/* ---------- Premier lancement ---------- */

function Setup({ onDone }) {
  const [rows, setRows] = useState(DEFAULT_CATEGORIES.map((c) => ({ ...c, on: true, monthly_budget: c.monthly_budget == null ? '' : String(c.monthly_budget) })))
  const [busy, setBusy] = useState(false)
  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const total = rows.filter((r) => r.on && r.kind !== 'subscriptions').reduce((t, r) => t + (parseAmount(r.monthly_budget) || 0), 0)
  return (
    <div className="page food budget settings">
      <h1 className="large-title">Budget</h1>
      <p className="muted-line">
        Fixe un montant par mois pour chaque catégorie. Laisse vide pour suivre sans plafond. Tu pourras tout changer ensuite en touchant une catégorie.
      </p>
      <ul className="group">
        {rows.map((r, i) => (
          <li key={r.name} className={r.on ? 'row setup-row' : 'row setup-row is-off'}>
            <label className="switch">
              <input type="checkbox" checked={r.on} onChange={(e) => set(i, { on: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label setup-label"><BudgetIcon name={iconOf(r)} size={18} /> {r.name}</span>
            </label>
            {r.kind === 'subscriptions' ? (
              <span className="row-value small">calculé</span>
            ) : (
              <span className="grams-input">
                <input inputMode="decimal" placeholder="—" value={r.monthly_budget} disabled={!r.on} onChange={(e) => set(i, { monthly_budget: e.target.value })} aria-label={`Budget ${r.name}`} />
                €
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="group-foot">Total des plafonds : {euro(total)} par mois, plus tes abonnements.</p>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await createCategories(rows.filter((r) => r.on).map((r) => ({ ...r, monthly_budget: r.monthly_budget === '' ? null : parseAmount(r.monthly_budget) })))
          onDone()
        }}
      >
        Commencer
      </button>
    </div>
  )
}

/* ---------- Mois ---------- */

function MonthSwitch() {
  const { month, setMonth, data } = useBudget()
  const current = monthKey(data.today)
  return (
    <div className="week-switch">
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent"><Icon name="back" size={20} stroke={2} /></button>
      <div className="week-label">
        <strong>{fmtMonth(month)}</strong>
        {month !== current ? <button className="link-btn" onClick={() => setMonth(current)}>Revenir à ce mois</button> : <span>Ce mois-ci</span>}
      </div>
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant"><Icon name="chevron" size={20} stroke={2} /></button>
    </div>
  )
}

function Month() {
  const { data, month, open, reload } = useBudget()
  const sum = useMemo(() => monthSummary({ txs: data.txs, categories: data.categories, subscriptions: data.subscriptions, mk: month, moves: data.moves }), [data, month])
  const prev = useMemo(() => monthSummary({ txs: data.txs, categories: data.categories, subscriptions: data.subscriptions, mk: shiftMonth(month, -1), moves: data.moves }), [data, month])
  const accById = Object.fromEntries((data.accounts || []).map((a) => [a.id, a]))
  const savedBy = savedInMonth(data.moves || [], month).byAccount
  const renewals = upcomingRenewals(data.subscriptions, data.today, 3)
  const isCurrent = month === monthKey(data.today)
  const ratio = sum.totalBudget ? Math.min(1, (sum.totalBudget - sum.left) / sum.totalBudget) : 0
  const level = !sum.totalBudget ? 'ok' : sum.left < 0 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
  const diff = prev.expenses ? Math.round(((sum.expenses - prev.expenses) / prev.expenses) * 100) : null

  return (
    <>
      <MonthSwitch />
      {isCurrent && renewals.map((s) => (
        <div className="callout tip" key={s.id}>
          <span className="callout-icon"><Icon name="refresh" size={20} /></span>
          <p className="callout-text">
            <strong>{s.name}</strong> se renouvelle {fmtDay.format(parseDay(s.next_date))} ({euro(s.amount)}). Si tu ne l’utilises plus, c’est le moment de résilier.
          </p>
        </div>
      ))}

      <section className={`budget-hero is-${level}`}>
        {sum.totalBudget ? (
          <>
            <p className="hero-label">{isCurrent ? 'Reste à dépenser ce mois-ci' : 'Reste à la fin du mois'}</p>
            <p className="hero-value">{euro(sum.left)}</p>
            <div className="macro-bar hero-bar"><span style={{ width: `${ratio * 100}%` }} /></div>
            <p className="hero-sub">{euro(sum.totalBudget - sum.left)} dépensés sur {euro(sum.totalBudget)} de budget</p>
          </>
        ) : (
          <>
            <p className="hero-label">Dépensé ce mois-ci</p>
            <p className="hero-value">{euro(sum.expenses)}</p>
            <p className="hero-sub">Fixe des plafonds dans les réglages pour voir ton reste à dépenser.</p>
          </>
        )}
      </section>

      <h2 className="group-title">Par catégorie <span className="title-hint">· toucher : détail · maintenir : déplacer</span></h2>
      <CategoryGrid
        rows={sum.rows}
        uncategorized={sum.uncategorized}
        onOpen={(r) => open({ type: 'catDetail', item: r })}
        onAdd={(c) => open({ type: 'tx', category: c.id })}
        onReorder={async (ids) => { await saveCategoryOrder(ids, data.categories); await reload() }}
      />

      <h2 className="group-title">Bilan du mois</h2>
      <div className="stats four">
        <div className="stat"><span>Revenus</span><strong className="pos">{euro(sum.income)}</strong></div>
        <div className="stat"><span>Dépenses</span><strong>{euro(sum.expenses)}</strong></div>
        <div className="stat"><span>Épargné</span><strong>{euro(sum.saved)}</strong></div>
        <div className="stat"><span>Solde</span><strong className={sum.balance < 0 ? 'neg' : 'pos'}>{euro(sum.balance)}</strong></div>
      </div>
      {(sum.saved !== 0 || sum.fromAccounts.length > 0) && (
        <p className="group-foot">
          Solde = revenus − dépenses − épargné.
          {Object.keys(savedBy).length > 0 && ` Ce mois : ${Object.entries(savedBy).map(([id, v]) => `${accById[id]?.name || 'compte supprimé'} ${euro(v, { sign: true })}`).join(', ')}.`}
        </p>
      )}
      {sum.fromAccounts.length > 0 && (
        <>
          <h2 className="group-title">Payé avec tes comptes <span className="title-hint">· {euro(sum.fromAccountsTotal)}, pas compté dans les dépenses du mois</span></h2>
          <ul className="group">
            {sum.fromAccounts.map((t) => (
              <li key={t.id}>
                <button className="row tx-row" onClick={() => open({ type: 'tx', item: t })}>
                  <IconTile name={accById[t.account_id] ? accIcon(accById[t.account_id]) : 'epargne'} />
                  <span className="food-main">
                    <span className="food-name">{accById[t.account_id]?.name || 'Compte'}</span>
                    <span className="food-sub">{[t.merchant || t.note, fmtShort.format(parseDay(t.date))].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="tx-amount">− {euro(t.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="group-foot">
        {diff == null ? 'Pas de dépenses le mois précédent pour comparer.' : `Dépenses ${diff > 0 ? 'en hausse' : diff < 0 ? 'en baisse' : 'stables'} de ${Math.abs(diff)} % par rapport à ${fmtMonth(shiftMonth(month, -1)).toLowerCase()} (${euro(prev.expenses)}).`}
      </p>
    </>
  )
}

/* ---------- Opérations ---------- */

function Operations() {
  const { data, month, open } = useBudget()
  const [params, setParams] = useSearchParams()
  const filter = params.get('categorie') || 'tout'
  const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]))
  const list = data.txs.filter((t) => monthKey(t.date) === month && (filter === 'tout' || (filter === 'revenus' ? t.kind === 'income' : t.category_id === filter)))
  const byDay = new Map()
  for (const t of list) byDay.set(t.date, [...(byDay.get(t.date) || []), t])
  const total = list.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0)

  return (
    <>
      <MonthSwitch />
      <div className="chips left cat-chips">
        {[{ id: 'tout', name: 'Tout' }, ...data.categories.filter((c) => !c.archived), { id: 'revenus', name: 'Revenus', emoji: 'revenus' }].map((c) => (
          <button key={c.id} className={filter === c.id ? 'chip chip-icon is-on' : 'chip chip-icon'} onClick={() => setParams(c.id === 'tout' ? {} : { categorie: c.id })}>
            {c.id !== 'tout' && <BudgetIcon name={iconOf(c)} size={15} stroke={1.8} />}{c.name}
          </button>
        ))}
      </div>
      {!list.length && <p className="day-rest">Aucune opération{filter !== 'tout' ? ' dans ce filtre' : ''} ce mois-ci. Touche + pour en ajouter une.</p>}
      {[...byDay.entries()].map(([day, txs]) => (
        <section key={day}>
          <h2 className="group-title">{cap(fmtDay.format(parseDay(day)))}</h2>
          <ul className="group">
            {txs.map((t) => {
              const c = catById[t.category_id]
              return (
                <li key={t.id}>
                  <button className="row tx-row" onClick={() => open({ type: 'tx', item: t })}>
                    <IconTile name={t.kind === 'income' ? 'revenus' : c ? iconOf(c) : 'inconnu'} />
                    <span className="food-main">
                      <span className="food-name">{t.merchant || t.note || (t.kind === 'income' ? 'Revenu' : c?.name || 'Dépense')}</span>
                      <span className="food-sub">
                        {t.kind === 'income' ? 'Revenu' : c?.name || 'Sans catégorie'}
                        {t.origin === 'subscription' && ' · abonnement automatique'}
                        {t.origin === 'recurring' && ' · revenu régulier'}
                        {t.account_id && ` · payé avec ${data.accounts.find((a) => a.id === t.account_id)?.name || 'un compte'}`}
                        {t.note && t.merchant ? ` · ${t.note}` : ''}
                      </span>
                    </span>
                    <span className={t.kind === 'income' ? 'tx-amount pos' : 'tx-amount'}>{t.kind === 'income' ? '+ ' : '− '}{euro(t.amount)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {list.length > 0 && <p className="group-foot">Solde de la sélection : {euro(total, { sign: true })}</p>}
    </>
  )
}

/* ---------- Comptes d'épargne (v0.27) ---------- */

function AccountSheets({ sheet, setSheet, data, done, close }) {
  if (!sheet) return null
  const bal = balances(data.accounts, data.moves, data.txs)
  const fresh = (a) => (a ? data.accounts.find((x) => x.id === a.id) || null : null)
  if (sheet.type === 'account') return <AccountSheet account={fresh(sheet.item)} onDone={async () => { await done(); if (sheet.back && !fresh(sheet.back.item)) setSheet(null) }} onClose={close} />
  if (sheet.type === 'move') {
    const a = fresh(sheet.account)
    return a ? <MoveSheet account={a} balance={bal[a.id] || 0} move={sheet.move} startWithdraw={sheet.withdraw} onDone={done} onClose={close} /> : null
  }
  if (sheet.type === 'transfer') {
    const a = fresh(sheet.account)
    return a ? <TransferSheet account={a} accounts={data.accounts} balance={bal[a.id] || 0} onDone={done} onClose={close} /> : null
  }
  if (sheet.type === 'accountDetail') {
    const a = fresh(sheet.item)
    if (!a) return null
    const back = { type: 'accountDetail', item: a }
    return <AccountDetail account={a} data={data} open={(s) => setSheet({ ...s, back })} onClose={() => setSheet(null)} />
  }
  return null
}

function Accounts() {
  const { data, open } = useBudget()
  if (data.movesMissing) {
    return (
      <div className="callout">
        <span className="callout-icon"><Icon name="info" size={20} /></span>
        <p className="callout-text">Pour utiliser les comptes (Vacances, Vélo, Déco…), lance <strong>018_comptes.sql</strong> dans Supabase (SQL Editor). Tes objectifs actuels deviendront des comptes, avec ce que tu avais déjà mis de côté.</p>
      </div>
    )
  }
  const bal = balances(data.accounts, data.moves, data.txs)
  const total = Object.values(bal).reduce((t, v) => t + v, 0)
  const month = savedInMonth(data.moves, monthKey(data.today))
  return (
    <>
      <section className="budget-hero acc-hero">
        <p className="hero-label">Mis de côté au total</p>
        <p className="hero-value">{euro(Math.round(total * 100) / 100)}</p>
        <p className="hero-sub">
          {month.saved ? <><span className={month.saved > 0 ? 'pos' : ''}>{euro(month.saved, { sign: true })}</span> ce mois-ci · </> : 'Rien mis de côté ce mois-ci · '}
          {data.accounts.length} compte{data.accounts.length > 1 ? 's' : ''}
        </p>
      </section>
      {!data.accounts.length && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">Un compte = une enveloppe où tu mets de l’argent de côté : Vacances, Vélo, Déco, Autre… Tu peux lui donner un objectif (montant et date) et payer des dépenses avec.</p>
        </div>
      )}
      <div className="bcase-grid goal-grid">
        {data.accounts.map((a) => {
          const b = bal[a.id] || 0
          const plan = accountPlan(a, b, data.today)
          const sub = planText(plan, a)
          return (
            <div key={a.id} className={plan.reached ? 'bcase is-done' : 'bcase'}>
              <button className="bcase-main" onClick={() => open({ type: 'accountDetail', item: a })} aria-label={`${a.name} : ${euro(b)}, ${sub}`}>
                <CaseBody icon={accIcon(a)} name={a.name} main={euro(b)} sub={sub} ratio={plan.hasGoal ? plan.ratio : null} />
              </button>
              <button className="bcase-add" onClick={() => open({ type: 'move', account: a })} aria-label={`Mettre de côté : ${a.name}`}>
                <Icon name="plus" size={16} stroke={2.2} />
              </button>
            </div>
          )
        })}
        <button className="bcase bcase-new" onClick={() => open({ type: 'account' })}><Icon name="plus" size={18} stroke={2} /> Nouveau compte</button>
      </div>
      {data.accounts.length > 0 && <p className="group-foot">« + » sur une case : mettre de côté. Toucher une case : courbe, mouvements, retirer, virer. Pour payer avec un compte : « Payé avec » en ajoutant la dépense.</p>}
    </>
  )
}

/* ---------- Abonnements et revenus réguliers ---------- */

function Subscriptions() {
  const { data, open } = useBudget()
  const active = data.subscriptions.filter((s) => s.active)
  const total = active.reduce((t, s) => t + monthlyCost(s), 0)
  const days = (k) => Math.round((parseDay(k) - parseDay(data.today)) / 86400000)
  const per = { weekly: 'semaine', monthly: 'mois', yearly: 'an' }
  return (
    <>
      <div className="stats">
        <div className="stat"><span>Par mois</span><strong>{euro(Math.round(total * 100) / 100)}</strong></div>
        <div className="stat"><span>Par an</span><strong>{euro(Math.round(total * 12))}</strong></div>
        <div className="stat"><span>Actifs</span><strong>{active.length}</strong></div>
      </div>
      <h2 className="group-title">Abonnements</h2>
      <ul className="group">
        {data.subscriptions.map((s) => (
          <li key={s.id}>
            <button className={s.active ? 'row tx-row' : 'row tx-row is-off'} onClick={() => open({ type: 'sub', item: s })}>
              <IconTile name="abos" />
              <span className="food-main">
                <span className="food-name">{s.name}{!s.active && <span className="tag">En pause</span>}</span>
                <span className={s.active && days(s.next_date) <= 3 ? 'food-sub warn-text' : 'food-sub'}>
                  {s.active ? `Prochain prélèvement : ${fmtShort.format(parseDay(s.next_date))}${days(s.next_date) <= 3 ? ` (dans ${days(s.next_date)} jour${days(s.next_date) > 1 ? 's' : ''})` : ''}` : 'Ne sera plus compté'}
                </span>
              </span>
              <span className="tx-amount">{euro(s.amount)}<span className="muted"> / {per[s.period]}</span></span>
            </button>
          </li>
        ))}
        <li><button className="row row-action" onClick={() => open({ type: 'sub' })}><Icon name="plus" size={18} stroke={2} /> Nouvel abonnement</button></li>
      </ul>
      <p className="group-foot">Chaque prélèvement s’ajoute tout seul dans la catégorie Abonnements, le bon jour. Rappel 3 jours avant dans l’onglet Mois et sur l’accueil.</p>

      <h2 className="group-title">Revenus réguliers</h2>
      <ul className="group">
        {data.incomes.map((r) => (
          <li key={r.id}>
            <button className={r.active ? 'row tx-row' : 'row tx-row is-off'} onClick={() => open({ type: 'income', item: r })}>
              <IconTile name="revenus" />
              <span className="food-main">
                <span className="food-name">{r.name}</span>
                <span className="food-sub">Chaque mois · prochaine rentrée : {fmtShort.format(parseDay(r.next_date))}</span>
              </span>
              <span className="tx-amount pos">+ {euro(r.amount)}</span>
            </button>
          </li>
        ))}
        <li><button className="row row-action" onClick={() => open({ type: 'income' })}><Icon name="plus" size={18} stroke={2} /> Revenu régulier</button></li>
      </ul>
    </>
  )
}

/* ---------- Réglages ---------- */

function Settings() {
  const { data, open } = useBudget()
  function exportCsv() {
    const csv = toCsv(data.txs, Object.fromEntries(data.categories.map((c) => [c.id, c])), Object.fromEntries(data.accounts.map((a) => [a.id, a])))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `budget-${data.today}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const visible = data.categories.filter((c) => !c.archived)
  const hidden = data.categories.filter((c) => c.archived)
  return (
    <>
      <h2 className="group-title">Catégories et budget par mois</h2>
      <ul className="group">
        {visible.map((c) => (
          <li key={c.id}>
            <button className="row tx-row" onClick={() => open({ type: 'cat', item: c })}>
              <IconTile name={iconOf(c)} />
              <span className="row-label">{c.name}</span>
              <span className="row-value">{c.kind === 'subscriptions' ? 'calculé' : c.monthly_budget == null ? 'sans plafond' : euro(c.monthly_budget)}</span>
            </button>
          </li>
        ))}
        <li><button className="row row-action" onClick={() => open({ type: 'cat', item: null })}><Icon name="plus" size={18} stroke={2} /> Nouvelle catégorie</button></li>
      </ul>
      {hidden.length > 0 && (
        <>
          <h2 className="group-title">Catégories masquées</h2>
          <ul className="group">
            {hidden.map((c) => (
              <li key={c.id}><button className="row tx-row is-off" onClick={() => open({ type: 'cat', item: c })}><IconTile name={iconOf(c)} /><span className="row-label">{c.name}</span></button></li>
            ))}
          </ul>
        </>
      )}
      <h2 className="group-title">Données</h2>
      <ul className="group">
        <li><button className="row row-action" onClick={exportCsv}><Icon name="download" size={18} stroke={2} /> Exporter toutes les opérations (CSV, Excel)</button></li>
      </ul>
      <p className="group-foot">Toutes tes opérations restent dans ta base Supabase : aucune connexion à ta banque.</p>
    </>
  )
}
