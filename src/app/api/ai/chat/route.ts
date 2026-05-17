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
  const results = await Promise.allSettled(models.map(modelName =>
    Promise.race([
      genAI!.getGenerativeModel({ model: modelName }).generateContent([{ text: prompt }]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]).then(r => (r as Awaited<ReturnType<ReturnType<typeof genAI.getGenerativeModel>['generateContent']>>).response.text())
  ))
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.length > 10) return r.value
  }
  return null
}

function buildSystemPrompt(context: ProjectContext): string {
  const totalTasks = context.tasks.length
  const doneTasks = context.tasks.filter(t => t.status === 'done').length
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
  const overdueTasks = context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassignedTasks = context.tasks.filter(t => !t.assignee)
  const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')

  const nextTaskHint = nextTask
    ? `\nNEXT TASK TO DO: "${nextTask.title}"${nextTask.assignee ? ` (assigned to ${nextTask.assignee})` : ''}`
    : doneTasks === totalTasks ? '\nALL TASKS COMPLETE!' : ''

  return `You are SnapTask AI Supervisor — a senior developer who mentors the team building "${context.projectName}".

CURRENT: "${context.projectName}" (${context.status})
PROGRESS: ${doneTasks}/${totalTasks} done (${pct}%)${nextTaskHint}
OVERDUE: ${overdueTasks.length} | UNASSIGNED: ${unassignedTasks.length}
DESCRIPTION: ${context.projectDesc || 'N/A'}

TEAM: ${context.members.map(m => m.name).join(', ') || 'No members'}
TASKS: ${context.tasks.map(t => `[${t.status}] ${t.title} (${t.priority}, ${t.assignee || 'unassigned'})`).join('; ') || 'No tasks'}

INSTRUCTIONS:
- You are an expert mentor who has built hundreds of projects. Be specific and practical.
- Give detailed step-by-step guidance like a senior dev mentoring a junior.
- Reference specific tasks from the list when relevant.
- Use **bold** for emphasis. Be concise but thorough.
- PROACTIVE: If a task was just completed, congratulate and immediately tell them the next task to work on.
- RESEARCH: When answering how-to questions, give specific commands, code snippets, and tool recommendations.
- Be direct, practical, and motivating — like a great tech lead.`
}

