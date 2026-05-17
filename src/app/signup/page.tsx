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
          <h1 className="text-2xl font-bold text-text-primary">Create your account</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Start saving time with AI-powered project management</p>
          <form onSubmit={handleSignup} className="mt-8 space-y-4">
            <Input id="name" label="Full name" value={name} onChange={e => setName(e.target.value)} required placeholder="John Doe" />
            <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="john@example.com" />
            <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
            <Button type="submit" loading={loading} className="w-full">Create account</Button>
          </form>
          <p className="mt-8 text-center text-sm text-text-secondary">
            Already have an account? <Link href="/login" className="text-brand-600 font-semibold hover:text-brand-700">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-600 via-brand-700 to-[#0b0d14] items-center justify-center p-12">
        <div className="max-w-md">
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
