'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function WaitlistPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('waitlist').insert({ email })
    if (error) { toast.error(error.message || 'Already on the list!'); setLoading(false); return }
    toast.success('You\'re on the waitlist!')
    setEmail('')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">SnapTask</span>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Join the waitlist</h1>
        <p className="mt-3 text-gray-600">Be the first to try SnapTask. We&apos;ll notify you when we launch.</p>
        <form onSubmit={handleJoin} className="mt-8 flex gap-2">
          <Input id="waitlist-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Button type="submit" loading={loading}>Join</Button>
        </form>
      </div>
    </div>
  )
}
