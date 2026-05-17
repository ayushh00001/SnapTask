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

type Intent =
  | 'greeting' | 'assign' | 'overdue' | 'progress' | 'suggest'
  | 'members' | 'tasks' | 'status' | 'thanks' | 'help' | 'generate' | 'unknown'

function detectIntent(q: string): Intent {
  if (/\b(hi|hello|hey|sup|howdy|good\s*(morning|afternoon|evening))\b/.test(q)) return 'greeting'
  if (/\b(assign|unassigned|who (should|can|will)|give (this|the).*to|allocate|distribute)\b/.test(q)) return 'assign'
  if (/\b(overdue|behind|delay|lateness|late|missed|falling behind)\b/.test(q)) return 'overdue'
  if (/\b(progress|review|status|done|completed|finished|how.*(going|far|along)|report|summary|overview)\b/.test(q)) return 'progress'
  if (/\b(suggest|improve|recommend|advice|tip|optimize|better|help)\b/.test(q)) return 'suggest'
  if (/\b(who|member|team|people|colleague|coworker)\b/.test(q) && !/\b(assign|task)\b/.test(q)) return 'members'
  if (/\b(task|what.*do|list.*task|show.*task|all.*task)\b/.test(q)) return 'tasks'
  if (/\b(how are|status|what can|help|capabilities)\b/.test(q)) return 'help'
  if (/\b(thanks|thank|appreciate|great|awesome|perfect)\b/.test(q)) return 'thanks'
  if (/\b(generate|create|plan|new project|make.*project|build.*project|start.*project)\b/.test(q)) return 'generate'
  return 'unknown'
}

