import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const { taskId, memberId } = await req.json()
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const { error } = await supabase
      .from('tasks')
      .update({ assignee_id: memberId, updated_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Assignment failed' }, { status: 500 })
  }
}
