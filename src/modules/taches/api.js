// Données de l'espace Tâches.
import { store } from '../../lib/store'
import { DEFAULT_CATEGORIES, reminderValid } from './logic'
import { scheduleReminderSync } from '../habitudes/native-sync'

export const TASK_TABLES = ['task_categories', 'task_projects', 'tasks']

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

// v0.30 : sans 019_projets.sql, pas de projets ni de rappels (on n'envoie pas ces colonnes)
let projectsReady = true
export async function loadTasks() {
  const [categories, tasks, projects] = await Promise.all([
    loadTaskCategories(),
    listTasks(),
    store.list('task_projects').then((p) => { projectsReady = true; return p }).catch((e) => {
      if (!missingTasksTable(e)) throw e
      projectsReady = false
      return null
    })
  ])
  return { categories, tasks, projects: projects || [], projectsMissing: !projects }
}

const clean = (t) => ({
  title: t.title.trim(),
  category_id: t.category_id || null,
  priority: Number(t.priority) || 2,
  planned_date: t.planned_date || null,
  time: t.planned_date && t.time ? t.time : null,
  duration_min: t.planned_date && t.time && t.duration_min ? Number(t.duration_min) : null,
  due_date: t.due_date || null,
  busy: !!(t.busy && t.time && t.planned_date),
  ...(projectsReady ? { project_id: t.project_id || null, reminder: reminderValid(t) ? String(t.reminder) : null } : {})
})

export async function saveTask(t) {
  const row = clean(t)
  const saved = t.id ? await store.update('tasks', t.id, row) : await store.insert('tasks', row)
  notifyTasks()
  scheduleReminderSync()
  return saved
}

export async function setTaskDone(t, done) {
  const saved = await store.update('tasks', t.id, { done, done_at: done ? new Date().toISOString() : null })
  notifyTasks()
  scheduleReminderSync()
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
  scheduleReminderSync()
}

/* ---------- Projets (v0.30) ---------- */

export async function saveProject(p) {
  const row = { name: p.name.trim(), color: p.color || 'blue', icon: p.icon || null, due_date: p.due_date || null, sort: Number(p.sort) || 0 }
  const saved = p.id ? await store.update('task_projects', p.id, row) : await store.insert('task_projects', row)
  notifyTasks()
  return saved
}

export async function setProjectDone(p, done) {
  const saved = await store.update('task_projects', p.id, { done, done_at: done ? new Date().toISOString() : null })
  notifyTasks()
  return saved
}

// Supprimer un projet garde ses tâches (elles n'ont simplement plus de projet).
export async function removeProject(id, tasks = []) {
  for (const t of tasks.filter((x) => x.project_id === id)) await store.update('tasks', t.id, { project_id: null })
  await store.remove('task_projects', id)
  notifyTasks()
}

export const saveTaskCategory = (c) =>
  c.id ? store.update('task_categories', c.id, { name: c.name, color: c.color, sort: c.sort }) : store.insert('task_categories', c)
export const removeTaskCategory = (id) => store.remove('task_categories', id)
