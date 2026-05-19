'use client'

import { useOffline } from '@/hooks/use-offline'

export function OfflineIndicator({ compact }: { compact?: boolean }) {
  const { isOnline } = useOffline()

  if (isOnline) return null

  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'px-2 py-1'}`}>
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      <span className="text-xs text-amber-600 font-medium">Offline</span>
    </div>
  )
}
