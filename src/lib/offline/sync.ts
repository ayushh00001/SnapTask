'use client'

import { db } from './db'
import { createClient } from '../supabase/client'

let isSyncing = false

export async function enqueueSync(
  entityType: 'project' | 'task' | 'subtask' | 'comment',
  entityId: string,
  action: 'create' | 'update' | 'delete',
  payload: unknown,
) {
  await db.syncQueue.add({
    entity_type: entityType,
    entity_id: entityId,
    action,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  })
  if (!isSyncing) processQueue()
}

export async function processQueue() {
  if (isSyncing) return
  isSyncing = true
  const supabase = createClient()

  try {
    const items = await db.syncQueue.toArray()
    for (const item of items) {
      try {
        const table = item.entity_type === 'project' ? 'projects' : 'tasks'
        if (item.action === 'create' || item.action === 'update') {
          const { error } = await supabase
            .from(table)
            .upsert(item.payload as Record<string, unknown>)
          if (error) throw error
        } else if (item.action === 'delete') {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', item.entity_id)
          if (error) throw error
        }
        await db.syncQueue.delete(item.id!)
      } catch (e) {
        await db.syncQueue.update(item.id!, { retries: item.retries + 1 })
      }
    }
  } finally {
    isSyncing = false
  }
}

export function setupOnlineSync() {
  window.addEventListener('online', () => {
    processQueue()
  })
}
