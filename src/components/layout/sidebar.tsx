'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { useTheme } from '@/components/theme/theme-provider'
import type { Organization, Profile } from '@/lib/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/projects', label: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/admin', label: 'Admin', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, toggle: toggleTheme } = useTheme()
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
    <aside className="hidden lg:flex lg:flex-col w-56 bg-sidebar border-r border-border">
      <div className="px-4 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-accent to-purple flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-text">SnapTask</span>
            {org && <p className="text-[10px] text-text-muted leading-tight">{org.name}</p>}
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 group',
                active
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text',
              )}
            >
              <svg className={cn('w-4 h-4 flex-shrink-0 transition-all duration-150', active ? 'text-accent' : 'text-text-muted group-hover:text-text')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
              {active && <span className="ml-auto w-1 h-4 rounded-full bg-accent" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-2 border-t border-border">
        <div className="flex items-center justify-between px-3 py-2">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-text-muted hover:bg-bg-hover hover:text-text transition-all duration-150"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
        {profile && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-bg-hover transition-colors cursor-default mt-1">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand-400 to-accent flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text truncate leading-tight font-medium">{profile.name}</p>
              <p className="text-[10px] text-text-muted truncate leading-tight">{org?.name || ''}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
