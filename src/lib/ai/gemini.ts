import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

export interface ExtractedPlan {
  projectName: string
  description: string
  phases: { name: string; order: number }[]
  tasks: { title: string; phase: string; priority: string; estimated_hours: number | null; assignee?: string | null }[]
}

export function distributeTasksEvenly(
  tasks: ExtractedPlan['tasks'],
  members: { id: string; name: string }[],
): ExtractedPlan['tasks'] {
  if (members.length === 0) return tasks
  const shuffled = [...members].sort(() => Math.random() - 0.5)
  return tasks.map((t, i) => ({ ...t, assignee: shuffled[i % shuffled.length].id }))
}

export interface RiskPrediction {
  risks: {
    type: 'risk' | 'bottleneck' | 'overdue' | 'workload'
    severity: 'low' | 'medium' | 'high'
    message: string
    details: Record<string, unknown>
  }[]
}

function cleanJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  return match ? match[0] : text
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

function localExtractPlan(input: string): ExtractedPlan {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
  const projectName = lines[0].length < 60 ? lines[0] : 'New Project'
  const desc = lines.slice(1, 3).join(' ') || input.slice(0, 100)

  const phaseKeywords: { name: string; keywords: string[] }[] = [
    { name: 'Planning', keywords: ['plan', 'research', 'requirement', 'analysis', 'design'] },
    { name: 'Development', keywords: ['develop', 'build', 'code', 'implement', 'frontend', 'backend', 'api'] },
    { name: 'Testing', keywords: ['test', 'qa', 'review', 'debug', 'quality'] },
    { name: 'Launch', keywords: ['launch', 'deploy', 'release', 'go live', 'ship'] },
  ]

  const matchedPhases = new Set<string>()
  const tasks: ExtractedPlan['tasks'] = []
  const text = input.toLowerCase()

  for (const kw of phaseKeywords) {
    if (kw.keywords.some(k => text.includes(k))) {
      matchedPhases.add(kw.name)
    }
  }

  const phases: ExtractedPlan['phases'] = []
  const phaseLines = lines.filter(l =>
    l.match(/phase|step|stage|milestone/i) || l.match(/^\d+\./)
  )

  if (phaseLines.length > 0) {
    phaseLines.forEach((l, i) => {
      const name = l.replace(/^\d+[\.\)]\s*/, '').replace(/^(phase|step|stage)\s*\d*:?\s*/i, '').trim()
      if (name) phases.push({ name, order: i })
    })
  }

  if (phases.length === 0) {
    ;[...matchedPhases].forEach((name, i) => phases.push({ name, order: i }))
  }
  if (phases.length === 0) {
    phases.push({ name: 'Phase 1', order: 0 })
  }

  const taskLines = lines.filter(l =>
    !l.match(/^(phase|step|stage)/i) &&
    l.match(/^[-•*]|^\d+[\.\)]/)
  )

  if (taskLines.length > 0) {
    taskLines.forEach((l, i) => {
      const title = l.replace(/^[-•*\d\s\.\)]+/, '').trim()
      if (title && title.length > 3) {
        const phaseIndex = i % phases.length
        const priority = i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low'
        tasks.push({
          title,
          phase: phases[phaseIndex].name,
          priority,
          estimated_hours: [2, 4, 8, 16][Math.floor(Math.random() * 4)],
        })
      }
    })
  }

  if (tasks.length === 0) {
    const rawLines = lines.filter(l => l.length > 10 && !l.match(/https?:\/\//))
    rawLines.forEach((l, i) => {
      const phaseIndex = i % phases.length
      const title = l.length > 50 ? l.substring(0, 50) + '...' : l
      tasks.push({
        title,
        phase: phases[phaseIndex].name,
        priority: i === 0 ? 'high' : 'medium',
        estimated_hours: [2, 4, 8][Math.floor(Math.random() * 3)],
      })
    })
  }

  return {
    projectName,
    description: desc,
    phases,
    tasks: tasks.slice(0, 20),
  }
}

function localPredictRisks(
  _projectName: string,
  tasks: { title: string; status: string; due_date: string | null; assignee: string | null }[],
): RiskPrediction {
  const risks: RiskPrediction['risks'] = []
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassigned = tasks.filter(t => !t.assignee)
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const notStarted = tasks.filter(t => t.status === 'todo' || t.status === 'backlog')

  if (overdue.length > 0) {
    risks.push({
      type: 'overdue',
      severity: overdue.length > 3 ? 'high' : 'medium',
      message: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue`,
      details: { count: overdue.length },
    })
  }

  if (unassigned.length > 0) {
    risks.push({
      type: 'workload',
      severity: unassigned.length > 5 ? 'high' : 'low',
      message: `${unassigned.length} task${unassigned.length > 1 ? 's have' : ' has'} no assignee`,
      details: { count: unassigned.length },
    })
  }

  if (notStarted.length > 5) {
    risks.push({
      type: 'bottleneck',
      severity: 'medium',
      message: `${notStarted.length} tasks haven't been started yet`,
      details: { count: notStarted.length },
    })
  }

  if (risks.length === 0) {
    risks.push({
      type: 'risk',
      severity: 'low',
      message: 'Project is on track',
      details: {},
    })
  }

  return { risks }
}

export async function extractTasksFromText(input: string): Promise<ExtractedPlan> {
  const systemPrompt = `You are SnapTask AI. Extract a project plan as JSON:
{
  "projectName": "string",
  "description": "string",
  "phases": [{ "name": "string", "order": number }],
  "tasks": [{ "title": "string", "phase": "string", "priority": "low|medium|high|urgent", "estimated_hours": number|null }]
}
Respond ONLY with valid JSON. No markdown.`

  const geminiResult = await tryGemini(`${systemPrompt}\n\nExtract from:\n${input}`)
  if (geminiResult) {
    try {
      return JSON.parse(cleanJson(geminiResult))
    } catch {
      // fall through to local
    }
  }

  return localExtractPlan(input)
}

export async function extractTasksFromImage(base64Image: string, mimeType: string): Promise<ExtractedPlan> {
  if (!genAI) return localExtractPlan('New project from image')

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const imagePart = { inlineData: { data: base64Image, mimeType } }
      const result = await model.generateContent([
        { text: 'Extract tasks and project structure from this image as JSON. Use the same JSON format as text extraction.' },
        imagePart,
      ])
      return JSON.parse(cleanJson(result.response.text()))
    } catch {
      continue
    }
  }

  return localExtractPlan('Project from image')
}

export async function predictRisks(
  projectName: string,
  tasks: { title: string; status: string; due_date: string | null; assignee: string | null }[],
): Promise<RiskPrediction> {
  const systemPrompt = `Analyze project risks as JSON:
{
  "risks": [{ "type": "risk|bottleneck|overdue|workload", "severity": "low|medium|high", "message": "string", "details": {} }]
}`

  const geminiResult = await tryGemini(`${systemPrompt}\n\nProject: ${projectName}\nTasks: ${JSON.stringify(tasks)}`)
  if (geminiResult) {
    try {
      return JSON.parse(cleanJson(geminiResult))
    } catch {
      // fall through
    }
  }

  return localPredictRisks(projectName, tasks)
}
