'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { Project, ProjectTask, Profile } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AiAgentChat({
  project,
  tasks,
  members,
  onAssign,
}: {
  project: Project
  tasks: ProjectTask[]
  members: Profile[]
  onAssign?: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `Hi! I'm your AI project manager for **${project.name}**. I can help assign tasks, review progress, and suggest improvements. What do you need?`,
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const context = {
    projectName: project.name,
    projectDesc: project.description || '',
    status: project.status,
    tasks: tasks.map(t => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: members.find(m => m.id === t.assignee_id)?.name || null,
      due_date: t.due_date,
    })),
    members: members.map(m => ({ id: m.id, name: m.name, email: m.email })),
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    const updatedMessages = [...messages, { role: 'user' as const, content: userMsg }]
    setMessages(updatedMessages)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, context }),
      })
      const { reply } = await res.json()

      if (reply.includes('assign them') && userId) {
        const supabase = createClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const unassigned = tasks.filter(t => !t.assignee_id)
        for (let i = 0; i < Math.min(unassigned.length, context.members.length); i++) {
          const member = context.members[i % context.members.length]
          try {
            await fetch('/api/ai/assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: unassigned[i].id, memberId: member.id, token }),
            })
          } catch {}
        }
        onAssign?.()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Assigned ${Math.min(unassigned.length, context.members.length)} tasks! Refresh to see updates.`,
        }])
        setLoading(false)
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had a problem. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, context, tasks, userId, onAssign])

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto px-1 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-brand-500 text-white rounded-br-md'
                  : 'bg-surface-muted text-text-primary rounded-bl-md border border-border-light',
              )}
            >
              {msg.content.split('\n').map((line, j) => (
                <p key={j} className={line.startsWith('•') || line.match(/^\d+\./) ? 'ml-2' : ''}>
                  {formatMessage(line)}
                </p>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-muted text-text-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm border border-border-light">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 mt-3 pt-3 border-t border-border-light">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask AI to assign tasks, review progress..."
          className="flex-1 bg-white border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all"
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={!input.trim() || loading} className="flex-shrink-0 !px-3 !py-2.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </div>
    </div>
  )
}

function formatMessage(text: string): React.ReactNode {
  if (text.startsWith('**') && text.endsWith('**')) {
    return <strong className="text-text-primary">{text.slice(2, -2)}</strong>
  }
  if (text.startsWith('⚠️') || text.startsWith('✅') || text.startsWith('👍')) {
    return <span>{text}</span>
  }
  return <span>{text}</span>
}
