import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ProjectContext {
  projectName: string
  projectDesc: string
  status: string
  tasks: { title: string; status: string; priority: string; assignee: string | null; due_date: string | null }[]
  members: { id: string; name: string; email: string }[]
}

async function tryGemini(prompt: string): Promise<string | null> {
  if (!genAI) return null
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([{ text: prompt }])
      return result.response.text()
    } catch {
      continue
    }
  }
  return null
}

function localReply(messages: ChatMessage[], context: ProjectContext): string {
  const last = messages[messages.length - 1]
  const q = last.content.toLowerCase()

  const unassigned = context.tasks.filter(t => !t.assignee)
  const overdue = context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const done = context.tasks.filter(t => t.status === 'done')
  const inProgress = context.tasks.filter(t => t.status === 'in_progress')

  if (q.includes('assign') || q.includes('unassigned') || q.includes('who')) {
    if (unassigned.length === 0) return 'All tasks have assignees. Great job!'
    if (context.members.length === 0) return 'No team members yet. Invite people first.'
    const suggestions = unassigned.slice(0, 5).map(t => {
      const m = context.members[Math.floor(Math.random() * context.members.length)]
      return `• "${t.title}" → ${m.name}`
    }).join('\n')
    return `Here are my suggested assignments:\n${suggestions}\n\nSay **"assign them"** to confirm and I'll update the database.`
  }

  if (q.includes('overdue') || q.includes('behind') || q.includes('delay')) {
    if (overdue.length === 0) return 'No overdue tasks. Everything is on schedule!'
    return `⚠️ **${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}**\n${overdue.map(t => `• "${t.title}" (was due ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'})`).join('\n')}\n\nConsider reassigning or adjusting deadlines.`
  }

  if (q.includes('review') || q.includes('done') || q.includes('completed') || q.includes('progress')) {
    const total = context.tasks.length
    if (total === 0) return 'No tasks yet. Start by creating some!'
    return `**Project Progress**: ${done.length}/${total} tasks done (${Math.round(done.length / total * 100)}%)\n• Done: ${done.length}\n• In Progress: ${inProgress.length}\n• Overdue: ${overdue.length}\n• Unassigned: ${unassigned.length}\n\nOverall: ${done.length === total ? '✅ All tasks completed!' : overdue.length > 0 ? '⚠️ Some tasks need attention' : '👍 On track'}`
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return `Hello! I'm SnapTask AI Agent. I can:\n• **Assign tasks** to team members\n• **Review project progress**\n• **Flag overdue items**\n• **Suggest improvements**\n\nWhat would you like me to help with?`
  }

  if (q.includes('improve') || q.includes('suggest') || q.includes('advice') || q.includes('recommend')) {
    const tips: string[] = []
    if (unassigned.length > 0) tips.push(`Assign ${unassigned.length} unassigned tasks`)
    if (overdue.length > 0) tips.push(`Review ${overdue.length} overdue tasks`)
    if (inProgress.length > 3) tips.push('Too many tasks in progress — focus on finishing a few')
    if (tips.length === 0) tips.push('Keep up the good work! Consider adding more tasks for the next sprint')
    return `**Suggestions**:\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  }

  if (q.includes('who') || q.includes('member') || q.includes('team')) {
    if (context.members.length === 0) return 'No team members in this project yet.'
    return `**Team Members (${context.members.length})**:\n${context.members.map(m => `• ${m.name} (${m.email})`).join('\n')}`
  }

  return `I understand you're asking about "${last.content.slice(0, 60)}". I can help with:\n• Task **assignment** and workload\n• **Progress reports** and reviews\n• **Project insights** and suggestions\n• Risk flagging\n\nCould you be more specific about what you need?`
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json() as { messages: ChatMessage[]; context: ProjectContext }

    const systemPrompt = `You are SnapTask AI Agent, a project management assistant. You help teams manage tasks, assign work, review progress, and suggest improvements.

Current project: "${context.projectName}"
Status: ${context.status}
Description: ${context.projectDesc || 'N/A'}

Team members:
${context.members.map(m => `- ${m.name} (${m.email})`).join('\n')}

Tasks:
${context.tasks.map(t => `- [${t.status}] "${t.title}" (priority: ${t.priority}, assignee: ${t.assignee || 'unassigned'}, due: ${t.due_date || 'no due date'})`).join('\n')}

You are helpful, concise, and proactive. Give clear answers and actionable suggestions. If the user asks you to assign tasks, suggest logical assignments and tell them to say "assign them" to confirm. If they ask for a review, summarize the project health. Keep responses brief and scannable.`

    const conversation = messages.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n')
    const fullPrompt = `${systemPrompt}\n\nConversation:\n${conversation}\n\nAgent:`

    const geminiResult = await tryGemini(fullPrompt)
    const reply = geminiResult || localReply(messages, context)

    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json({ reply: 'Sorry, I had a problem. Please try again.' }, { status: 200 })
  }
}
