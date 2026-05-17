'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Organization, OrgMember, Profile } from '@/lib/types'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      setProfile({
        id: userData.user.id,
        email: userData.user.email || '',
        name: userData.user.user_metadata?.name || '',
        avatar_url: null,
        created_at: userData.user.created_at,
      })
      const { data: orgs } = await supabase.from('org_members').select('org_id, role').eq('user_id', userData.user.id).limit(1)
      if (!orgs?.length) { setLoading(false); return }
      const { data: orgData } = await supabase.from('organizations').select('*').eq('id', orgs[0].org_id).single()
      if (orgData) { setOrg(orgData); setOrgName(orgData.name) }
      const { data: memberData } = await supabase
        .from('org_members')
        .select('*, profile:user_id(id, email, name, avatar_url, created_at)')
        .eq('org_id', orgs[0].org_id)
      setMembers(memberData || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleUpdateOrg = async () => {
    if (!org || !orgName.trim()) return
    const supabase = createClient()
    const { error } = await supabase.from('organizations').update({ name: orgName }).eq('id', org.id)
    if (error) { toast.error(error.message); return }
    toast.success('Organization updated')
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !org) return
    const supabase = createClient()
    const { error } = await supabase.from('invites').insert({
      org_id: org.id,
      email: inviteEmail,
      role: 'member',
      token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Invite sent to ${inviteEmail}`)
    setInviteEmail('')
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Organization</h2></CardHeader>
        <CardContent className="space-y-4">
          <Input id="orgName" label="Organization name" value={orgName} onChange={e => setOrgName(e.target.value)} />
          <Button onClick={handleUpdateOrg}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Team members ({members.length})</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{(m as unknown as { profile: Profile }).profile?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{(m as unknown as { profile: Profile }).profile?.email}</p>
                </div>
                <Badge color={m.role === 'owner' ? 'green' : m.role === 'admin' ? 'blue' : 'gray'}>{m.role}</Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input id="invite" placeholder="Email to invite" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <Button onClick={handleInvite} variant="secondary">Invite</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-gray-900">Profile</h2></CardHeader>
        <CardContent className="space-y-4">
          <Input id="email" label="Email" value={profile?.email || ''} disabled />
          <Input id="name" label="Name" value={profile?.name || ''} disabled />
          <Button variant="danger" onClick={handleSignOut}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  )
}
