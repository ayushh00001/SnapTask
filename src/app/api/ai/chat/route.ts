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
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
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

  return `You are SnapTask AI Supervisor — a senior developer who mentors the team building "${context.projectName}".

CURRENT: "${context.projectName}" (${context.status})
PROGRESS: ${doneTasks}/${totalTasks} done (${pct}%)
OVERDUE: ${overdueTasks.length} | UNASSIGNED: ${unassignedTasks.length}
DESCRIPTION: ${context.projectDesc || 'N/A'}

TEAM: ${context.members.map(m => m.name).join(', ') || 'No members'}
TASKS: ${context.tasks.map(t => `[${t.status}] ${t.title} (${t.assignee || 'unassigned'})`).join('; ') || 'No tasks'}

INSTRUCTIONS:
- You are ChatGPT-level helpful. Answer ANY question conversationally.
- For how-to questions, give detailed step-by-step guidance like a senior dev mentoring a junior.
- Reference specific tasks from the list above when relevant.
- Use **bold** for emphasis. Be friendly, practical, and concise.`
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

  if (q.match(/\b(hi|hello|hey|sup|howdy)\b/)) {
    return `Hey there! 👋 I'm the **AI Supervisor** for **${context.projectName}**. I can help you build this project — answer questions, assign tasks, give step-by-step guidance, review progress. What do you need?`
  }

  if (q.match(/\b(assign|unassigned|who.*(should|can|will)|distribute|allocate)\b/)) {
    if (!hasTasks) return 'No tasks yet! Create some and I can help assign them.'
    if (!hasMembers) return 'No team members yet. Invite people from Settings first.'
    const unassignedTasks = context.tasks.filter(t => !t.assignee)
    if (unassignedTasks.length === 0) return '✅ All tasks already have assignees!'
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
    let r = `## ${context.projectName} — ${pct}% complete\n\n`
    r += `**Done:** ${done} | **In Progress:** ${inProgress} | **To Do:** ${todo}\n\n`
    if (overdue.length > 0) r += `⚠️ ${overdue.length} overdue — needs attention\n`
    if (unassigned.length > 0) r += `📋 ${unassigned.length} unassigned — say "assign tasks"\n`
    if (done === total) r += '\n🎉 **All done!** Incredible work!'
    else if (overdue.length > total * 0.3) r += '\nSome tasks are behind. Want me to suggest a recovery plan?'
    else if (unassigned.length > total * 0.3) r += '\nSay **"assign tasks"** to distribute them.'
    else r += '\n👍 On track! Keep it up!'
    return r
  }

  if (q.match(/\b(overdue|behind|delay|late|missed|falling behind)\b/)) {
    if (overdue.length === 0) return '✅ Everything is on schedule!'
    let r = `⚠️ **${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}:**\n\n`
    overdue.slice(0, 8).forEach(t => {
      r += `• "${t.title}"${t.assignee ? ` (${t.assignee})` : ' (unassigned)'}`
      if (t.due_date) r += ` — was due ${new Date(t.due_date).toLocaleDateString()}`
      r += '\n'
    })
    if (overdue.length > 8) r += `\n...and ${overdue.length - 8} more.`
    r += '\n\n**Tip:** Try extending deadlines or reassigning these.'
    return r
  }

  if (q.match(/\b(suggest|improve|recommend|advice|tip|optimize|better)\b/)) {
    const tips: string[] = []
    if (unassigned.length > 0) tips.push(`Assign **${unassigned.length} unassigned tasks**`)
    if (overdue.length > 0) tips.push(`Review **${overdue.length} overdue tasks** and adjust timelines`)
    if (total === 0) tips.push('Create your **first task** to get the project moving')
    if (tips.length === 0) tips.push('Everything looks good! Plan the next phase.')
    return `**Suggestions:**\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nWant me to elaborate on any of these?`
  }

  if (q.match(/\b(member|team|people|who)\b/) && !q.match(/\b(assign|task)\b/)) {
    if (!hasMembers) return 'No team members yet. Invite people from **Settings**.'
    let r = `**Team (${context.members.length}):**\n\n`
    context.members.forEach(m => {
      const assigned = context.tasks.filter(t => t.assignee === m.name)
      const completed = assigned.filter(t => t.status === 'done').length
      r += `• ${m.name} — ${completed}/${assigned.length} tasks done\n`
    })
    return r
  }

  if (q.match(/\b(thanks|thank|appreciate|great|awesome|perfect)\b/)) {
    return "You're welcome! 😊 Happy to help. Anything else?"
  }

  if (q.match(/\b(task|what.*do|list.*task|show.*task)\b/)) {
    if (!hasTasks) return 'No tasks yet. Click **+ Add** to create one!'
    const byStatus: Record<string, string[]> = { backlog: [], todo: [], in_progress: [], review: [], done: [] }
    context.tasks.forEach(t => { if (byStatus[t.status]) byStatus[t.status].push(t.title) })
    let r = `**All Tasks (${total}):**\n\n`
    for (const [status, items] of Object.entries(byStatus)) {
      if (items.length > 0) {
        r += `*${status.replace('_', ' ').toUpperCase()}* — ${items.length}\n`
        items.slice(0, 5).forEach(t => r += `  • ${t}\n`)
        if (items.length > 5) r += `  ...and ${items.length - 5} more\n`
      }
    }
    return r
  }

  if (q.match(/\b(how (to|do|can|should|would)|guide|instructions|step by step|walk me through|help me|approach|explain|tell me about)\b/)) {
    const taskQuery = q.replace(/\b(how (to|do|can|should|would)|guide|instructions|step by step|walk me through|help me|approach|tell me|explain|about)\b/g, '').trim()
    const matchingTask = context.tasks.find(t => taskQuery && t.title.toLowerCase().includes(taskQuery))
    if (matchingTask) {
      return `**How to: "${matchingTask.title}"**\n\nHere's a step-by-step guide:\n\n1. **Understand the goal** — This task is about ${matchingTask.title.toLowerCase()}. Make sure you know what success looks like.\n2. **Break it down** — Split it into smaller sub-tasks in the task detail view.\n3. **Get started** — Move the task to "In Progress" when you begin.\n4. **Ask questions** — Use the comments section if you get stuck.\n5. **Submit for review** — Move to "Review" when done.\n\nNeed more specific guidance? Just ask!`
    }
    if (hasTasks) {
      const nextTask = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
      if (nextTask) return `**Next task to work on:** "${nextTask.title}"\n\nMove it to "In Progress" to start. Break it into smaller steps and comment if you need help.`
      return 'All tasks are done! 🎉 Ready for the next project?'
    }
    return `No tasks yet in **${context.projectName}**. Create some first, then I can guide you through each one!`
  }

  if (q.match(/\b(generate|create|plan|new project|make.*project|build.*project)\b/)) {
    return `Want to create a new project? Go to **Projects → New project**, describe what you want, and click **Generate with AI**. I'll create a full plan with tasks, phases, and step-by-step instructions for each task!`
  }

  if (q.match(/\b(good\s*(morning|afternoon|evening|day)|how are you|what'?s up|wassup)\b/)) {
    return `Doing great! 👋 How can I help you with **${context.projectName}** today?`
  }

  if (q.match(/\b(what can|capabilities|help|what do|features)\b/)) {
    return `Here's what I can do:\n\n• **Assign tasks** — "assign tasks to the team"\n• **Check progress** — "how's it going?"\n• **How-to guides** — "how do I do [task]?"\n• **Overdue alerts** — "show overdue tasks"\n• **Suggestions** — "any suggestions?"\n• **Team info** — "who's on the team?"\n• **General help** — Ask me anything about building this project!\n\nWhat would you like?`
  }

  const taskInfo = hasTasks
    ? `We have ${total} tasks (${done} done, ${total - done} remaining).`
    : `There are no tasks yet in this project.`

  const memberInfo = hasMembers
    ? `Your team has ${context.members.length} members: ${context.members.map(m => m.name).join(', ')}.`
    : 'No team members yet.'

  const projectInfo = `This project "${context.projectName}" is currently **${context.status}**.`

  const question = lastMsg.length > 10 ? lastMsg.slice(0, 60) + '...' : lastMsg

  const responses = [
    `You asked: "${question}"\n\n${projectInfo} ${taskInfo} ${memberInfo}\n\nHow can I help with this?`,
    `I see you're asking about "${question}".\n\n${projectInfo}\n${taskInfo}\n\nWant me to check progress, assign tasks, or help with something specific?`,
    `Good question! Here's what I know:\n\n${projectInfo}\n${taskInfo}\n${memberInfo}\n\nWhat would you like me to help with?`,
    `${projectInfo}\n\n${taskInfo}\n${memberInfo}\n\nI'm your AI supervisor — I can answer questions, guide you through tasks, and help manage this project. What do you need?`,
  ]

  return responses[Math.floor(Math.random() * responses.length)]
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
