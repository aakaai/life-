import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FoodPicker from './FoodPicker'
import QuantitySheet from './QuantitySheet'
import ScanSheet from './ScanSheet'
import FoodForm from './FoodForm'
import { addLog, setFavorite, lastGramsFor, findByBarcode, saveFood, foodItem, loadSettings } from './api'
import { lookupBarcode } from './off'
import { mealInfo, mealForTime } from './data'
import { BackBar } from '../sport/ui'
import { keyOf } from '../sport/planner'

// Ajouter un aliment au journal : recherche, scan ou création.
export default function AddFood() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const date = params.get('date') || keyOf(new Date())
  const meal = params.has('repas') ? Number(params.get('repas')) : mealForTime()
  const fromHome = params.get('retour') === 'accueil' // ouvert depuis la case « Prochain repas » : on y revient
  const [picked, setPicked] = useState(null) // { item, grams }
  const [scanning, setScanning] = useState(false)
  const [form, setForm] = useState(null) // { initial, message }
  const [status, setStatus] = useState('')
  const [excludeFish, setExcludeFish] = useState(true)

  useEffect(() => {
    loadSettings().then((s) => setExcludeFish(s.exclude_fish !== false))
  }, [])

  async function pick(item) {
    const grams = item.lastGrams ?? (await lastGramsFor(item.ref))
    setPicked({ item, grams: grams ?? undefined })
  }

  async function onCode(code) {
    setScanning(false)
    setStatus(`Code ${code} : recherche du produit…`)
    try {
      const mine = await findByBarcode(code)
      if (mine) {
        setStatus('')
        return pick(foodItem(mine))
      }
      const res = await lookupBarcode(code)
      if (res.found && res.complete) {
        const saved = await saveFood(res.food)
        setStatus('')
        return pick(foodItem(saved))
      }
      setStatus('')
      setForm({
        initial: res.found ? res.food : { source: 'off', code },
        message: res.found
          ? 'Ce produit est incomplet dans Open Food Facts : recopie les valeurs de l’étiquette. L’app s’en souviendra.'
          : 'Produit inconnu d’Open Food Facts : recopie les valeurs de l’étiquette une fois, l’app s’en souviendra.'
      })
    } catch (e) {
      setStatus(e.message)
      setForm({ initial: { source: 'off', code }, message: `${e.message} Tu peux aussi recopier l’étiquette.` })
    }
  }

  return (
    <div className="page food">
      <BackBar to={fromHome ? '/' : '/alimentation'} label={fromHome ? 'Accueil' : 'Aujourd’hui'} />
      <h1 className="large-title">Ajouter</h1>
      <p className="muted-line add-for">
        {mealInfo(meal).name}
        {date !== keyOf(new Date()) && ` · ${new Date(`${date}T12:00`).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      </p>
      {status && <p className="group-foot" role="status">{status}</p>}

      <FoodPicker
        onPick={pick}
        onScan={() => setScanning(true)}
        onCreate={(q) => setForm({ initial: { name: q } })}
        excludeFish={excludeFish}
      />

      {picked && (
        <QuantitySheet
          item={picked.item}
          grams={picked.grams}
          meal={meal}
          onClose={() => setPicked(null)}
          onFavorite={picked.item.source === 'ingredient' ? undefined : (fav) => setFavorite(picked.item, fav)}
          onSubmit={async ({ grams, meal: m }) => {
            await addLog({ item: picked.item, grams, meal: m, date })
            navigate(fromHome ? '/' : `/alimentation?date=${date}`)
          }}
        />
      )}
      {scanning && <ScanSheet onCode={onCode} onClose={() => setScanning(false)} />}
      {form && (
        <FoodForm
          initial={form.initial}
          message={form.message}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null)
            pick(foodItem(saved))
          }}
        />
      )}
    </div>
  )
}
