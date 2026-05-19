import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { GlobalSearch } from '@/components/search/global-search'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-secondary flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border hidden lg:flex items-center justify-between px-4 sm:px-6 h-12">
          <GlobalSearch />
          <div className="flex items-center gap-2" />
        </div>
        <Navbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
        <OnboardingModal />
      </div>
    </div>
  )
}
