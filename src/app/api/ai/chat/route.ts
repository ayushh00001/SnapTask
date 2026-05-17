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
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      clearTimeout(timeout)
      const text = result.response.text()
      if (text && text.length > 10) return text
    } catch {
      continue
    }
  }
  return null
}

function buildSystemPrompt(context: ProjectContext): string {
  const totalTasks = context.tasks.length
  const doneTasks = context.tasks.filter(t => t.status === 'done').length
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
  const overdueTasks = context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassignedTasks = context.tasks.filter(t => !t.assignee)

  return `You are SnapTask AI Supervisor — an expert project lead who guides the team through building their project from start to finish. You're like a senior developer mentoring juniors.

CURRENT PROJECT: "${context.projectName}"
STATUS: ${context.status}
DESCRIPTION: ${context.projectDesc || 'N/A'}
PROGRESS: ${doneTasks}/${totalTasks} tasks done (${pct}%)
OVERDUE: ${overdueTasks.length} tasks
UNASSIGNED: ${unassignedTasks.length} tasks

TEAM MEMBERS:
${context.members.map(m => `- ${m.name} (${m.email})`).join('\n') || 'No members yet'}

TASKS:
${context.tasks.map(t => `- [${t.status}] "${t.title}" (priority: ${t.priority}, assignee: ${t.assignee || 'unassigned'}${t.due_date ? `, due: ${t.due_date}` : ''})`).join('\n') || 'No tasks yet'}

INSTRUCTIONS:
- You are a helpful AI assistant. Answer ANY question the user asks — about the project, how to do tasks, general advice, technical questions, anything.
- If the user asks HOW to do something, give detailed step-by-step instructions like a mentor.
- If asked about a specific task, look it up in the task list above and provide guidance.
- If asked to assign tasks, suggest assignments and say "say **assign them** to confirm".
- Keep responses clear, friendly, and practical. Use **bold** for emphasis.
- You can answer general questions too (coding, design, planning, etc.) — you're not limited to project management.`
}