function localSmartReply(messages: ChatMessage[], context: ProjectContext): string {
  const lastMsg = messages[messages.length - 1]?.content || ''
  const q = lastMsg.toLowerCase()
  const total = context.tasks.length
  const done = context.tasks.filter(t => t.status === 'done').length
  const overdue = context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassigned = context.tasks.filter(t => !t.assignee)
  const hasTasks = total > 0
  const hasMembers = context.members.length > 0

  if (q.match(/\b(hi|hello|hey|sup|howdy|what'?s up|good\s*(morning|afternoon|evening|day))\b/)) {
    const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
    let reply = `Hey there! I'm the **AI Supervisor** for **${context.projectName}**.\n\n`
    if (done === total) {
      reply += `All **${total} tasks** are done! Ready for the next project?`
    } else if (nextTask) {
      reply += `Your next task is **"${nextTask.title}"**. `
      if (nextTask.assignee) reply += `It's assigned to **${nextTask.assignee}**. `
      reply += `\n\nSay **"guide me"** and I'll walk you through it step by step!`
    } else {
      reply += `We have **${total} tasks** — ${done} done, ${total - done} to go. Say **"how do I start?"** and I'll help!`
    }
    return reply
  }

  if (q.match(/\b(guide|walk me|help me start|first task|what.*next|what.*do next|next step|step by|how.*start|begin)\b/)) {
    if (!hasTasks) return `No tasks yet in **${context.projectName}**. Let me create some!`
    const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
    if (!nextTask) return done === total ? 'All done! Amazing work.' : 'All tasks are in progress. Keep pushing!'
    const phaseTasks = context.tasks.filter(t => {
      const idx = context.tasks.indexOf(nextTask)
      return false
    })
    return `**Next task: "${nextTask.title}"**\n\nHere's what to do:\n1. Move this task to **In Progress**\n2. Break it into smaller sub-tasks if needed\n3. Focus on getting it done — don't overthink it\n4. Move to **Review** when ready\n5. Ask me for help if you get stuck!\n\nWant me to tell you **how** to do this specific task?`
  }

  if (q.match(/\b(assign|unassigned|who.*(should|can|will)|distribute|allocate)\b/)) {
    if (!hasTasks) return 'No tasks yet! Create some and I can help assign them.'
    if (!hasMembers) return 'No team members yet. Invite people from Settings first.'
    const unassignedTasks = context.tasks.filter(t => !t.assignee)
    if (unassignedTasks.length === 0) return 'All tasks already have assignees!'
    let reply = `Found **${unassignedTasks.length} unassigned tasks**. Here's my suggestion:\n\n`
    const shuffled = [...context.members].sort(() => Math.random() - 0.5)
    unassignedTasks.slice(0, 10).forEach((t, i) => {
      reply += `• "${t.title}" → **${shuffled[i % shuffled.length].name}**\n`
    })
    if (unassignedTasks.length > 10) reply += `\n...and ${unassignedTasks.length - 10} more.`
    reply += `\n\nSay **"assign them"** and I'll make it happen.`
    return reply
  }

  if (q.match(/\b(progress|how.*(going|far)|review|status|summary|overview|report)\b/)) {
    if (!hasTasks) return `No tasks yet in **${context.projectName}**. Add some to get started!`
    const pct = Math.round(done / total * 100)
    const inProgress = context.tasks.filter(t => t.status === 'in_progress').length
    const todo = total - done - inProgress
    const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
    let r = `**${context.projectName}** — ${pct}% complete\n\n`
    r += `**Done:** ${done} | **In Progress:** ${inProgress} | **To Do:** ${todo}\n\n`
    if (overdue.length > 0) r += `Overdue: ${overdue.length}\n`
    if (unassigned.length > 0) r += `Unassigned: ${unassigned.length}\n`
    if (done === total) r += '\nAll tasks complete!'
    else if (nextTask) r += `\nNext up: **"${nextTask.title}"**`
    return r
  }

  if (q.match(/\b(how (to|do|can|should|would)|guide|instructions|step by|help me|approach|explain|tell me about|teach|tutorial)\b/)) {
    const taskQuery = q.replace(/\b(how (to|do|can|should|would)|guide|instructions|step by|walk me|help me|approach|tell me|explain|about|teach|tutorial)\b/g, '').trim()
    const matchingTask = context.tasks.find(t => taskQuery && t.title.toLowerCase().includes(taskQuery))
    if (matchingTask) {
      return `**How to do: "${matchingTask.title}"**\n\nHere's your step-by-step guide:\n\n1. **Prepare** — Make sure you have the right tools. Check any dependencies.\n2. **Research** — Look at existing solutions or examples for reference.\n3. **Implement** — Start with the simplest version that works.\n4. **Test** — Verify it works before moving on.\n5. **Polish** — Refactor and improve.\n\n**Pro tip:** Break this into smaller sub-tasks in the task detail view. Work through them one at a time.\n\nNeed more specific guidance? Tell me what you're stuck on!`
    }
    if (hasTasks) {
      const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
      if (nextTask) return `**Next task:** "${nextTask.title}"\n\nMove it to "In Progress" to start. Want me to give you detailed steps for this specific task?`
      return 'All tasks are done! Great work.'
    }
    return `No tasks yet in **${context.projectName}**. Create some first, then I can guide you through each one!`
  }

  if (q.match(/\b(done|completed|finished|just.*did|completed.*task)\b/)) {
    if (!hasTasks) return 'No tasks yet!'
    const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
    if (nextTask) {
      return `Great progress! Now move **"${nextTask.title}"** to In Progress and work through it.\n\nSay **"how do I do it"** and I'll give you detailed instructions!`
    }
    return 'All tasks are done. Incredible work!'
  }

  if (q.match(/\b(suggest|improve|recommend|advice|tip|optimize|better|what should)\b/)) {
    const tips: string[] = []
    if (unassigned.length > 0) tips.push(`Assign **${unassigned.length} unassigned tasks**`)
    if (overdue.length > 0) tips.push(`Review **${overdue.length} overdue tasks** and adjust timelines`)
    if (total === 0) tips.push('Create your **first task** to get the project moving')
    if (tips.length === 0) {
      const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
      if (nextTask) tips.push(`Work on **"${nextTask.title}"**`)
      else tips.push('Plan the next phase of the project')
    }
    return `**Suggestions:**\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nWant me to elaborate on any of these?`
  }

  if (q.match(/\b(thanks|thank|appreciate)\b/)) {
    const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
    let reply = "You're welcome! Happy to help."
    if (nextTask) reply += `\n\nYour next task is **"${nextTask.title}"** — dive in whenever you're ready!`
    return reply
  }

  const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
  const hint = nextTask ? `\n\nYour next task is **"${nextTask.title}"**. Need guidance?` : (done === total ? '\n\nAll tasks done!' : '')
  return `You asked about: "${context.projectName}"\n\n**Progress:** ${done}/${total} tasks done.\n${hint}`
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json() as { messages: ChatMessage[]; context: ProjectContext }
    const systemPrompt = buildSystemPrompt(context)
    const conversation = messages.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n')
    const fullPrompt = `${systemPrompt}\n\nConversation:\n${conversation}\n\nAgent:`

    const geminiResult = await tryGemini(fullPrompt)
    const reply = geminiResult || localSmartReply(messages, context)

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: "I'm here! Ask me anything about your project." }, { status: 200 })
  }
}
