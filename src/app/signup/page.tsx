'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Account created! Check your email to confirm.')
    setLoading(false)
    router.push('/login')
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) { toast.error(error.message); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex bg-bg">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-sm w-full animate-slide-up">
          <div className="mb-10">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-xl font-bold text-text">SnapTask</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text">Create your account</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Start saving time with AI-powered project management</p>
          <div className="mt-8 space-y-3">
            <Button variant="secondary" className="w-full flex items-center justify-center gap-2.5 h-11" onClick={() => handleOAuth('google')} loading={loading}>
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign up with Google
            </Button>
            <Button variant="secondary" className="w-full flex items-center justify-center gap-2.5 h-11" onClick={() => handleOAuth('github')} loading={loading}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              Sign up with GitHub
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="px-3 text-xs text-text-muted bg-bg">or sign up with email</span></div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <Input id="name" label="Full name" value={name} onChange={e => setName(e.target.value)} required placeholder="John Doe" />
            <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="john@example.com" />
            <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
            <Button type="submit" loading={loading} className="w-full">Create account</Button>
          </form>
          <p className="mt-8 text-center text-sm text-text-secondary">
            Already have an account? <Link href="/login" className="text-accent font-semibold hover:text-accent-hover">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-accent via-purple to-[#0b0d14] items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="max-w-md relative">
          <div className="grid grid-cols-2 gap-4 mb-10">
            {['📸', '🤖', '⚡', '🌍'].map((emoji, i) => (
              <div key={i} className="bg-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
                <span className="text-3xl">{emoji}</span>
                <p className="text-white/70 text-xs mt-2 font-medium">
                  {['Photo input', 'AI powered', 'Real-time', 'Offline'][i]}
                </p>
              </div>
            ))}
          </div>
          <h3 className="text-white text-xl font-semibold">Everything you need to ship faster</h3>
          <p className="text-white/60 text-sm mt-2 leading-relaxed">
            No bloat. No complexity. Just tools that work the way you do. Join thousands of teams already using SnapTask.
          </p>
        </div>
      </div>
    </div>
  )
}
