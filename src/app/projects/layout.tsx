import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { GlobalSearch } from '@/components/search/global-search'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-muted flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-border-light hidden lg:flex items-center justify-between px-4 sm:px-8 h-14">
          <GlobalSearch />
          <div className="flex items-center gap-3" />
        </div>
        <Navbar />
        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
        <OnboardingModal />
      </div>
    </div>
  )
}