function localSmartReply(messages: ChatMessage[], context: ProjectContext): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || ''
  const total = context.tasks.length
  const done = context.tasks.filter(t => t.status === 'done').length
  const overdue = context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassigned = context.tasks.filter(t => !t.assignee)
  const hasTasks = total > 0
  const hasMembers = context.members.length > 0

  if (lastMsg.match(/\b(hi|hello|hey|sup|howdy)\b/)) {
    return `Hi there! I'm the **AI Supervisor** for **${context.projectName}**. I can help you with anything — answering questions, assigning tasks, giving step-by-step guidance, reviewing progress, or just chatting. What do you need?`
  }

  if (lastMsg.match(/\b(assign|unassigned|who.*(should|can|will)|distribute|allocate)\b/)) {
    if (!hasTasks) return 'No tasks to assign yet. Create some tasks first!'
    if (!hasMembers) return 'No team members yet. Go to Settings to invite people to this project.'
    const unassignedTasks = context.tasks.filter(t => !t.assignee)
    if (unassignedTasks.length === 0) return '✅ All tasks already have assignees!'
    let reply = `Found **${unassignedTasks.length} unassigned tasks**. Here's how I'd split them:\n\n`
    const shuffled = [...context.members].sort(() => Math.random() - 0.5)
    unassignedTasks.slice(0, 10).forEach((t, i) => {
      const m = shuffled[i % shuffled.length]
      reply += `• "${t.title}" → **${m.name}**\n`
    })
    if (unassignedTasks.length > 10) reply += `\n...and ${unassignedTasks.length - 10} more.`
    reply += `\n\nSay **"assign them"** to confirm and I'll assign everyone.`
    return reply
  }

  if (lastMsg.match(/\b(progress|review|status|how.*(going|far)|done|completed|summary|overview|report)\b/)) {
    if (!hasTasks) return `No tasks yet in **${context.projectName}**. Start by adding some!`
    const pct = Math.round(done / total * 100)
    const inProgress = context.tasks.filter(t => t.status === 'in_progress').length
    const todo = total - done - inProgress
    let reply = `## ${context.projectName} — ${pct}% complete\n\n`
    reply += `**Done:** ${done} | **In Progress:** ${inProgress} | **To Do:** ${todo}\n\n`
    if (overdue.length > 0) reply += `⚠️ **${overdue.length} overdue** — needs attention\n`
    if (unassigned.length > 0) reply += `📋 **${unassigned.length} unassigned** — say "assign tasks"\n`
    if (done === total) reply += '\n🎉 **All tasks completed!** Amazing work!'
    else if (overdue.length > Math.max(3, total * 0.3)) reply += '\nConsider a team sync to get back on track.'
    else if (unassigned.length > total * 0.3) reply += '\nSay **"assign tasks"** to distribute them.'
    else reply += '\n👍 Looking good! Keep going!'
    return reply
  }

  if (lastMsg.match(/\b(overdue|behind|delay|late|missed)\b/)) {
    if (overdue.length === 0) return '✅ No overdue tasks. Everything is on schedule!'
    let reply = `⚠️ **${overdue.length} overdue tasks:**\n\n`
    overdue.slice(0, 8).forEach(t => {
      reply += `• "${t.title}"${t.assignee ? ` (${t.assignee})` : ' (unassigned)'}`
      if (t.due_date) reply += ` — was due ${new Date(t.due_date).toLocaleDateString()}`
      reply += '\n'
    })
    if (overdue.length > 8) reply += `\n...and ${overdue.length - 8} more.`
    reply += '\n\n**Tip:** Reassign or extend deadlines for these tasks.'
    return reply
  }

  if (lastMsg.match(/\b(how (to|do|can|should|would)|guide|instructions|step by step|walk me through|help me with|approach)\b/)) {
    const taskQuery = lastMsg.replace(/\b(how (to|do|can|should|would)|guide|instructions|step by step|walk me through|help me with|approach|tell me|explain)\b/g, '').trim()
    const matchingTask = context.tasks.find(t => taskQuery && t.title.toLowerCase().includes(taskQuery))
    if (matchingTask) {
      return `**Step-by-step: "${matchingTask.title}"**\n\n1. **Understand what's needed** — This task is about: ${matchingTask.title}. Make sure you're clear on the goal.\n2. **Break it down** — Split into smaller sub-tasks (use the subtasks section in task details).\n3. **Get started** — Move it to "In Progress" when you begin.\n4. **Ask questions** — Use task comments if you get stuck.\n5. **Submit for review** — Move to "Review" when done.\n\nNeed more detail on any of these steps? Just ask!`
    }
    const nextTodo = context.tasks.find(t => t.status === 'todo' || t.status === 'backlog')
    if (nextTodo) {
      return `**Next up:** "${nextTodo.title}"\n\nMove it to "In Progress" to start working on it. Break it into smaller steps, use subtasks, and comment if you need help. Want me to give you detailed steps for this specific task?`
    }
    if (hasTasks) return 'All tasks are done! 🎉 Ready for the next project?'
    return `No tasks yet in **${context.projectName}**. Create some first, then I can help guide you through each one!`
  }

  if (lastMsg.match(/\b(suggest|improve|recommend|advice|tip|optimize|better)\b/)) {
    const tips: string[] = []
    if (unassigned.length > 0) tips.push(`Assign **${unassigned.length} unassigned tasks** to team members`)
    if (overdue.length > 0) tips.push(`Review **${overdue.length} overdue tasks** and adjust deadlines`)
    if (total === 0) tips.push('Create your **first task** to get the project moving')
    if (tips.length === 0) tips.push('Everything looks good! Consider planning the next phase')
    return `**Suggestions:**\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
  }

  if (lastMsg.match(/\b(member|team|people|who|colleague)\b/) && !lastMsg.match(/\b(assign|task)\b/)) {
    if (!hasMembers) return 'No team members yet. Go to **Settings** to invite people.'
    let reply = `**Team (${context.members.length}):**\n\n`
    context.members.forEach(m => {
      const assigned = context.tasks.filter(t => t.assignee === m.name)
      const completed = assigned.filter(t => t.status === 'done').length
      reply += `• ${m.name} — ${completed}/${assigned.length} done\n`
    })
    return reply
  }

  if (lastMsg.match(/\b(thanks|thank|appreciate|great|awesome|perfect)\b/)) {
    return "You're welcome! 😊 Happy to help. Let me know if you need anything else!"
  }

  if (lastMsg.match(/\b(task|what.*do|list.*task|show.*task|all.*task)\b/)) {
    if (!hasTasks) return 'No tasks yet. Create some with the **Add task** button!'
    const byStatus: Record<string, string[]> = { backlog: [], todo: [], in_progress: [], review: [], done: [] }
    context.tasks.forEach(t => {
      if (byStatus[t.status]) byStatus[t.status].push(t.title)
    })
    let reply = `**All Tasks (${total}):**\n\n`
    for (const [status, items] of Object.entries(byStatus)) {
      if (items.length > 0) {
        reply += `*${status.replace('_', ' ').toUpperCase()}* — ${items.length}\n`
        items.slice(0, 5).forEach(t => reply += `  • ${t}\n`)
        if (items.length > 5) reply += `  ...and ${items.length - 5} more\n`
      }
    }
    return reply
  }

  if (lastMsg.match(/\b(generate|create|plan|new project|make.*project|build.*project)\b/)) {
    return `I can help plan a new project! Go to the **Projects page** → **New project** → describe what you want built → **Generate with AI**. I'll create a full plan with phases, tasks, and instructions.`
  }

  const contextPhrases = [
    `${context.projectName} has ${total} tasks (${done} done, ${overdue.length} overdue). What would you like to know?`,
    `I'm your AI supervisor for **${context.projectName}**. Ask me anything about the project!`,
    `We have ${unassigned.length} unassigned tasks and ${overdue.length} overdue. Say "assign tasks" or "how's it going?"`,
  ]
  return contextPhrases[Math.floor(Math.random() * contextPhrases.length)]
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json() as { messages: ChatMessage[]; context: ProjectContext }
    const systemPrompt = buildSystemPrompt(context)
    const conversation = messages.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n')
    const fullPrompt = `${systemPrompt}\n\nConversation history:\n${conversation}\n\nAgent:`

    const geminiResult = await tryGemini(fullPrompt)
    const reply = geminiResult || localSmartReply(messages, context)

    return NextResponse.json({ reply })
  } catch {
    return NextResponse.json({ reply: "I'm having trouble connecting. Please try again." }, { status: 200 })
  }
}
