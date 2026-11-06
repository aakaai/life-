import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadBudget, createCategories, saveCategoryOrder, DEFAULT_CATEGORIES } from './api'
import { periodSummary, periodOf, shiftPeriod, inPeriod, periodLabel, periodIn, periodRemaining, upcomingRenewals, monthlyCost, toCsv, parseAmount } from './logic'
import { balances, accountPlan, savedInPeriod, receivedInPeriod, splitAccounts } from './accounts'
import { AccountSheet, MoveSheet, TransferSheet, AccountDetail, TotalDetail, DistributeSheet, accIcon, planText } from './accountSheets'
import { euro } from './ui'
import CategoryGrid, { CaseBody } from './CategoryGrid'
import { BudgetIcon, IconTile, iconOf } from './icons'
import { TxSheet, SubscriptionSheet, IncomeSheet, CategorySheet, CategoryDetail } from './sheets'
import { parseDay } from '../sport/planner'

const Ctx = createContext(null)
const useBudget = () => useContext(Ctx)
const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })
const fmtWeekday = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const MODE_KEY = 'life:budget-mode'
const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === 'year' ? 'year' : 'month'
  } catch {
    return 'month'
  }
}

// « aujourd'hui », « hier », « mer. 4 nov. »
function dayWord(k, today) {
  const d = Math.round((parseDay(today) - parseDay(k)) / 86400000)
  if (d === 0) return 'aujourd’hui'
  if (d === 1) return 'hier'
  return fmtWeekday.format(parseDay(k))
}

