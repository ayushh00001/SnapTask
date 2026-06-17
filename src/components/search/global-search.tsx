'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SearchResult {
  id: string
  title: string
  type: 'project' | 'task'
  project_name?: string
  project_id?: string
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const supabase = createClient()
    const timer = setTimeout(async () => {
      const [projectsRes, tasksRes] = await Promise.all([
        supabase.from('projects').select('id, name').ilike('name', `%${query}%`).limit(5),
        supabase.from('tasks').select('id, title, project_id').ilike('title', `%${query}%`).limit(5),
      ])
      const combined: SearchResult[] = [
        ...(projectsRes.data || []).map(p => ({ id: p.id, title: p.name, type: 'project' as const })),
        ...(tasksRes.data || []).map(t => ({ id: t.id, title: t.title, type: 'task' as const, project_id: t.project_id })),
      ]
      setResults(combined)
      setSelected(0)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (r: SearchResult) => {
    setOpen(false)
    if (r.type === 'project') router.push(`/projects/${r.id}`)
    else router.push(`/projects/${r.project_id || ''}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) handleSelect(results[selected])
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-muted border border-border-light text-text-muted text-sm w-64 hover:border-border hover:text-text-secondary transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search projects...</span>
        <kbd className="ml-auto px-1.5 py-0.5 rounded bg-white border border-border text-[10px] font-medium text-text-muted">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-border-light w-full max-w-lg overflow-hidden animate-[fadeScaleIn_0.15s_ease]">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border-light">
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search projects and tasks..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button onClick={() => setOpen(false)} className="text-xs text-text-muted bg-surface-muted px-2 py-1 rounded-md font-medium">ESC</button>
            </div>
            {results.length > 0 && (
              <div className="p-2 max-h-80 overflow-y-auto">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      i === selected ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      r.type === 'project' ? 'bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600' : 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {r.type === 'project'
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        }
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
                      <p className="text-xs text-text-muted capitalize">{r.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && results.length === 0 && (
              <div className="p-8 text-center text-sm text-text-muted">No results found</div>
            )}
          </div>
          <style jsx global>{`
            @keyframes fadeScaleIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
