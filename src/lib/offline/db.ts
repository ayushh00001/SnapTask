import Dexie, { type EntityTable } from 'dexie'

interface OfflineProject {
  id: string
  org_id: string
  data: unknown
  updated_at: string
  synced_at: string | null
  deleted: boolean
}

interface OfflineTask {
  id: string
  project_id: string
  data: unknown
  updated_at: string
  synced_at: string | null
  deleted: boolean
}

interface SyncQueue {
  id?: number
  entity_type: 'project' | 'task' | 'subtask' | 'comment'
  entity_id: string
  action: 'create' | 'update' | 'delete'
  payload: unknown
  created_at: string
  retries: number
}

const db = new Dexie('SnapTaskDB') as Dexie & {
  projects: EntityTable<OfflineProject, 'id'>
  tasks: EntityTable<OfflineTask, 'id'>
  syncQueue: EntityTable<SyncQueue, number>
}

db.version(1).stores({
  projects: 'id, org_id, updated_at, synced_at, deleted',
  tasks: 'id, project_id, updated_at, synced_at, deleted',
  syncQueue: '++id, entity_type, entity_id, created_at',
})

export { db }
export type { OfflineProject, OfflineTask, SyncQueue }