// Budget sur une seule page (v0.28) : mois ou année en haut, puis catégories, opérations, comptes, abonnements.
export default function BudgetModule() {
  const [data, setData] = useState(null)
  const [sheet, setSheet] = useState(null) // { type, item, back? }
  const [period, setPeriodState] = useState(null)
  const reload = useCallback(async () => {
    const d = await loadBudget()
    setData(d)
    setPeriodState((p) => p || periodOf(readMode(), d.today))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const setPeriod = (p) => {
    setPeriodState(p)
    try {
      localStorage.setItem(MODE_KEY, p.mode)
    } catch {
      /* rien : le choix ne sera juste pas retenu */
    }
  }

  // une fiche ouverte depuis le détail d'un compte (ou du total) y revient, avec les chiffres à jour
  const done = async () => {
    const back = sheet?.back || null
    await reload()
    setSheet(back)
  }
  const close = () => setSheet(sheet?.back || null)

  if (!data || !period) return <div className="page food"><h1 className="large-title">Budget</h1><p className="muted-line">Chargement…</p></div>
  if (!data.categories.length) return <Setup onDone={reload} />

  return (
    <Ctx.Provider value={{ data, reload, period, setPeriod, open: setSheet }}>
      <div className="page food budget">
        <Routes>
          <Route path="operations" element={<AllOperations />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="*" element={<OnePage />} />
        </Routes>
        <button className="fab" aria-label="Ajouter une dépense ou un revenu" onClick={() => setSheet({ type: 'tx' })}>
          <Icon name="plus" size={28} stroke={2.2} />
        </button>
      </div>
      {sheet?.type === 'tx' && <TxSheet tx={sheet.item} data={data} defaultCategory={sheet.category} defaultAccount={sheet.account} onDone={done} onClose={close} />}
      {sheet?.type === 'sub' && <SubscriptionSheet sub={sheet.item} onDone={done} onClose={close} />}
      {sheet?.type === 'income' && <IncomeSheet income={sheet.item} onDone={done} onClose={close} />}
      <AccountSheets sheet={sheet} setSheet={setSheet} data={data} period={period} done={done} close={close} />
      {sheet?.type === 'cat' && <CategorySheet cat={sheet.item} onDone={done} onClose={close} />}
      {sheet?.type === 'catDetail' && (
        <CategoryDetail
          row={sheet.item}
          period={period}
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

/* ---------- La page ---------- */

function PeriodBar() {
  const { period, setPeriod, data } = useBudget()
  const current = periodOf(period.mode, data.today)
  const isCurrent = current.key === period.key
  return (
    <>
      <div className="segmented wide budget-mode" role="tablist" aria-label="Période">
        <button role="tab" aria-selected={period.mode === 'month'} className={period.mode === 'month' ? 'is-on' : ''} onClick={() => setPeriod(periodOf('month', data.today))}>Mois</button>
        <button role="tab" aria-selected={period.mode === 'year'} className={period.mode === 'year' ? 'is-on' : ''} onClick={() => setPeriod(periodOf('year', data.today))}>Année</button>
      </div>
      <div className="week-switch">
        <button className="icon-btn" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label={period.mode === 'year' ? 'Année précédente' : 'Mois précédent'}><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label">
          <strong>{periodLabel(period)}</strong>
          {isCurrent ? <span>{period.mode === 'year' ? 'Cette année' : 'Ce mois-ci'}</span> : <button className="link-btn" onClick={() => setPeriod(current)}>{period.mode === 'year' ? 'Revenir à cette année' : 'Revenir à ce mois'}</button>}
        </div>
        <button className="icon-btn" onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label={period.mode === 'year' ? 'Année suivante' : 'Mois suivant'}><Icon name="chevron" size={20} stroke={2} /></button>
      </div>
    </>
  )
}

function SectionHead({ title, right, id, kind }) {
  return (
    <div className="bsec-head">
      <h2 id={id}>
        {kind && <span className={`bsec-badge is-${kind}`} aria-hidden="true"><BudgetIcon name={kind === 'save' ? 'epargne' : 'courses'} size={15} stroke={2} /></span>}
        {title}
      </h2>
      {right}
    </div>
  )
}

function OnePage() {
  const { data, period } = useBudget()
  return (
    <>
      <header className="sport-head">
        <h1 className="large-title">Budget</h1>
        <Link to="/budget/reglages" className="icon-btn" aria-label="Réglages budget"><Icon name="settings" size={22} /></Link>
      </header>
      <PeriodBar />
      <Hero />
      {inPeriod(period, data.today) && <Renewals />}
      {/* téléphone : les unes sous les autres ; ordinateur : Catégories | Comptes, puis Opérations | Abonnements */}
      <div className="budget-main">
        <Categories />
        <RecentOperations />
        <Accounts />
        <Subscriptions />
      </div>
    </>
  )
}

function Hero() {
  const { data, period } = useBudget()
  const sum = useMemo(() => periodSummary({ txs: data.txs, categories: data.categories, subscriptions: data.subscriptions, period, moves: data.moves }), [data, period])
  const prevP = shiftPeriod(period, -1)
  const prev = useMemo(() => periodSummary({ txs: data.txs, categories: data.categories, subscriptions: data.subscriptions, period: shiftPeriod(period, -1), moves: data.moves }), [data, period])
  const isCurrent = inPeriod(period, data.today)
  const year = period.mode === 'year'
  const ratio = sum.totalBudget ? Math.min(1, (sum.totalBudget - sum.left) / sum.totalBudget) : 0
  const level = !sum.totalBudget ? 'ok' : sum.left < 0 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
  const diff = prev.expenses ? Math.round(((sum.expenses - prev.expenses) / prev.expenses) * 100) : null
  const prevName = year ? prevP.key : periodLabel(prevP).split(' ')[0].toLowerCase()
  const remaining = periodRemaining(period, data.today)
  const monthly = data.categories.filter((c) => !c.archived && c.kind !== 'subscriptions' && c.monthly_budget != null && c.monthly_budget !== '').reduce((t, c) => t + Number(c.monthly_budget), 0)
  const subsMonthly = data.subscriptions.filter((s) => s.active).reduce((t, s) => t + monthlyCost(s), 0)

  return (
    <section className={`budget-hero is-${level}`} aria-label="Résumé de la période">
      {sum.totalBudget ? (
        <>
          <p className="hero-label">
            {isCurrent ? (year ? `Reste à dépenser en ${period.key}` : 'Reste à dépenser ce mois-ci') : year ? `Reste à la fin de ${period.key}` : 'Reste à la fin du mois'}
          </p>
          <p className="hero-value">{euro(sum.left)}</p>
          <div className="macro-bar hero-bar"><span style={{ width: `${ratio * 100}%` }} /></div>
          <p className="hero-sub">
            {euro(sum.totalBudget - sum.left)} dépensés sur {euro(sum.totalBudget)} de budget
            {year && ` (${euro(Math.round((monthly + subsMonthly) * 100) / 100)} × 12)`}
            {remaining && ` · ${remaining}`}
          </p>
        </>
      ) : (
        <>
          <p className="hero-label">Dépensé {periodIn(period, data.today)}</p>
          <p className="hero-value">{euro(sum.expenses)}</p>
          <p className="hero-sub">Fixe des plafonds dans les réglages pour voir ton reste à dépenser.</p>
        </>
      )}
      <div className="hero-bilan">
        <div><span>Revenus</span><strong className="pos">{euro(sum.income)}</strong></div>
        <div><span>Dépenses</span><strong>{euro(sum.expenses)}</strong></div>
        <div><span>Épargné</span><strong>{euro(sum.saved)}</strong></div>
        <div><span>Solde</span><strong className={sum.balance < 0 ? 'neg' : 'pos'}>{euro(sum.balance)}</strong></div>
      </div>
      <p className="hero-cmp">
        {diff == null ? `Pas de dépenses ${year ? `en ${prevP.key}` : `en ${prevName}`} pour comparer.` : `Dépenses ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)} % par rapport à ${prevName} (${euro(prev.expenses)}).`}
        {sum.fromAccountsTotal > 0 && ` ${euro(sum.fromAccountsTotal)} payés avec tes comptes, hors dépenses.`}
      </p>
    </section>
  )
}

function Renewals() {
  const { data } = useBudget()
  const renewals = upcomingRenewals(data.subscriptions, data.today, 3)
  if (!renewals.length) return null
  const days = (k) => Math.round((parseDay(k) - parseDay(data.today)) / 86400000)
  const when = (k) => (days(k) === 0 ? 'aujourd’hui' : days(k) === 1 ? 'demain' : `dans ${days(k)} jours`)
  return (
    <div className="budget-alerts">
      {renewals.map((s) => (
        <p key={s.id} className="budget-alert">
          <Icon name="refresh" size={16} stroke={2} />
          <span><strong>{s.name}</strong> prélevé {when(s.next_date)} · {euro(s.amount)}</span>
        </p>
      ))}
    </div>
  )
}

function Categories() {
  const { data, period, open, reload } = useBudget()
  const sum = useMemo(() => periodSummary({ txs: data.txs, categories: data.categories, subscriptions: data.subscriptions, period, moves: data.moves }), [data, period])
  return (
    <section className="bsec bsec-cats" aria-labelledby="b-cats">
      <SectionHead id="b-cats" kind="spend" title="Catégories" right={<span className="bsec-hint">ce que tu dépenses{period.mode === 'year' ? ' sur l’année' : ''}</span>} />
      <CategoryGrid
        rows={sum.rows}
        uncategorized={sum.uncategorized}
        onOpen={(r) => open({ type: 'catDetail', item: r })}
        onAdd={(c) => open({ type: 'tx', category: c.id })}
        onReorder={async (ids) => { await saveCategoryOrder(ids, data.categories); await reload() }}
      />
      <p className="bsec-foot">« + » : ajouter une dépense · toucher : détail · maintenir : déplacer</p>
    </section>
  )
}

function TxRow({ t }) {
  const { data, open } = useBudget()
  const c = data.categories.find((x) => x.id === t.category_id)
  const acc = t.account_id ? data.accounts.find((a) => a.id === t.account_id) : null
  return (
    <li>
      <button className="row tx-row" onClick={() => open({ type: 'tx', item: t })}>
        <IconTile name={t.kind === 'income' ? 'revenus' : c ? iconOf(c) : 'inconnu'} />
        <span className="food-main">
          <span className="food-name">{t.merchant || t.note || (t.kind === 'income' ? 'Revenu' : c?.name || 'Dépense')}</span>
          <span className="food-sub">
            {[
              t.kind === 'income' ? 'Revenu' : c?.name || 'Sans catégorie',
              dayWord(t.date, data.today),
              t.origin === 'subscription' ? 'abonnement automatique' : null,
              t.origin === 'recurring' ? 'revenu régulier' : null,
              t.account_id ? `payé avec ${acc?.name || 'un compte'}` : null,
              t.note && t.merchant ? t.note : null
            ].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className={t.kind === 'income' ? 'tx-amount pos' : 'tx-amount'}>{t.kind === 'income' ? '+ ' : '− '}{euro(t.amount)}</span>
      </button>
    </li>
  )
}

const byNewest = (a, b) => (a.date === b.date ? ((a.created_at || '') < (b.created_at || '') ? 1 : -1) : a.date < b.date ? 1 : -1)

function RecentOperations() {
  const { data, period } = useBudget()
  const list = data.txs.filter((t) => inPeriod(period, t.date)).sort(byNewest)
  return (
    <section className="bsec bsec-ops" aria-labelledby="b-ops">
      <SectionHead id="b-ops" title="Opérations" right={<Link className="bsec-link" to="/budget/operations">Tout voir <Icon name="chevron" size={14} stroke={2.2} /></Link>} />
      {list.length ? (
        <ul className="group">{list.slice(0, 5).map((t) => <TxRow key={t.id} t={t} />)}</ul>
      ) : (
        <p className="muted-line">Aucune opération {periodIn(period, data.today)}. Touche + pour en ajouter une.</p>
      )}
      {list.length > 5 && <p className="group-foot">{list.length} opérations {periodIn(period, data.today)}.</p>}
    </section>
  )
}

function Accounts() {
  const { data, period, open } = useBudget()
  if (data.movesMissing) {
    return (
      <section className="bsec bsec-acc" aria-labelledby="b-acc">
        <SectionHead id="b-acc" kind="save" title="Comptes" />
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">Pour utiliser les comptes (Vacances, Vélo, Déco…), lance <strong>018_comptes.sql</strong> dans Supabase (SQL Editor).</p>
        </div>
      </section>
    )
  }
  const { main, envelopes } = splitAccounts(data.accounts)
  const bal = balances(data.accounts, data.moves, data.txs)
  const received = receivedInPeriod(data.moves, period)
  const when = periodIn(period, data.today)
  const line = (v) => (v ? `${euro(v, { sign: true })} ${when}` : `rien ${when}`)
  return (
    <section className="bsec bsec-acc" aria-labelledby="b-acc">
      <SectionHead id="b-acc" kind="save" title="Comptes" right={<span className="bsec-hint">ce que tu mets de côté</span>} />
      {main && <MainCard main={main} envelopes={envelopes} bal={bal} />}
      <div className="bcase-grid compact acc-grid">
        {envelopes.map((a) => {
          const b = bal[a.id] || 0
          const plan = accountPlan(a, b, data.today)
          const sub = planText(plan, a)
          const got = received[a.id] || 0
          return (
            <div key={a.id} className={plan.reached ? 'bcase env is-done' : 'bcase env'}>
              <button className="bcase-main" onClick={() => open({ type: 'accountDetail', item: a })} aria-label={`${a.name} : ${euro(b)}, ${line(got)}, ${sub}`}>
                <CaseBody icon={accIcon(a)} name={a.name} main={euro(b)} extra={<span className={got ? 'bcase-added' : 'bcase-added is-zero'}>{line(got)}</span>} sub={sub} ratio={plan.hasGoal ? plan.ratio : null} />
              </button>
            </div>
          )
        })}
        <button className="bcase bcase-new" onClick={() => open({ type: 'account' })}><Icon name="plus" size={18} stroke={2} /> Sous-compte</button>
      </div>
      <p className="bsec-foot">L’argent arrive dans Épargne, puis « Répartir » le divise entre tes sous-comptes. Toucher un sous-compte : courbe, remettre dans Épargne, virer.</p>
    </section>
  )
}

// Le gros compte « Épargne » : tout ce que tu as mis de côté, dont l'argent libre (pas encore réparti).
const SHARE_TONES = ['var(--share-1)', 'var(--share-2)', 'var(--share-3)', 'var(--share-4)', 'var(--share-5)']
function MainCard({ main, envelopes, bal }) {
  const { data, period, open } = useBudget()
  const free = Math.round((bal[main.id] || 0) * 100) / 100
  const total = Math.round([main, ...envelopes].reduce((t, a) => t + (bal[a.id] || 0), 0) * 100) / 100
  const added = savedInPeriod(data.moves, period).saved
  const when = periodIn(period, data.today)
  const parts = envelopes.map((a) => ({ a, v: Math.max(0, bal[a.id] || 0) })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v)
  const sum = parts.reduce((t, x) => t + x.v, 0) + Math.max(0, free)
  const pct = (v) => (sum ? Math.round((v / sum) * 100) : 0)
  return (
    <div className="main-card">
      <button className="main-card-body" onClick={() => open({ type: 'totalDetail' })} aria-label={`${main.name} : ${euro(total)}, dont ${euro(free)} pas répartis. Ouvrir le détail`}>
        <span className="main-top"><span>{main.name}</span><span>{envelopes.length} sous-compte{envelopes.length > 1 ? 's' : ''}</span></span>
        <span className="main-value">{euro(total)}</span>
        <span className="main-sub">
          <span className={added ? 'main-added' : 'main-added is-zero'}>{added ? `${euro(added, { sign: true })} ${when}` : `rien ${when}`}</span>
          {' · '}dont <strong>{euro(free)}</strong> pas réparti{free > 1 ? 's' : ''}
        </span>
        {sum > 0 && (
          <>
            <span className="acc-share" aria-hidden="true">
              {parts.map((x, i) => <i key={x.a.id} style={{ width: `${(x.v / sum) * 100}%`, background: SHARE_TONES[Math.min(i, SHARE_TONES.length - 1)] }} />)}
              {free > 0 && <i className="is-free" style={{ width: `${(free / sum) * 100}%` }} />}
            </span>
            <span className="acc-share-legend">
              {parts.map((x, i) => <span key={x.a.id}><i style={{ background: SHARE_TONES[Math.min(i, SHARE_TONES.length - 1)] }} />{x.a.name} {pct(x.v)} %</span>)}
              {free > 0 && <span><i className="is-free" />Libre {pct(free)} %</span>}
            </span>
          </>
        )}
      </button>
      <div className="main-actions">
        <button className="main-btn is-light" onClick={() => open({ type: 'move', account: main })}><Icon name="plus" size={16} stroke={2.2} /> Mettre de côté</button>
        <button className="main-btn" onClick={() => open({ type: 'distribute' })} disabled={free <= 0 || !envelopes.length}>
          {envelopes.length ? `Répartir ${free > 0 ? euro(free) : ''}` : 'Crée un sous-compte pour répartir'}
        </button>
      </div>
    </div>
  )
}

function Subscriptions() {
  const { data, period, open } = useBudget()
  const active = data.subscriptions.filter((s) => s.active)
  const subsMonth = Math.round(active.reduce((t, s) => t + monthlyCost(s), 0) * 100) / 100
  const incMonth = Math.round(data.incomes.filter((r) => r.active).reduce((t, r) => t + Number(r.amount), 0) * 100) / 100
  const days = (k) => Math.round((parseDay(k) - parseDay(data.today)) / 86400000)
  const per = { weekly: 'semaine', monthly: 'mois', yearly: 'an' }
  const year = period.mode === 'year'
  const subsLine = year ? <><strong>{euro(Math.round(subsMonth * 12))}/an</strong> · {euro(subsMonth)}/mois</> : <><strong>{euro(subsMonth)}/mois</strong> · {euro(Math.round(subsMonth * 12))}/an</>
  const incLine = year ? `${euro(Math.round(incMonth * 12))}/an` : `${euro(incMonth)}/mois`
  const thisMonth = (r) => data.txs.some((t) => t.origin === 'recurring' && t.origin_id === r.id && t.date.slice(0, 7) === data.today.slice(0, 7))
  return (
    <section className="bsec bsec-subs" aria-labelledby="b-subs">
      <SectionHead id="b-subs" title="Abonnements et revenus" />
      <div className="budget-subs">
        <div>
          <p className="bsec-total">Abonnements {subsLine}</p>
          <ul className="group">
            {data.subscriptions.map((s) => {
              const d = days(s.next_date)
              return (
                <li key={s.id}>
                  <button className={s.active ? 'row tx-row' : 'row tx-row is-off'} onClick={() => open({ type: 'sub', item: s })}>
                    <IconTile name="abos" />
                    <span className="food-main">
                      <span className="food-name">{s.name}{!s.active && <span className="tag">En pause</span>}</span>
                      <span className={s.active && d <= 3 ? 'food-sub warn-text' : 'food-sub'}>
                        {s.active ? `Prochain : ${fmtShort.format(parseDay(s.next_date))}${d === 0 ? ' · aujourd’hui' : d === 1 ? ' · demain' : d <= 3 ? ` · dans ${d} jours` : ''}` : 'Ne sera plus compté'}
                      </span>
                    </span>
                    <span className="tx-amount">{euro(s.amount)}<span className="muted"> / {per[s.period]}</span></span>
                  </button>
                </li>
              )
            })}
            <li><button className="row row-action" onClick={() => open({ type: 'sub' })}><Icon name="plus" size={18} stroke={2} /> Abonnement</button></li>
          </ul>
        </div>
        <div>
          <p className="bsec-total">Revenus réguliers <strong>{incLine}</strong></p>
          <ul className="group">
            {data.incomes.map((r) => (
              <li key={r.id}>
                <button className={r.active ? 'row tx-row' : 'row tx-row is-off'} onClick={() => open({ type: 'income', item: r })}>
                  <IconTile name="revenus" />
                  <span className="food-main">
                    <span className="food-name">{r.name}</span>
                    <span className="food-sub">{thisMonth(r) ? 'Ajouté ce mois-ci ✓ · ' : ''}prochaine rentrée : {fmtShort.format(parseDay(r.next_date))}</span>
                  </span>
                  <span className="tx-amount pos">+ {euro(r.amount)}</span>
                </button>
              </li>
            ))}
            <li><button className="row row-action" onClick={() => open({ type: 'income' })}><Icon name="plus" size={18} stroke={2} /> Revenu régulier</button></li>
          </ul>
        </div>
      </div>
      <p className="group-foot">Chaque prélèvement et chaque revenu régulier s’ajoute tout seul le bon jour. Rappel 3 jours avant un prélèvement.</p>
    </section>
  )
}

/* ---------- Toutes les opérations (« Tout voir ») ---------- */

function AllOperations() {
  const { data, period } = useBudget()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const filter = params.get('categorie') || 'tout'
  const norm = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const nq = norm(q.trim())
  const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]))
  const list = data.txs
    .filter((t) => inPeriod(period, t.date) && (filter === 'tout' || (filter === 'revenus' ? t.kind === 'income' : t.category_id === filter)))
    .filter((t) => !nq || norm(`${t.merchant} ${t.note} ${catById[t.category_id]?.name || ''}`).includes(nq))
    .sort(byNewest)
  const byDay = new Map()
  for (const t of list) byDay.set(t.date, [...(byDay.get(t.date) || []), t])
  const total = list.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0)

  return (
    <>
      <div className="back-bar">
        <Link to="/budget" className="back-link"><Icon name="back" size={20} stroke={2} />Budget</Link>
      </div>
      <h1 className="large-title">Opérations</h1>
      <PeriodBar />
      <div className="search-bar">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Rechercher (commerçant, note…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une opération" />
      </div>
      <div className="chips left cat-chips">
        {[{ id: 'tout', name: 'Tout' }, ...data.categories.filter((c) => !c.archived), { id: 'revenus', name: 'Revenus', emoji: 'revenus' }].map((c) => (
          <button key={c.id} className={filter === c.id ? 'chip chip-icon is-on' : 'chip chip-icon'} onClick={() => setParams(c.id === 'tout' ? {} : { categorie: c.id })}>
            {c.id !== 'tout' && <BudgetIcon name={iconOf(c)} size={15} stroke={1.8} />}{c.name}
          </button>
        ))}
      </div>
      {!list.length && <p className="day-rest">Aucune opération{filter !== 'tout' || nq ? ' pour cette recherche' : ''} {periodIn(period, data.today)}.</p>}
      {[...byDay.entries()].map(([day, txs]) => (
        <section key={day}>
          <h2 className="group-title">{cap(fmtDay.format(parseDay(day)))}</h2>
          <ul className="group">{txs.map((t) => <TxRow key={t.id} t={t} />)}</ul>
        </section>
      ))}
      {list.length > 0 && <p className="group-foot">{list.length} opération{list.length > 1 ? 's' : ''} · solde de la sélection : {euro(total, { sign: true })}</p>}
    </>
  )
}

/* ---------- Comptes d'épargne (v0.27) ---------- */

function AccountSheets({ sheet, setSheet, data, period, done, close }) {
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
    return a ? <TransferSheet account={a} accounts={data.accounts} balance={bal[a.id] || 0} defaultTo={sheet.to} onDone={done} onClose={close} /> : null
  }
  if (sheet.type === 'accountDetail') {
    const a = fresh(sheet.item)
    if (!a) return null
    const back = { type: 'accountDetail', item: a }
    return <AccountDetail account={a} data={data} open={(s) => setSheet({ ...s, back })} onClose={() => setSheet(sheet.back || null)} />
  }
  if (sheet.type === 'distribute') {
    const { main, envelopes } = splitAccounts(data.accounts)
    return main ? <DistributeSheet main={main} envelopes={envelopes} bal={bal} onDone={done} onClose={close} /> : null
  }
  if (sheet.type === 'totalDetail') {
    const back = { type: 'totalDetail' }
    return <TotalDetail data={data} period={period} open={(s) => setSheet({ ...s, back })} onClose={() => setSheet(null)} />
  }
  return null
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
      <div className="back-bar">
        <Link to="/budget" className="back-link"><Icon name="back" size={20} stroke={2} />Budget</Link>
      </div>
      <h1 className="large-title">Réglages du budget</h1>
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
