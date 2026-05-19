import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { GlobalSearch } from '@/components/search/global-search'
import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
import { OfflineIndicator } from '@/components/ui/offline-indicator'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-secondary flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border hidden lg:flex items-center justify-between px-4 sm:px-6 h-12">
          <GlobalSearch />
          <OfflineIndicator />
        </div>
        <Navbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
        <OfflineIndicator />
        <OnboardingModal />
      </div>
    </div>
  )
}
