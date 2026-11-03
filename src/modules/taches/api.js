// Données de l'espace Tâches.
import { store } from '../../lib/store'
import { DEFAULT_CATEGORIES } from './logic'

export const TASK_TABLES = ['task_categories', 'tasks']

export const missingTasksTable = (e) => /relation|does not exist|schema cache|task/i.test(e?.message || '')

// Prévenir les autres blocs (accueil, calendriers) qu'une tâche a changé.
export const notifyTasks = () => window.dispatchEvent(new Event('life:changed'))

let seeding = null
export async function loadTaskCategories() {
  const cats = await store.list('task_categories', { orderBy: 'sort' })
  if (cats.length) return cats
  seeding = seeding || store.insertMany('task_categories', DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort: i })))
  try {
    await seeding
  } finally {
    seeding = null
  }
  return store.list('task_categories', { orderBy: 'sort' })
}

export const listTasks = () => store.list('tasks')

export async function loadTasks() {
  const [categories, tasks] = await Promise.all([loadTaskCategories(), listTasks()])
  return { categories, tasks }
}

const clean = (t) => ({
  title: t.title.trim(),
  category_id: t.category_id || null,
  priority: Number(t.priority) || 2,
  planned_date: t.planned_date || null,
  time: t.planned_date && t.time ? t.time : null,
  duration_min: t.planned_date && t.time && t.duration_min ? Number(t.duration_min) : null,
  due_date: t.due_date || null,
  busy: !!(t.busy && t.time && t.planned_date)
})

export async function saveTask(t) {
  const row = clean(t)
  const saved = t.id ? await store.update('tasks', t.id, row) : await store.insert('tasks', row)
  notifyTasks()
  return saved
}

export async function setTaskDone(t, done) {
  const saved = await store.update('tasks', t.id, { done, done_at: done ? new Date().toISOString() : null })
  notifyTasks()
  return saved
}

export async function moveTask(t, patch) {
  const saved = await store.update('tasks', t.id, patch)
  notifyTasks()
  return saved
}

export async function removeTask(id) {
  await store.remove('tasks', id)
  notifyTasks()
}

export const saveTaskCategory = (c) =>
  c.id ? store.update('task_categories', c.id, { name: c.name, color: c.color, sort: c.sort }) : store.insert('task_categories', c)
export const removeTaskCategory = (id) => store.remove('task_categories', id)