function localReply(messages: ChatMessage[], context: ProjectContext): string {
  const last = messages[messages.length - 1]
  const q = last.content.toLowerCase()
  const intent = detectIntent(q)

  const unassigned = context.tasks.filter(t => !t.assignee)
  const overdue = context.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const done = context.tasks.filter(t => t.status === 'done')
  const inProgress = context.tasks.filter(t => t.status === 'in_progress')
  const total = context.tasks.length

  switch (intent) {
    case 'greeting':
      return `Hello! I'm SnapTask AI Agent, your project assistant for **${context.projectName}**. I can:\n• **Assign tasks** to team members\n• **Review progress** and flag risks\n• **Suggest improvements**\n• List **team members** and their work\n\nWhat would you like help with?`

    case 'assign':
      if (unassigned.length === 0) return '✅ All tasks already have assignees. Nice work!'
      if (context.members.length === 0) return 'No team members yet. Invite people to this project first.'
      let suggestions = `Found **${unassigned.length} unassigned task${unassigned.length > 1 ? 's' : ''}**. Here's how I'd split them:\n`
      const shuffled = [...context.members].sort(() => Math.random() - 0.5)
      unassigned.slice(0, 8).forEach((t, i) => {
        const m = shuffled[i % shuffled.length]
        suggestions += `• "${t.title}" → **${m.name}**\n`
      })
      if (unassigned.length > 8) suggestions += `\n...and ${unassigned.length - 8} more.`
      suggestions += `\n\nSay **"assign them"** to confirm these assignments.`
      return suggestions

    case 'overdue':
      if (overdue.length === 0) return '✅ No overdue tasks. Everything is on schedule!'
      let overdueMsg = `⚠️ **${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}** that need attention:\n`
      overdue.slice(0, 5).forEach(t => {
        const assignee = t.assignee ? ` (${t.assignee})` : ' (unassigned)'
        overdueMsg += `• "${t.title}"${assignee} — was due ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}\n`
      })
      if (overdue.length > 5) overdueMsg += `\n...and ${overdue.length - 5} more.`
      overdueMsg += `\n\nTip: Try reassigning or extending deadlines for these tasks.`
      return overdueMsg

    case 'progress':
      if (total === 0) return 'No tasks yet. Start by creating some with the **Add task** button!'
      const pct = Math.round(done.length / total * 100)
      let progMsg = `**${context.projectName} — ${pct}% complete**\n\n`
      progMsg += `\`\`\`\n${renderBar(pct)}\n\`\`\`\n\n`
      progMsg += `• Done: **${done.length}**\n• In Progress: **${inProgress.length}**\n• Todo: **${total - done.length - inProgress.length}**\n• Overdue: **${overdue.length}**\n• Unassigned: **${unassigned.length}**\n\n`
      if (done.length === total) progMsg += '🎉 **All tasks completed!** Great work!'
      else if (overdue.length > total * 0.3) progMsg += '⚠️ A lot of tasks are overdue — consider a planning session.'
      else if (unassigned.length > total * 0.3) progMsg += '📋 Many tasks are unassigned — want me to suggest assignments?'
      else progMsg += '👍 Project is on track. Keep it up!'
      return progMsg

    case 'suggest':
      const tips: string[] = []
      if (unassigned.length > 0) tips.push(`Assign **${unassigned.length} unassigned tasks** to team members`)
      if (overdue.length > 0) tips.push(`Review **${overdue.length} overdue tasks** and adjust deadlines`)
      if (inProgress.length > 3) tips.push(`Only **${inProgress.length} tasks in progress** — focus on completing a few before starting more`)
      if (total === 0) tips.push('Create your **first task** to get the project moving')
      if (tips.length === 0) tips.push('Everything looks good! Consider planning the next sprint')
      return `**Suggestions for improvement:**\n\n${tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`

    case 'members':
      if (context.members.length === 0) return 'No team members in this project yet. Go to **Settings** to invite people.'
      let memberMsg = `**Team Members (${context.members.length})**:\n\n`
      context.members.forEach(m => {
        const taskCount = context.tasks.filter(t => t.assignee === m.name).length
        const doneCount = context.tasks.filter(t => t.assignee === m.name && t.status === 'done').length
        memberMsg += `• ${m.name} — ${doneCount}/${taskCount} tasks done\n`
      })
      return memberMsg

    case 'tasks':
      if (total === 0) return 'No tasks yet. Create one with the **Add task** button!'
      const byStatus: Record<string, string[]> = { backlog: [], todo: [], in_progress: [], review: [], done: [] }
      context.tasks.forEach(t => {
        if (byStatus[t.status]) byStatus[t.status].push(t.title)
      })
      let taskMsg = `**All Tasks (${total})**:\n\n`
      for (const [status, items] of Object.entries(byStatus)) {
        if (items.length > 0) {
          taskMsg += `*${status.replace('_', ' ').toUpperCase()}*: ${items.length}\n`
        }
      }
      taskMsg += `\nVisit the project board to see full details.`
      return taskMsg

    case 'thanks':
      return "You're welcome! 😊 Let me know if you need anything else — I can help with assignments, progress reports, and more."

    case 'generate':
      if (context.tasks.length > 0) {
        return `This project already has ${context.tasks.length} tasks. If you want to create a **new project**, go to the Projects page and click **"New project"** — describe what you need and AI will generate a full plan with tasks assigned to team members!`
      }
      return `I can help plan this project! Here's what I recommend:\n\n1. Go to the **Projects page**\n2. Click **"New project"**\n3. Describe your project in detail\n4. Click **"Generate with AI"**\n\nThe AI will:\n• Create project phases\n• Generate tasks for each phase\n• **Auto-assign tasks to team members** equally\n• Set priorities and estimates\n\nWant me to suggest a project structure based on "${context.projectName}"?\n\n**Suggested phases:**\n• Planning & Research\n• Design & Architecture\n• Development\n• Testing & QA\n• Deployment & Launch\n\nSay **"yes"** and I'll create this structure for you!`

    case 'help':
      return `Here's what I can do:\n\n• **Assign tasks** — "Assign tasks to the team"\n• **Check progress** — "How is the project going?"\n• **Find overdue items** — "Show me overdue tasks"\n• **Suggest improvements** — "Any suggestions?"\n• **List members** — "Who is on the team?"\n• **Show tasks** — "What tasks do we have?"\n• **Generate projects** — "Create a new project"\n\nWhat would you like?`

    default:
      const phrases = [
        `I'm not sure I understood "${last.content.slice(0, 40)}". Here's what I can help with:`,
        `I don't have a specific answer for that. Try asking me about:`,
        `I can't quite parse that. I work best with commands like:`,
      ]
      return `${phrases[Math.floor(Math.random() * phrases.length)]}\n\n• **"Assign tasks"** — auto-assign unassigned tasks\n• **"How is the project going?"** — progress report\n• **"Show overdue tasks"** — list late items\n• **"Any suggestions?"** — get improvement tips\n• **"Who's on the team?"** — list members\n• **"What can you do?"** — see all capabilities`
  }
}

function renderBar(pct: number): string {
  const filled = Math.round(pct / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`
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
