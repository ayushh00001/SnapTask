import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { GlobalSearch } from '@/components/search/global-search'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-muted flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-border-light hidden lg:flex items-center justify-between px-8 h-14">
          <GlobalSearch />
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </div>
        <Navbar />
        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto w-full">{children}</main>
        <OnboardingModal />
      </div>
    </div>
  )
}
