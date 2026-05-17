'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 bg-notion-bg/90 backdrop-blur-md border-b border-notion-border lg:hidden">
      <div className="flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-notion-text flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-notion-text">SnapTask</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign out</Button>
      </div>
    </header>
  )
}
