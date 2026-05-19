'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function PushManager() {
  const [supported, setSupported] = useState(false)
  const [swReady, setSwReady] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setSupported(true)
      navigator.serviceWorker.register('/sw.js')
        .then(() => setSwReady(true))
        .catch(() => {})
    }
  }, [])

  const handleEnable = async () => {
    if (!('PushManager' in window)) { toast.error('Push API not available'); return }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key) { toast.info('Push notifications require a VAPID key. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in your environment.'); return }
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        await supabase.from('push_subscriptions').upsert({
          user_id: userData.user.id,
          subscription: JSON.parse(JSON.stringify(sub)),
        }, { onConflict: 'user_id' })
      }
      toast.success('Push notifications enabled')
    } catch {
      toast.error('Failed to enable push notifications')
    }
    setLoading(false)
  }

  if (!supported) return null

  return (
    <div className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
      <div>
        <p className="text-sm font-medium text-text-primary">Push notifications</p>
        <p className="text-xs text-text-muted">Get notified of task assignments, mentions, and deadline warnings</p>
      </div>
      <Button variant="accent" size="sm" onClick={handleEnable} loading={loading}>
        {swReady ? 'Enable' : 'Setting up...'}
      </Button>
    </div>
  )
}
