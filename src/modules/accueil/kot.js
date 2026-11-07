// Données de « Retour au kot » (table kot_items, 020_retour_kot.sql).
import { store } from '../../lib/store'
import { scheduleReminderSync } from '../habitudes/native-sync'
import { splitKot } from './kot-logic'

export const missingKotTable = (e) => /relation|does not exist|schema cache|kot_items/i.test(e?.message || '')

const changed = () => { scheduleReminderSync(); window.dispatchEvent(new Event('life:kot')) }

/** Les choses du dimanche visé ; efface au passage celles d'un dimanche passé. */
export async function loadKot(now = new Date()) {
  const all = await store.list('kot_items')
  const { sunday, current, stale } = splitKot(all, now)
  if (stale.length) Promise.all(stale.map((x) => store.remove('kot_items', x.id))).catch(() => {})
  return { sunday, items: current }
}

export async function addKot(title, sunday) {
  const row = await store.insert('kot_items', { title: title.trim(), sunday, done: false })
  changed()
  return row
}

export async function setKotDone(item, done) {
  const row = await store.update('kot_items', item.id, { done, done_at: done ? new Date().toISOString() : null })
  changed()
  return row
}

export async function removeKot(id) {
  await store.remove('kot_items', id)
  changed()
}
