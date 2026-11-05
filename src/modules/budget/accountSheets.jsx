// Comptes d'épargne (v0.27) : créer / modifier un compte, mettre de côté, retirer, virer, détail avec courbe et historique.
import { useMemo, useState } from 'react'
import { LineChart } from '../../components/charts'
import { saveAccount, removeAccount, addMove, transfer, updateMove, removeMove } from './api'
import { parseAmount, round2 } from './logic'
import { accountEntries, balanceOf, balanceSeries, accountPlan } from './accounts'
import { euro } from './ui'
import { BudgetIcon, IconPicker, iconOf } from './icons'
import { Sheet, Confirm } from './sheets'
import { parseDay } from '../sport/planner'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtLong = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const dayLabel = (k) => cap(fmtDay.format(parseDay(k)))
const amountStr = (v) => String(Math.abs(Number(v) || 0)).replace('.', ',')

export const accIcon = (a) => iconOf(a, 'epargne')

// Texte sous le montant d'une case : objectif, rythme, ou « sans objectif »
export function planText(plan, account) {
  if (!plan.hasGoal) return 'sans objectif'
  const of = `sur ${euro(account.target)}`
  if (plan.reached) return `${of} · atteint`
  if (plan.late) return `${of} · date dépassée`
  if (plan.perWeek) return `${of} · ${euro(plan.perWeek)}/sem.`
  if (account.deadline) return `${of} · ${fmtLong.format(parseDay(account.deadline))}`
  return of
}

/* ---------- Créer / modifier un compte ---------- */

