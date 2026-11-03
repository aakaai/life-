import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { saveTransaction, removeTransaction, saveSubscription, removeSubscription, saveIncome, removeIncome, saveGoal, removeGoal, saveCategory } from './api'
import { parseAmount, guessCategory, frequentShortcuts, knownMerchants, INCOME_SOURCES, nextDate } from './logic'
import { euro } from './ui'
import { BudgetIcon, IconPicker, iconOf } from './icons'
import { isOver, caseText } from './CategoryGrid'
import { monthKey } from './logic'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Sheet({ title, children, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function Confirm({ label, onConfirm }) {
  const [sure, setSure] = useState(false)
  return (
    <button type="button" className="btn-plain danger" onClick={() => (sure ? onConfirm() : setSure(true))}>
      {sure ? 'Confirmer la suppression' : label}
    </button>
  )
}

/* ---------- Dépense ou revenu ---------- */

export function TxSheet({ tx, data, onDone, onClose, defaultCategory }) {
  const cats = data.categories.filter((c) => !c.archived)
  const [f, setF] = useState(() => ({
    kind: 'expense', amount: '', merchant: '', category_id: defaultCategory || '', date: today(), note: '',
    ...(tx ? { ...tx, amount: String(tx.amount).replace('.', ','), note: tx.note || '', merchant: tx.merchant || '', category_id: tx.category_id || '' } : {})
  }))
  const [touchedCat, setTouchedCat] = useState(!!tx || !!defaultCategory)
  const [error, setError] = useState('')
  const shortcuts = useMemo(() => (tx ? [] : frequentShortcuts(data.txs)), [data.txs, tx])
  const merchants = useMemo(() => knownMerchants(data.txs, f.kind), [data.txs, f.kind])

  const setMerchant = (m) => {
    const guess = guessCategory(data.txs, m)
    setF((x) => ({ ...x, merchant: m, category_id: !touchedCat && guess ? guess : x.category_id }))
  }

  async function submit(e) {
    e?.preventDefault()
    const amount = parseAmount(f.amount)
    if (!amount) return setError('Indique un montant.')
    if (f.kind === 'expense' && !f.category_id) return setError('Choisis une catégorie.')
    await saveTransaction({ ...f, amount })
    onDone()
  }

  return (
    <Sheet title="Opération" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="segmented tx-kind" role="radiogroup" aria-label="Type">
          {[['expense', 'Dépense'], ['income', 'Revenu']].map(([k, l]) => (
            <button type="button" key={k} role="radio" aria-checked={f.kind === k} className={f.kind === k ? 'is-on' : ''} onClick={() => setF({ ...f, kind: k })}>{l}</button>
          ))}
        </div>
        <label className="amount-input">
          <input
            inputMode="decimal"
            autoFocus={!tx}
            placeholder="0"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d,.]/g, '') })}
            aria-label="Montant"
          />
          <span>€</span>
        </label>

        {shortcuts.length > 0 && f.kind === 'expense' && (
          <div className="chips">
            {shortcuts.map((s) => (
              <button type="button" key={`${s.merchant}${s.amount}`} className="chip" onClick={() => { setF({ ...f, amount: String(s.amount).replace('.', ','), merchant: s.merchant, category_id: s.category_id || f.category_id }); setTouchedCat(true) }}>
                {s.merchant} · {euro(s.amount)}
              </button>
            ))}
          </div>
        )}

        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="tx-m">{f.kind === 'income' ? 'Source' : 'Où ?'}</label>
            <input id="tx-m" list="tx-merchants" placeholder={f.kind === 'income' ? 'Job étudiant' : 'Colruyt, café…'} value={f.merchant} onChange={(e) => setMerchant(e.target.value)} autoComplete="off" />
            <datalist id="tx-merchants">{merchants.slice(0, 30).map((m) => <option key={m} value={m} />)}</datalist>
          </li>
        </ul>
        {f.kind === 'income' && (
          <div className="chips left">
            {INCOME_SOURCES.map((s) => <button type="button" key={s} className={f.merchant === s ? 'chip is-on' : 'chip'} onClick={() => setF({ ...f, merchant: s })}>{s}</button>)}
          </div>
        )}

        {f.kind === 'expense' && (
          <div className="cat-grid" role="radiogroup" aria-label="Catégorie">
            {cats.map((c) => (
              <button
                type="button"
                key={c.id}
                role="radio"
                aria-checked={f.category_id === c.id}
                className={f.category_id === c.id ? 'cat-pick is-on' : 'cat-pick'}
                style={{ '--c': `var(--${c.color})` }}
                onClick={() => { setF({ ...f, category_id: c.id }); setTouchedCat(true) }}
              >
                <BudgetIcon name={iconOf(c)} size={20} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        )}

        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="tx-d">Date</label>
            <input id="tx-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </li>
          <li className="row row-field">
            <label className="row-label" htmlFor="tx-n">Note</label>
            <input id="tx-n" placeholder="facultatif" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </li>
        </ul>
        {tx?.origin === 'subscription' && <p className="group-foot">Ajouté automatiquement par l’abonnement « {tx.merchant} ».</p>}
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">{tx ? 'Enregistrer' : f.kind === 'income' ? 'Ajouter le revenu' : 'Ajouter la dépense'}</button>
        {tx && <Confirm label="Supprimer l’opération" onConfirm={async () => { await removeTransaction(tx.id); onDone() }} />}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Abonnement ---------- */

export function SubscriptionSheet({ sub, onDone, onClose }) {
  const d = new Date()
  const [f, setF] = useState(() => ({
    name: '', amount: '', period: 'monthly', next_date: nextDate(today(), 'monthly'), active: true,
    ...(sub ? { ...sub, amount: String(sub.amount).replace('.', ',') } : {})
  }))
  const [error, setError] = useState('')
  void d
  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Donne un nom à l’abonnement.')
    if (!parseAmount(f.amount)) return setError('Indique le montant.')
    if (!sub && f.next_date <= today()) return setError('Indique la date du PROCHAIN prélèvement (après aujourd’hui).')
    await saveSubscription({ ...f, amount: parseAmount(f.amount) })
    onDone()
  }
  return (
    <Sheet title="Abonnement" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title">{sub ? sub.name : 'Nouvel abonnement'}</p>
        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="s-n">Nom</label><input id="s-n" autoFocus={!sub} placeholder="Zwift, téléphone…" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="s-a">Montant (€)</label><input id="s-a" inputMode="decimal" placeholder="19,99" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></li>
          <li className="row">
            <span className="row-label">Fréquence</span>
            <div className="segmented small">
              {[['weekly', 'Semaine'], ['monthly', 'Mois'], ['yearly', 'An']].map(([k, l]) => (
                <button type="button" key={k} className={f.period === k ? 'is-on' : ''} onClick={() => setF({ ...f, period: k })}>{l}</button>
              ))}
            </div>
          </li>
          <li className="row row-field"><label className="row-label" htmlFor="s-d">Prochain prélèvement</label><input id="s-d" type="date" value={f.next_date} onChange={(e) => setF({ ...f, next_date: e.target.value })} /></li>
          {sub && (
            <li className="row">
              <label className="switch">
                <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
                <span aria-hidden="true" />
                <span className="row-label">Actif</span>
              </label>
            </li>
          )}
        </ul>
        <p className="group-foot">Le jour du prélèvement, la dépense s’ajoute toute seule dans la catégorie Abonnements. L’app te prévient 3 jours avant.</p>
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">Enregistrer</button>
        {sub && <Confirm label="Supprimer l’abonnement" onConfirm={async () => { await removeSubscription(sub.id); onDone() }} />}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Revenu régulier ---------- */

export function IncomeSheet({ income, onDone, onClose }) {
  const [f, setF] = useState(() => ({
    name: '', amount: '', next_date: nextDate(today(), 'monthly'), active: true,
    ...(income ? { ...income, amount: String(income.amount).replace('.', ',') } : {})
  }))
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Indique la source.')
    if (!parseAmount(f.amount)) return setError('Indique le montant.')
    await saveIncome({ ...f, amount: parseAmount(f.amount) })
    onDone()
  }
  return (
    <Sheet title="Revenu régulier" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title">{income ? income.name : 'Revenu régulier'}</p>
        <div className="chips left">
          {INCOME_SOURCES.slice(0, 2).map((s) => <button type="button" key={s} className={f.name === s ? 'chip is-on' : 'chip'} onClick={() => setF({ ...f, name: s })}>{s}</button>)}
        </div>
        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="i-n">Source</label><input id="i-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="i-a">Montant par mois (€)</label><input id="i-a" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="i-d">Prochaine rentrée</label><input id="i-d" type="date" value={f.next_date} onChange={(e) => setF({ ...f, next_date: e.target.value })} /></li>
          {income && (
            <li className="row">
              <label className="switch">
                <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
                <span aria-hidden="true" />
                <span className="row-label">Actif</span>
              </label>
            </li>
          )}
        </ul>
        <p className="group-foot">Ajouté tout seul chaque mois à cette date. Les revenus ponctuels se notent avec le bouton +.</p>
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">Enregistrer</button>
        {income && <Confirm label="Supprimer" onConfirm={async () => { await removeIncome(income.id); onDone() }} />}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Objectif d'épargne ---------- */

export function GoalSheet({ goal, onDone, onClose }) {
  const [f, setF] = useState(() => ({
    name: '', emoji: 'objectif', target: '', saved: '', deadline: '',
    ...(goal ? { ...goal, emoji: iconOf(goal, 'objectif'), target: String(goal.target).replace('.', ','), saved: String(goal.saved).replace('.', ','), deadline: goal.deadline || '' } : {})
  }))
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Donne un nom à l’objectif.')
    if (!parseAmount(f.target)) return setError('Indique le montant à atteindre.')
    await saveGoal({ ...f, target: parseAmount(f.target), saved: parseAmount(f.saved) })
    onDone()
  }
  return (
    <Sheet title="Objectif" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title">{goal ? goal.name : 'Nouvel objectif'}</p>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="g-n">Nom</label>
            <input id="g-n" autoFocus={!goal} placeholder="Voyage Thaïlande" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </li>
          <li className="row row-field"><label className="row-label" htmlFor="g-t">Montant à atteindre (€)</label><input id="g-t" inputMode="decimal" placeholder="1000" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="g-d">Pour le</label><input id="g-d" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="g-s">Déjà mis de côté (€)</label><input id="g-s" inputMode="decimal" placeholder="0" value={f.saved} onChange={(e) => setF({ ...f, saved: e.target.value })} /></li>
        </ul>
        <IconPicker value={f.emoji} onChange={(k) => setF({ ...f, emoji: k })} />
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">Enregistrer</button>
        {goal && <Confirm label="Supprimer l’objectif" onConfirm={async () => { await removeGoal(goal.id); onDone() }} />}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

export function DepositSheet({ goal, onDone, onClose }) {
  const [v, setV] = useState('')
  const [withdraw, setWithdraw] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const a = parseAmount(v)
    if (!a) return
    await saveGoal({ ...goal, saved: Math.max(0, Number(goal.saved) + (withdraw ? -a : a)) })
    onDone()
  }
  return (
    <Sheet title="Mettre de côté" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title sheet-title-icon"><BudgetIcon name={iconOf(goal, 'objectif')} size={20} /> {goal.name}</p>
        <div className="segmented tx-kind">
          <button type="button" className={!withdraw ? 'is-on' : ''} onClick={() => setWithdraw(false)}>Ajouter</button>
          <button type="button" className={withdraw ? 'is-on' : ''} onClick={() => setWithdraw(true)}>Retirer</button>
        </div>
        <label className="amount-input">
          <input inputMode="decimal" autoFocus placeholder="0" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d,.]/g, ''))} aria-label="Montant" />
          <span>€</span>
        </label>
        <button className="btn-primary" type="submit">{withdraw ? 'Retirer' : 'Mettre de côté'}</button>
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Catégorie ---------- */

export function CategorySheet({ cat, onDone, onClose }) {
  const [f, setF] = useState(() => ({
    name: '', emoji: 'divers', color: 'gray', monthly_budget: '', kind: 'normal',
    ...(cat ? { ...cat, emoji: iconOf(cat), monthly_budget: cat.monthly_budget == null ? '' : String(cat.monthly_budget).replace('.', ',') } : {})
  }))
  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return
    await saveCategory({ ...f, monthly_budget: f.monthly_budget === '' ? null : parseAmount(f.monthly_budget) })
    onDone()
  }
  return (
    <Sheet title="Catégorie" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title sheet-title-icon">{cat && <BudgetIcon name={iconOf(cat)} size={20} />} {cat ? cat.name : 'Nouvelle catégorie'}</p>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="c-n">Nom</label>
            <input id="c-n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </li>
          {f.kind === 'subscriptions' ? (
            <li className="row"><span className="row-label">Budget par mois</span><span className="row-value">calculé d’après tes abonnements</span></li>
          ) : (
            <li className="row row-field">
              <label className="row-label" htmlFor="c-b">Budget par mois (€)</label>
              <input id="c-b" inputMode="decimal" autoFocus={!!cat} placeholder="pas de plafond" value={f.monthly_budget} onChange={(e) => setF({ ...f, monthly_budget: e.target.value })} />
            </li>
          )}
        </ul>
        <IconPicker value={f.emoji} onChange={(k) => setF({ ...f, emoji: k })} />
        <button className="btn-primary" type="submit">Enregistrer</button>
        {cat && f.kind !== 'subscriptions' && (
          <button type="button" className="btn-plain danger" onClick={async () => { await saveCategory({ ...f, archived: !cat.archived }); onDone() }}>
            {cat.archived ? 'Réactiver la catégorie' : 'Masquer la catégorie'}
          </button>
        )}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Détail d'une catégorie (toucher une case du mois) ---------- */

const fmtTxDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
export function CategoryDetail({ row, month, txs, onAdd, onEditTx, onEditCat, onClose }) {
  const t = caseText(row)
  const over = isOver(row)
  const list = txs.filter((x) => x.kind !== 'income' && x.category_id === row.cat.id && monthKey(x.date) === month)
  return (
    <Sheet title={row.cat.name} onClose={onClose}>
      <p className="sheet-title sheet-title-icon"><BudgetIcon name={iconOf(row.cat)} size={20} /> {row.cat.name}</p>
      <p className={over ? 'cat-detail-amt is-over' : 'cat-detail-amt'}>{t.main}{t.unit && <small> {t.unit}</small>}</p>
      <p className="cat-detail-sub">{t.sub}{row.cat.kind === 'subscriptions' ? ' · budget = tes abonnements' : ''}</p>
      {row.budget != null && <div className={over ? 'cat-detail-bar is-over' : 'cat-detail-bar'}><span style={{ width: `${Math.min(1, row.spent / (row.budget || 1)) * 100}%` }} /></div>}
      {list.length ? (
        <ul className="group">
          {list.map((x) => (
            <li key={x.id}>
              <button className="row tx-row" onClick={() => onEditTx(x)}>
                <span className="food-main">
                  <span className="food-name">{x.merchant || x.note || row.cat.name}</span>
                  <span className="food-sub">{fmtTxDay.format(new Date(`${x.date}T12:00`))}{x.origin === 'subscription' ? ' · abonnement automatique' : ''}</span>
                </span>
                <span className="tx-amount">− {euro(x.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-line">Aucune dépense dans cette catégorie ce mois-ci.</p>
      )}
      <button className="btn-primary" onClick={onAdd}>Ajouter une dépense</button>
      <button className="btn-secondary" onClick={onEditCat}>Modifier la catégorie et le budget</button>
      <button className="btn-plain" onClick={onClose}>Fermer</button>
    </Sheet>
  )
}

export { Icon }
