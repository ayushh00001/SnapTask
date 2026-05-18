'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/notifications/notification-bell'
import type { Organization, Profile } from '@/lib/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/projects', label: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/admin', label: 'Admin', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [org, setOrg] = useState<Organization | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setProfile({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          avatar_url: null,
          created_at: user.created_at,
        })
        const { data: orgMembership } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).limit(1).single()
        if (orgMembership) {
          const { data } = await supabase.from('organizations').select('*').eq('id', orgMembership.org_id).single()
          setOrg(data)
        }
      }
    })
  }, [])

  return (
    <aside className="hidden lg:flex lg:flex-col w-60 bg-notion-sidebar border-r border-notion-border">
      <div className="px-4 py-3 border-b border-notion-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-notion-text flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-notion-text">SnapTask</span>
        </Link>
      </div>

      <div className="px-2 py-2 border-b border-notion-border">
        <NotificationBell />
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-all duration-150',
                active
                  ? 'bg-notion-bg-selected text-notion-text font-medium'
                  : 'text-notion-text-secondary hover:bg-notion-bg-hover hover:text-notion-text',
              )}
            >
              <svg className={cn('w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110', active ? 'text-notion-text' : 'text-notion-text-muted')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-2 border-t border-notion-border">
        {profile && (
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded hover:bg-notion-bg-hover transition-colors cursor-default">
            <div className="w-6 h-6 rounded bg-notion-bg-hover flex items-center justify-center text-xs font-medium text-notion-text flex-shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-notion-text truncate leading-tight">{profile.name}</p>
              <p className="text-xs text-notion-text-muted truncate leading-tight">{org?.name || ''}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
