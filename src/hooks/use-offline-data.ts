'use client'

import { useCallback } from 'react'
import { useOffline } from './use-offline'
import { db } from '@/lib/offline/db'
import { enqueueSync } from '@/lib/offline/sync'
import { createClient } from '@/lib/supabase/client'

export function useOfflineData() {
  const { isOnline } = useOffline()

  const fetchProjects = useCallback(async (orgId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('projects').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (!isOnline) {
      const cached = await db.table('projects').where('org_id').equals(orgId).toArray()
      return cached.filter(p => !p.deleted).map(p => p.data)
    }
    return data || []
  }, [isOnline])

  const fetchTasks = useCallback(async (projectId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId)
    if (!isOnline) {
      const cached = await db.table('tasks').where('project_id').equals(projectId).toArray()
      return cached.filter(t => !t.deleted).map(t => t.data)
    }
    return data || []
  }, [isOnline])

  const saveProject = useCallback(async (project: Record<string, unknown>) => {
    const supabase = createClient()
    if (isOnline) {
      const { error } = await supabase.from('projects').upsert(project)
      if (error) throw error
    } else {
      await db.table('projects').put({
        id: project.id as string,
        org_id: project.org_id as string,
        data: project,
        updated_at: new Date().toISOString(),
        synced_at: null,
        deleted: false,
      })
      await enqueueSync('project', project.id as string, 'update', project)
    }
  }, [isOnline])

  const saveTask = useCallback(async (task: Record<string, unknown>) => {
    const supabase = createClient()
    if (isOnline) {
      const { error } = await supabase.from('tasks').upsert(task)
      if (error) throw error
    } else {
      await db.table('tasks').put({
        id: task.id as string,
        project_id: task.project_id as string,
        data: task,
        updated_at: new Date().toISOString(),
        synced_at: null,
        deleted: false,
      })
      await enqueueSync('task', task.id as string, 'update', task)
    }
  }, [isOnline])

  return { isOnline, fetchProjects, fetchTasks, saveProject, saveTask }
}