export function AccountSheet({ account, onDone, onClose }) {
  const [f, setF] = useState(() => ({
    name: '', emoji: null, target: '', deadline: '', initial: '',
    ...(account ? { ...account, emoji: accIcon(account), target: account.target == null ? '' : amountStr(account.target), deadline: account.deadline || '' } : {})
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // icône devinée d'après le nom (Vélo, Déco, Vacances…) tant que tu n'en choisis pas une
  const icon = f.emoji || iconOf({ name: f.name }, 'epargne')
  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Donne un nom au compte (Vacances, Vélo…).')
    const target = f.target === '' ? null : parseAmount(f.target)
    if (f.deadline && !target) return setError('Une date sans montant ne sert à rien : indique aussi le montant visé, ou vide la date.')
    setBusy(true)
    await saveAccount({ ...f, emoji: icon, target }, { initial: parseAmount(f.initial), date: todayKey() })
    onDone()
  }

  return (
    <Sheet title="Compte" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title sheet-title-icon">{account && <BudgetIcon name={accIcon(account)} size={20} />} {account ? account.name : 'Nouveau compte'}</p>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="a-n">Nom</label>
            <input id="a-n" autoFocus={!account} placeholder="Vacances, Vélo, Déco…" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </li>
          {!account && (
            <li className="row row-field">
              <label className="row-label" htmlFor="a-i">Déjà dedans (€)</label>
              <input id="a-i" inputMode="decimal" placeholder="0" value={f.initial} onChange={(e) => setF({ ...f, initial: e.target.value })} />
            </li>
          )}
        </ul>
        <p className="group-title">Objectif <span className="title-hint">· facultatif</span></p>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="a-t">Montant visé (€)</label>
            <input id="a-t" inputMode="decimal" placeholder="aucun" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          </li>
          <li className="row row-field">
            <label className="row-label" htmlFor="a-d">Pour le</label>
            <input id="a-d" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
          </li>
        </ul>
        <p className="group-foot">Avec un montant et une date, l’app calcule combien mettre de côté par semaine.</p>
        <IconPicker value={icon} onChange={(k) => setF({ ...f, emoji: k })} />
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>{account ? 'Enregistrer' : 'Créer le compte'}</button>
        {account && (
          <Confirm label="Supprimer le compte" onConfirm={async () => { await removeAccount(account.id); onDone() }} />
        )}
        {account && <p className="group-foot">Supprimer efface ses mouvements ; les dépenses payées avec ce compte repassent dans le budget de leur mois.</p>}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Mettre de côté / retirer (nouveau ou correction) ---------- */

export function MoveSheet({ account, balance, move, startWithdraw = false, onDone, onClose }) {
  const editing = !!move
  const isTransfer = move?.kind === 'transfer'
  const [withdraw, setWithdraw] = useState(editing ? Number(move.amount) < 0 : startWithdraw)
  const [f, setF] = useState(() => ({ amount: editing ? amountStr(move.amount) : '', date: move?.date || todayKey(), note: move?.note || '' }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // solde sans ce mouvement (pour vérifier qu'on ne descend pas sous 0)
  const without = round2(balance - (editing ? Number(move.amount) : 0))

  async function submit(e) {
    e.preventDefault()
    const a = parseAmount(f.amount)
    if (!a) return setError('Indique un montant.')
    const signed = withdraw ? -a : a
    if (without + signed < 0) return setError(`Il n’y a que ${euro(without)} dans ${account.name}.`)
    setBusy(true)
    if (editing) await updateMove(move, { amount: a, date: f.date, note: f.note })
    else await addMove({ account_id: account.id, amount: signed, date: f.date, note: f.note })
    onDone()
  }

  return (
    <Sheet title="Mouvement" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title sheet-title-icon"><BudgetIcon name={accIcon(account)} size={20} /> {account.name} <span className="sheet-sub">· {euro(balance)}</span></p>
        {!isTransfer && move?.kind !== 'initial' && (
          <div className="segmented tx-kind">
            <button type="button" className={!withdraw ? 'is-on' : ''} onClick={() => setWithdraw(false)}>Mettre de côté</button>
            <button type="button" className={withdraw ? 'is-on' : ''} onClick={() => setWithdraw(true)}>Retirer</button>
          </div>
        )}
        {isTransfer && <p className="group-foot">Virement : les deux comptes sont corrigés ensemble.</p>}
        <label className="amount-input">
          <input inputMode="decimal" autoFocus={!editing} placeholder="0" value={f.amount} onChange={(e) => { setError(''); setF({ ...f, amount: e.target.value.replace(/[^\d,.]/g, '') }) }} aria-label="Montant" />
          <span>€</span>
        </label>
        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="m-d">Date</label><input id="m-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="m-n">Note</label><input id="m-n" placeholder="facultatif" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></li>
        </ul>
        {withdraw && !editing && <p className="group-foot">Retirer sans dépense (ex. remettre l’argent sur ton compte courant) diminue « Épargné » du mois. Pour payer quelque chose avec ce compte, ajoute plutôt une dépense « payée avec » {account.name}.</p>}
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>{editing ? 'Enregistrer' : withdraw ? 'Retirer' : 'Mettre de côté'}</button>
        {editing && <Confirm label={isTransfer ? 'Supprimer le virement' : 'Supprimer le mouvement'} onConfirm={async () => { await removeMove(move); onDone() }} />}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Virer vers un autre compte ---------- */

export function TransferSheet({ account, accounts, balance, onDone, onClose }) {
  const others = accounts.filter((a) => a.id !== account.id)
  const [to, setTo] = useState(others[0]?.id || '')
  const [f, setF] = useState({ amount: '', date: todayKey(), note: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const a = parseAmount(f.amount)
    if (!to) return setError('Choisis le compte qui reçoit.')
    if (!a) return setError('Indique un montant.')
    if (a > balance) return setError(`Il n’y a que ${euro(balance)} dans ${account.name}.`)
    setBusy(true)
    await transfer({ from: account.id, to, amount: a, date: f.date, note: f.note })
    onDone()
  }
  return (
    <Sheet title="Virer" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="sheet-title sheet-title-icon"><BudgetIcon name={accIcon(account)} size={20} /> Virer depuis {account.name} <span className="sheet-sub">· {euro(balance)}</span></p>
        {!others.length ? (
          <p className="muted-line">Crée d’abord un deuxième compte pour pouvoir y virer de l’argent.</p>
        ) : (
          <>
            <p className="group-title">Vers</p>
            <div className="chips left" role="radiogroup" aria-label="Vers">
              {others.map((a) => (
                <button type="button" key={a.id} role="radio" aria-checked={to === a.id} className={to === a.id ? 'chip chip-icon is-on' : 'chip chip-icon'} onClick={() => setTo(a.id)}>
                  <BudgetIcon name={accIcon(a)} size={15} stroke={1.8} />{a.name}
                </button>
              ))}
            </div>
            <label className="amount-input">
              <input inputMode="decimal" autoFocus placeholder="0" value={f.amount} onChange={(e) => { setError(''); setF({ ...f, amount: e.target.value.replace(/[^\d,.]/g, '') }) }} aria-label="Montant" />
              <span>€</span>
            </label>
            <ul className="group">
              <li className="row row-field"><label className="row-label" htmlFor="v-d">Date</label><input id="v-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></li>
              <li className="row row-field"><label className="row-label" htmlFor="v-n">Note</label><input id="v-n" placeholder="facultatif" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></li>
            </ul>
            <p className="group-foot">Un virement entre tes comptes ne change pas « Épargné » du mois.</p>
            {error && <p className="group-foot is-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy}>Virer</button>
          </>
        )}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- Détail d'un compte ---------- */

export function AccountDetail({ account, data, open, onClose }) {
  const accById = useMemo(() => Object.fromEntries(data.accounts.map((a) => [a.id, a])), [data.accounts])
  const entries = useMemo(() => accountEntries(account.id, data.moves, data.txs, accById), [account.id, data.moves, data.txs, accById])
  const balance = balanceOf(entries)
  const plan = accountPlan(account, balance, data.today)
  const series = balanceSeries(entries)
  const showChart = series.length >= 2 || (series.length === 1 && series[0].date < data.today)
  const points = series.length === 1 ? [series[0], { date: data.today, value: series[0].value }] : series.length && series[series.length - 1].date < data.today ? [...series, { date: data.today, value: series[series.length - 1].value }] : series

  let planLine = null
  if (plan.hasGoal) {
    if (plan.reached) planLine = <>Objectif de {euro(account.target)} atteint.</>
    else if (plan.late) planLine = <>Objectif {euro(account.target)} pour le {fmtLong.format(parseDay(account.deadline))} : date dépassée, encore {euro(plan.left)}.</>
    else if (account.deadline) planLine = <>Objectif {euro(account.target)} pour le {fmtLong.format(parseDay(account.deadline))} · encore {euro(plan.left)} : <strong>{euro(plan.perWeek)} par semaine</strong></>
    else planLine = <>Objectif {euro(account.target)} · encore {euro(plan.left)}</>
  }

  return (
    <Sheet title={account.name} onClose={onClose}>
      <p className="sheet-title sheet-title-icon"><BudgetIcon name={accIcon(account)} size={20} /> {account.name}</p>
      <p className="acc-balance">{euro(balance)}</p>
      {plan.hasGoal && <div className={plan.reached ? 'cat-detail-bar is-done' : 'cat-detail-bar'}><span style={{ width: `${plan.ratio * 100}%` }} /></div>}
      {planLine && <p className="cat-detail-sub">{planLine}</p>}

      {showChart && (
        <div className="acc-chart">
          <LineChart
            ariaLabel={`Solde de ${account.name}`}
            height={150}
            zero
            format={(v) => euro(Math.round(v))}
            series={[{ name: 'Solde', color: 'var(--text)', points }]}
          />
        </div>
      )}

      <div className="acc-actions">
        <button className="btn-primary" onClick={() => open({ type: 'move', account })}>+ Mettre de côté</button>
        <button className="btn-secondary" onClick={() => open({ type: 'move', account, withdraw: true })} disabled={balance <= 0}>Retirer</button>
        <button className="btn-secondary" onClick={() => open({ type: 'transfer', account })} disabled={balance <= 0}>Virer</button>
      </div>

      <p className="group-title">Mouvements</p>
      {entries.length ? (
        <ul className="group">
          {entries.map((e) => (
            <li key={e.key}>
              <button className="row tx-row" onClick={() => (e.type === 'spend' ? open({ type: 'tx', item: e.tx }) : open({ type: 'move', account, move: e.move }))}>
                <span className="food-main">
                  <span className="food-name">{e.label}</span>
                  <span className="food-sub">{dayLabel(e.date)}{e.type === 'spend' ? ' · payé avec ce compte' : ''}{e.note ? ` · « ${e.note} »` : ''}</span>
                </span>
                <span className={e.amount >= 0 ? 'tx-amount pos' : 'tx-amount'}>{e.kind === 'initial' ? euro(e.amount) : euro(e.amount, { sign: true })}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-line">Pas encore de mouvement. « Mettre de côté » pour commencer.</p>
      )}
      <button className="btn-secondary" onClick={() => open({ type: 'account', item: account })}>Modifier le compte (nom, icône, objectif)</button>
      <button className="btn-plain" onClick={onClose}>Fermer</button>
    </Sheet>
  )
}

