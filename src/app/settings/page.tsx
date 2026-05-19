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
import { PushManager } from '@/components/notifications/push-manager'

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
        id: userData.user.id, email: userData.user.email || '',
        name: userData.user.user_metadata?.name || '', avatar_url: null,
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
      org_id: org.id, email: inviteEmail, role: 'member',
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
      <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your organization and profile</p>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold text-text-primary">Organization</h2></CardHeader>
        <CardContent className="space-y-4">
          <Input id="orgName" label="Organization name" value={orgName} onChange={e => setOrgName(e.target.value)} />
          <Button onClick={handleUpdateOrg}>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary">Team members</h2>
            <span className="text-xs text-text-muted bg-surface-muted px-2 py-1 rounded-lg font-medium">{members.length}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3.5 bg-surface-muted rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center font-semibold text-brand-700 text-sm">
                    {(m.profile?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{m.profile?.name || 'Unknown'}</p>
                    <p className="text-xs text-text-muted">{m.profile?.email}</p>
                  </div>
                </div>
                <Badge color={m.role === 'owner' ? 'green' : m.role === 'admin' ? 'blue' : 'gray'}>{m.role}</Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Input id="invite" placeholder="Email to invite" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            <Button onClick={handleInvite} variant="secondary">Invite</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-text-primary">Notifications</h2></CardHeader>
        <CardContent className="space-y-4">
          <PushManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-text-primary">Security</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary">Two-factor authentication (2FA)</p>
              <p className="text-xs text-text-muted">Add an extra layer of security to your account</p>
            </div>
            <Badge color="amber">Coming soon</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary">Email verification</p>
              <p className="text-xs text-text-muted">Verify your email address for enhanced security</p>
            </div>
            <Badge color={profile?.email ? 'green' : 'gray'}>{profile?.email ? 'Verified' : 'Unverified'}</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary">Session management</p>
              <p className="text-xs text-text-muted">View and manage active sessions</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => toast.info('Session management coming soon')}>Manage</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold text-text-primary">Profile</h2></CardHeader>
        <CardContent className="space-y-4">
          <Input id="email" label="Email" value={profile?.email || ''} disabled />
          <Input id="name" label="Name" value={profile?.name || ''} disabled />
          <div className="pt-2">
            <Button variant="danger" onClick={handleSignOut}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
