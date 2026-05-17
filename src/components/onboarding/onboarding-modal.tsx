'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'

export function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const onboarded = localStorage.getItem('snaptask_onboarded')
      if (user && !onboarded) {
        supabase.from('projects').select('id', { count: 'exact', head: true }).then(({ count }) => {
          if (count === 0) setOpen(true)
        })
      }
    })
  }, [])

  const steps = [
    {
      title: 'Welcome to SnapTask 👋',
      desc: 'The AI-powered project manager that saves your team hours every week.',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
    {
      title: 'What should we call you?',
      desc: 'This is how your team will see you.',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      input: true,
    },
    {
      title: 'You\'re all set! 🚀',
      desc: 'Create your first project or explore the dashboard. AI will help you every step of the way.',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: { label: 'Create a project', href: '/projects' },
    },
  ]

  const handleNext = async () => {
    if (step === 1 && name.trim()) {
      setLoading(true)
      const supabase = createClient()
      await supabase.auth.updateUser({ data: { name } })
      setLoading(false)
    }
    if (step === steps.length - 1) {
      localStorage.setItem('snaptask_onboarded', 'true')
      setOpen(false)
    }
    setStep(s => Math.min(s + 1, steps.length - 1))
  }

  const s = steps[step]

  return (
    <Modal open={open} onClose={() => {}} className="max-w-md text-center">
      <div className="py-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-text-primary">{s.title}</h2>
        <p className="text-sm text-text-secondary mt-2">{s.desc}</p>
        {s.input && (
          <div className="mt-6 max-w-xs mx-auto">
            <Input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          </div>
        )}
        <div className="flex items-center justify-center gap-2 mt-8 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-brand-500' : 'bg-border'}`} />
          ))}
        </div>
        <Button onClick={handleNext} loading={loading} className="w-full max-w-xs" disabled={s.input && !name.trim()}>
          {step === steps.length - 1 ? 'Get started' : 'Continue'}
        </Button>
      </div>
    </Modal>
  )
}
