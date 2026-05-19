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
          <form onSubmit={handleSignup} className="mt-8 space-y-4">
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
