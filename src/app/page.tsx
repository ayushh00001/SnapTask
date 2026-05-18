'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm shadow-brand-200">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold text-[#0b0d14]">SnapTask</span>
                <span className="hidden sm:inline ml-2 text-xs text-text-muted font-medium bg-surface-muted px-2 py-0.5 rounded-full">AI-powered</span>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-4 py-2">Log in</Link>
              <Link href="/signup" className="inline-flex items-center px-5 py-2.5 rounded-xl bg-[#0b0d14] text-white text-sm font-semibold hover:bg-gray-800 transition-all shadow-sm">
                Get started free
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-24 sm:pt-40 sm:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-sm font-medium mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              AI-powered project management
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#0b0d14] tracking-tight leading-[1.1] animate-slide-up">
              Save your team{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">5 hours/week</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
              Take a photo of your notes or speak your goal — AI instantly creates a structured project plan with tasks, timelines, and team assignments.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <Link href="/signup" className="inline-flex items-center px-8 py-3.5 rounded-xl bg-[#0b0d14] text-white font-semibold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 text-base">
                Start free
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link href="/waitlist" className="inline-flex items-center px-8 py-3.5 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-all text-base">
                Join waitlist
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-[#f8f9fc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0b0d14]">Everything you need to ship faster</h2>
            <p className="mt-4 text-lg text-text-secondary max-w-xl mx-auto">No bloat. No complexity. Just tools that work the way you do.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Photo to plan', desc: 'Snap a whiteboard or notes — AI extracts tasks, phases, and timelines instantly.', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { title: 'Offline-first', desc: 'Works without internet. Syncs automatically when you reconnect.', icon: 'M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
              { title: 'AI predictions', desc: 'Get warned about risks, bottlenecks, and overdue tasks before they happen.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { title: 'Real-time sync', desc: 'Team sees updates instantly. No refresh needed.', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
              { title: 'Minimalist design', desc: 'Zero bloat. Simple UX that gets out of your way.', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
              { title: 'Works for everyone', desc: 'Solo freelancer or 100-person team — same great experience.', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map(f => (
              <div key={f.title} className="group bg-white rounded-2xl p-7 border border-border-light hover:border-border hover:shadow-md transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center mb-5 group-hover:from-brand-100 group-hover:to-brand-200 transition-colors">
                  <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#0b0d14]">{f.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0b0d14]">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-text-secondary">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Free', price: '$0', desc: 'For students and testing', features: ['1 project', '5 people', 'Basic tasks', 'Kanban board'] },
              { name: 'Pro', price: '$19', desc: 'For freelancers and small teams', features: ['Unlimited projects', '15 people', 'AI features', 'Offline mode', 'Photo input'] },
              { name: 'Team', price: '$49', desc: 'For growing agencies', features: ['Up to 50 people', 'Team tools', 'AI predictions', 'Integrations', 'Priority support'] },
            ].map(p => (
              <div key={p.name} className="relative bg-white rounded-2xl border border-border-light p-8 hover:shadow-lg hover:border-border transition-all duration-200">
                {p.name === 'Pro' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white text-xs font-semibold shadow-sm">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-[#0b0d14]">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[#0b0d14]">{p.price}</span>
                  <span className="text-text-muted text-sm">/month</span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{p.desc}</p>
                <ul className="mt-6 space-y-3.5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-3 text-sm text-text-secondary">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.name === 'Free' ? '/signup' : '/waitlist'}
                  className={`mt-8 block text-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    p.name === 'Pro'
                      ? 'bg-[#0b0d14] text-white hover:bg-gray-800'
                      : 'border border-border text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {p.name === 'Free' ? 'Get started' : 'Join waitlist'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border-light py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#0b0d14]">SnapTask</span>
          </div>
          <p className="text-sm text-text-muted">&copy; 2026 SnapTask. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
