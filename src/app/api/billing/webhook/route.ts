import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event_type, data } = body

    if (!event_type) return NextResponse.json({ error: 'event_type required' }, { status: 400 })

    const supabase = createAdminClient()

    if (event_type === 'subscription.created' || event_type === 'subscription.updated') {
      const { id, status, items, customer, current_period_start, current_period_end } = data
      await supabase.from('org_subscriptions').upsert({
        paddle_subscription_id: id,
        status,
        current_period_start: new Date(current_period_start * 1000).toISOString(),
        current_period_end: new Date(current_period_end * 1000).toISOString(),
      }, { onConflict: 'paddle_subscription_id' })
    }

    if (event_type === 'subscription.cancelled') {
      await supabase.from('org_subscriptions')
        .update({ status: 'cancelled' })
        .eq('paddle_subscription_id', data.id)
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
