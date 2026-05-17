import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

export interface ExtractedPlan {
  projectName: string
  description: string
  phases: { name: string; order: number }[]
  tasks: { title: string; phase: string; priority: string; estimated_hours: number | null; assignee?: string | null; instructions?: string }[]
  guide: string
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

const instructionTemplates: Record<string, string[]> = {
  planning: [
    'Start by researching the requirements. Talk to stakeholders and document what they need. Create a timeline and assign owners.',
    'Gather all necessary data and resources. Set up a shared workspace for documents and track progress in a spreadsheet.',
    'Define success criteria and KPIs. Create a project charter that everyone agrees on before moving forward.',
  ],
  development: [
    'Set up the development environment first. Follow best practices for code structure and version control with frequent commits.',
    'Break this task into smaller sub-tasks. Work iteratively and test each piece as you go. Ask for feedback early.',
    'Start with a working prototype, then refine. Use pair programming if possible and document your approach.',
  ],
  testing: [
    'Write test cases before you start testing. Cover edge cases and normal flows. Report bugs with clear reproduction steps.',
    'Run automated tests first, then manual testing. Focus on the most critical features first. Document any issues found.',
    'Perform regression testing to make sure nothing is broken. Get sign-off from stakeholders before marking done.',
  ],
  launch: [
    'Prepare a deployment checklist. Make sure all tests pass and documentation is complete before going live.',
    'Do a dry run of the launch process first. Have a rollback plan ready. Monitor closely after deployment.',
    'Coordinate with the team on launch timing. Prepare communication for stakeholders. Celebrate when it ships!',
  ],
  default: [
    'Start by understanding what needs to be done. Break it into smaller steps and track your progress.',
    'Collaborate with the team if you get stuck. Ask questions early rather than waiting until the deadline.',
    'Focus on quality over speed. Review your work before marking it complete and get feedback from peers.',
  ],
}

function generateInstructions(title: string, phase: string): string {
  const phaseLower = phase.toLowerCase()
  let templates: string[]
  if (phaseLower.includes('plan') || phaseLower.includes('research') || phaseLower.includes('design')) {
    templates = instructionTemplates.planning
  } else if (phaseLower.includes('develop') || phaseLower.includes('build') || phaseLower.includes('code') || phaseLower.includes('implement')) {
    templates = instructionTemplates.development
  } else if (phaseLower.includes('test') || phaseLower.includes('qa') || phaseLower.includes('review') || phaseLower.includes('debug')) {
    templates = instructionTemplates.testing
  } else if (phaseLower.includes('launch') || phaseLower.includes('deploy') || phaseLower.includes('release')) {
    templates = instructionTemplates.launch
  } else {
    templates = instructionTemplates.default
  }
  const tip = templates[Math.floor(Math.random() * templates.length)]
  return `**How to do this task:**\n1. Understand the goal: "${title}"\n2. ${tip}\n3. Update the task status as you make progress and add comments if you have questions.`
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
          instructions: generateInstructions(title, phases[phaseIndex].name),
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
        instructions: generateInstructions(title, phases[phaseIndex].name),
      })
    })
  }

  return {
    projectName,
    description: desc,
    phases,
    tasks: tasks.slice(0, 20),
    guide: `## Project Guide: ${projectName}\n\nThis project has been broken into ${phases.length} phases with ${Math.min(tasks.length, 20)} tasks.\n\n**How to use this guide:**\n• Each task has instructions on how to approach it\n• Assign yourself to tasks you want to work on\n• Move tasks through the workflow: Backlog → To Do → In Progress → Review → Done\n• Use comments to ask questions or give updates\n• The AI Agent can help you with any task — just click the Agent button\n\n**Tips for success:**\n1. Start with the first phase and work through tasks in order\n2. Don't hesitate to ask the AI Agent for help\n3. Update task status as you make progress so the team can see\n4. Complete all tasks in a phase before moving to the next`,
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
  const systemPrompt = `You are SnapTask AI, a project supervisor. Extract a project plan as JSON. Each task MUST have detailed instructions on how to do it, like a supervisor guiding a team member. Include a project guide with tips.

{
  "projectName": "string",
  "description": "string",
  "phases": [{ "name": "string", "order": number }],
  "tasks": [{ "title": "string", "phase": "string", "priority": "low|medium|high|urgent", "estimated_hours": number|null, "instructions": "string with step-by-step how-to guidance for the assignee" }],
  "guide": "string with overall project walkthrough and success tips"
}
Respond ONLY with valid JSON. No markdown.`

  const geminiResult = await tryGemini(`${systemPrompt}\n\nExtract from:\n${input}`)
  if (geminiResult) {
    try {
      const parsed = JSON.parse(cleanJson(geminiResult))
      if (!parsed.guide) parsed.guide = `## Project Guide\n\nThis project has ${parsed.phases?.length || 0} phases and ${parsed.tasks?.length || 0} tasks. Follow the instructions for each task.`
      return parsed as ExtractedPlan
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
