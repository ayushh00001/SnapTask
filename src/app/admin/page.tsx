'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Organization, Profile } from '@/lib/types'
import { formatDateShort } from '@/lib/utils'

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: usersData } = await supabase.from('profiles').select('*').limit(50)
      const { data: orgsData } = await supabase.from('organizations').select('*').limit(50)
      setUsers(usersData || [])
      setOrgs(orgsData || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
      <p className="text-sm text-gray-500">System overview</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Total users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Organizations</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{orgs.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Users</h2></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <p className="text-xs text-gray-400">Joined {formatDateShort(u.created_at)}</p>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No users yet</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Organizations</h2></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orgs.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{o.name}</p>
                <p className="text-xs text-gray-400">Created {formatDateShort(o.created_at)}</p>
              </div>
            ))}
            {orgs.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No organizations yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
