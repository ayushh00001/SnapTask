import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '')

const SYSTEM_PROMPT = `You are SnapTask AI, a project management assistant. Extract structured data from user input.

For task extraction, return JSON:
{
  "projectName": "string",
  "description": "string",
  "phases": [{ "name": "string", "order": number }],
  "tasks": [{ "title": "string", "phase": "string" (phase name), "priority": "low|medium|high|urgent", "estimated_hours": number|null }]
}

For risk analysis, return JSON:
{
  "risks": [{ "type": "risk|bottleneck|overdue|workload", "severity": "low|medium|high", "message": "string", "details": {} }]
}

Respond ONLY with valid JSON.`

function getModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
}

export interface ExtractedPlan {
  projectName: string
  description: string
  phases: { name: string; order: number }[]
  tasks: { title: string; phase: string; priority: string; estimated_hours: number | null }[]
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

export async function extractTasksFromText(input: string): Promise<ExtractedPlan> {
  const model = getModel()
  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: `Extract a project plan from this description:\n\n${input}` },
  ])
  const text = result.response.text()
  return JSON.parse(cleanJson(text))
}

export async function extractTasksFromImage(base64Image: string, mimeType: string): Promise<ExtractedPlan> {
  const model = getModel()
  const imagePart = { inlineData: { data: base64Image, mimeType } }
  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: 'Extract tasks and project structure from this image (whiteboard, notes, or sketch):' },
    imagePart,
  ])
  const text = result.response.text()
  return JSON.parse(cleanJson(text))
}

export async function predictRisks(
  projectName: string,
  tasks: { title: string; status: string; due_date: string | null; assignee: string | null }[],
): Promise<RiskPrediction> {
  const model = getModel()
  const input = JSON.stringify({ projectName, tasks })
  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: `Analyze risks for this project:\n\n${input}` },
  ])
  const text = result.response.text()
  return JSON.parse(cleanJson(text))
}
