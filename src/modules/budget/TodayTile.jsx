import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadBudget } from './api'
import { monthSummary, monthKey, upcomingRenewals } from './logic'
import { euro } from './ui'

// Bloc « Budget » de l'accueil : reste à dépenser du mois et renouvellements proches.
export default function TodayTile() {
  const [data, setData] = useState(null)
  useEffect(() => {
    loadBudget().then(setData).catch(() => setData(null))
  }, [])
  if (!data?.categories.length) return null
  const sum = monthSummary({ txs: data.txs, categories: data.categories, subscriptions: data.subscriptions, mk: monthKey(data.today) })
  const renew = upcomingRenewals(data.subscriptions, data.today, 3)[0]
  const level = !sum.totalBudget ? 'ok' : sum.left < 0 ? 'over' : sum.left < sum.totalBudget * 0.2 ? 'warn' : 'ok'
  return (
    <section aria-labelledby="today-budget">
      <h2 id="today-budget" className="group-title">Budget du mois</h2>
      <Link to="/budget" className="food-tile">
        <span className="food-tile-main">
          {sum.totalBudget ? (
            <span><strong className={`budget-left is-${level}`}>{euro(sum.left)}</strong> à dépenser ce mois-ci</span>
          ) : (
            <span><strong>{euro(sum.expenses)}</strong> dépensés ce mois-ci</span>
          )}
          {sum.rows.filter((r) => r.level === 'over' || r.level === 'warn').slice(0, 2).map((r) => (
            <span key={r.cat.id}>{r.cat.name} : {r.level === 'over' ? 'dépassé' : 'plus de 80 %'}</span>
          ))}
          {renew && <span className="food-tile-tip">{renew.name} se renouvelle bientôt ({euro(renew.amount)})</span>}
        </span>
        <span className="row-chevron">›</span>
      </Link>
    </section>
  )
}
