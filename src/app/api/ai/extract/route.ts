import { NextResponse } from 'next/server'
import { extractTasksFromText } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text } = body
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 })
    const result = await extractTasksFromText(text)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: 'AI extraction failed' }, { status: 500 })
  }
}
