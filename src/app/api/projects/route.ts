import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).limit(1)
  if (!orgs?.length) return NextResponse.json([])
  const { data } = await supabase.from('projects').select('*').eq('org_id', orgs[0].org_id).order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).limit(1)
  if (!orgs?.length) return NextResponse.json({ error: 'No org' }, { status: 400 })
  const { data, error } = await supabase.from('projects').insert({
    ...body,
    org_id: orgs[0].org_id,
    created_by: user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
