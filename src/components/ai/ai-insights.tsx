'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { predictRisks } from '@/lib/ai/gemini'
import type { Project, ProjectTask } from '@/lib/types'
import { toast } from 'sonner'

export function AiInsights({ project, tasks }: { project: Project; tasks: ProjectTask[] }) {
  const [risks, setRisks] = useState<{ type: string; severity: string; message: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const result = await predictRisks(
        project.name,
        tasks.map(t => ({
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          assignee: t.assignee_id,
        })),
      )

      const supabase = createClient()
      for (const risk of result.risks) {
        await supabase.from('ai_predictions').insert({
          project_id: project.id,
          type: risk.type,
          severity: risk.severity,
          message: risk.message,
          details: {},
        })
      }
      setRisks(result.risks)
      setGenerated(true)
      toast.success('Analysis complete')
    } catch (e) {
      toast.error('AI analysis failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length,
    unassigned: tasks.filter(t => !t.assignee_id).length,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total tasks', value: stats.total },
          { label: 'Completed', value: stats.done },
          { label: 'In progress', value: stats.inProgress },
          { label: 'Overdue', value: stats.overdue, highlight: stats.overdue > 0 },
        ].map(s => (
          <div key={s.label} className="text-center p-3 bg-gray-50 rounded-lg">
            <p className={`text-2xl font-bold ${s.highlight ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {stats.unassigned > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {stats.unassigned} task{stats.unassigned > 1 ? 's are' : ' is'} unassigned
        </div>
      )}

      <Button onClick={runAnalysis} loading={loading} className="w-full">
        {loading ? 'Analyzing...' : generated ? 'Re-analyze' : 'Run AI risk analysis'}
      </Button>

      {risks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">AI Predictions</h3>
          {risks.map((risk, i) => (
            <div key={i} className={`p-3 rounded-lg border text-sm ${
              risk.severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' :
              risk.severity === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium uppercase px-1.5 py-0.5 rounded bg-white/50">{risk.type}</span>
                <span className="text-xs font-medium uppercase">{risk.severity}</span>
              </div>
              <p>{risk.message}</p>
            </div>
          ))}
        </div>
      )}

      {generated && risks.length === 0 && (
        <p className="text-sm text-gray-500 text-center">No risks detected. Project looks healthy!</p>
      )}
    </div>
  )
}
