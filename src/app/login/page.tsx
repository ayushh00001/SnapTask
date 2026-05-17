'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  const handleMagicLink = async () => {
    if (!email) { toast.error('Enter your email first'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Magic link sent! Check your email.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="max-w-sm w-full">
          <div className="mb-10">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-xl font-bold text-text-primary">SnapTask</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Sign in to your account to continue</p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password" />
            <Button type="submit" loading={loading} className="w-full">Sign in</Button>
          </form>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-light" /></div>
            <div className="relative flex justify-center"><span className="px-3 text-xs text-text-muted bg-white">or</span></div>
          </div>
          <Button variant="secondary" className="w-full" onClick={handleMagicLink} loading={loading}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Send magic link
          </Button>
          <p className="mt-8 text-center text-sm text-text-secondary">
            No account? <Link href="/signup" className="text-brand-600 font-semibold hover:text-brand-700">Sign up</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-600 via-brand-700 to-[#0b0d14] items-center justify-center p-12">
        <div className="max-w-md">
          <blockquote className="text-white/90 text-xl leading-relaxed font-light italic">
            &ldquo;SnapTask saved our team hours every week. The AI task extraction is incredible — we go from meeting notes to a full project plan in seconds.&rdquo;
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">S</div>
            <div>
              <p className="text-white font-medium text-sm">Sarah Chen</p>
              <p className="text-white/50 text-xs">Product Lead at DesignCo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
