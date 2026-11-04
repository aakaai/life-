// Widget iPhone : clé privée et publication du résumé de la journée (table widget_feed, 015_widget.sql).
import { supabase, isCloud } from '../../lib/supabase'
import { currentUserId } from '../../lib/store'
import { buildFeed } from './feed'

export const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/widget`
export const missingWidgetTable = (e) => /widget_feed|relation|does not exist|schema cache/i.test(e?.message || '')

export async function sha256Hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

// 32 octets aléatoires en base64url (43 caractères)
export function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function widgetStatus() {
  if (!isCloud) return { available: false }
  const { data, error } = await supabase.from('widget_feed').select('updated_at').maybeSingle()
  if (error) return { available: true, missingTable: missingWidgetTable(error), error: error.message }
  return { available: true, hasKey: !!data, updatedAt: data?.updated_at || null }
}

// Nouvelle clé : remplace l'ancienne (les widgets configurés avec l'ancienne s'arrêtent).
export async function createKey() {
  const key = newKey()
  const user_id = await currentUserId()
  const data = await buildFeed()
  const { error } = await supabase.from('widget_feed').upsert({ user_id, key_hash: await sha256Hex(key), data, updated_at: new Date().toISOString() })
  if (error) throw error
  return key
}

export async function removeKey() {
  const user_id = await currentUserId()
  const { error } = await supabase.from('widget_feed').delete().eq('user_id', user_id)
  if (error) throw error
}

// Publie le résumé si une clé existe (sinon ne fait rien). Une seule publication à la fois.
let running = null
let disabled = false
export function publishFeed() {
  if (!isCloud || disabled) return Promise.resolve(false)
  running ||= (async () => {
    try {
      const user_id = await currentUserId()
      if (!user_id) return false
      const data = await buildFeed()
      const { data: rows, error } = await supabase.from('widget_feed').update({ data, updated_at: new Date().toISOString() }).eq('user_id', user_id).select('user_id')
      if (error) {
        if (missingWidgetTable(error)) disabled = true // script 015 pas encore lancé
        return false
      }
      return rows.length > 0
    } catch {
      return false
    } finally {
      setTimeout(() => (running = null), 0)
    }
  })()
  return running
}
export const enablePublishing = () => (disabled = false)
