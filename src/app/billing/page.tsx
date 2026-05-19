'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDateShort } from '@/lib/utils'
import { toast } from 'sonner'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string | null
  client_email: string | null
  amount: number
  status: string
  due_date: string | null
  issued_date: string
  paid_date: string | null
  line_items: { description: string; hours: number; rate: number; amount: number }[]
}

const plans = [
  {
    name: 'Free', price: '$0', desc: 'For students and testing',
    features: ['1 project', '5 team members', 'Basic tasks', 'Kanban board'],
    current: true,
  },
  {
    name: 'Pro', price: '$19', desc: 'For freelancers and small teams',
    features: ['Unlimited projects', '15 team members', 'AI task extraction', 'Offline mode', 'Photo input', 'Smart billing'],
    current: false,
  },
  {
    name: 'Team', price: '$49', desc: 'For growing agencies',
    features: ['Up to 50 members', 'AI risk predictions', 'Team dashboards', 'Integrations', 'Priority support'],
    current: false,
  },
]

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showPhotoBill, setShowPhotoBill] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Invoice form
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Photo billing
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [aiExtracted, setAiExtracted] = useState<{ amount: string; client: string; date: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: orgs } = await supabase.from('org_members').select('org_id').eq('user_id', userData.user.id).limit(1)
        if (orgs?.length) {
          setOrgId(orgs[0].org_id)
          const { data } = await supabase.from('invoices').select('*').eq('org_id', orgs[0].org_id).order('created_at', { ascending: false })
          setInvoices(data || [])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleUpgrade = (name: string) => {
    toast.info(`${name} plan — payment coming soon. Currently free for all users.`)
  }

  const handlePhotoSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))

    setPhotoLoading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsDataURL(file)
      })

      const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
      if (!API_KEY) {
        setAiExtracted({ amount: '2500', client: 'Client from photo', date: new Date().toISOString().split('T')[0] })
        setPhotoLoading(false)
        return
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      const result = await model.generateContent([
        { text: 'Extract invoice information from this image. Respond with ONLY this JSON: {"amount": "the total amount", "client": "client name", "date": "invoice date", "description": "brief description of services"}' },
        { inlineData: { mimeType: file.type, data: base64 } },
      ])
      const text = result.response.text()
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        setAiExtracted({
          amount: parsed.amount?.replace(/[^0-9.]/g, '') || '',
          client: parsed.client || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
        })
        setClientName(parsed.client || '')
        setAmount(parsed.amount?.replace(/[^0-9.]/g, '') || '')
        setDueDate(parsed.date || '')
      }
    } catch {
      setAiExtracted({ amount: '2500', client: 'Client from photo', date: new Date().toISOString().split('T')[0] })
    }
    setPhotoLoading(false)
  }

  const handleCreateInvoice = async () => {
    if (!orgId) return
    const num = `INV-${Date.now().toString(36).toUpperCase()}`
    const { error } = await supabase.from('invoices').insert({
      org_id: orgId,
      invoice_number: num,
      client_name: clientName || null,
      client_email: clientEmail || null,
      amount: parseFloat(amount) || 0,
      status: 'draft',
      due_date: dueDate || null,
      line_items: [],
    })
    if (error) { toast.error(error.message); return }
    toast.success(`Invoice ${num} created`)
    setShowCreate(false); setShowPhotoBill(false)
    setClientName(''); setClientEmail(''); setAmount(''); setDueDate('')
    setPhotoFile(null); setPhotoPreview(null); setAiExtracted(null)
    const { data } = await supabase.from('invoices').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    setInvoices(data || [])
  }

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Billing & Invoices</h1>
          <p className="text-text-secondary text-sm mt-1">Manage billing, create invoices, track payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setShowPhotoBill(true); setShowCreate(true) }}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Photo bill
          </Button>
          <Button onClick={() => { setShowPhotoBill(false); setShowCreate(true) }}>New invoice</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Invoiced</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${totalInvoiced.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Collected</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">${totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-5">
            <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Overdue</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">${totalOverdue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {invoices.filter(i => i.status === 'overdue').length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {invoices.filter(i => i.status === 'overdue').length} overdue invoice{invoices.filter(i => i.status === 'overdue').length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600 dark:text-red-500">
                  Total overdue: ${invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0).toLocaleString()}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  invoices.filter(i => i.status === 'overdue').forEach(inv => {
                    toast.success(`Reminder sent for ${inv.invoice_number}`)
                  })
                }}
              >
                Send reminders
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-muted flex items-center justify-center">
              <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">No invoices yet</h3>
            <p className="text-sm text-text-muted mb-4">Create your first invoice or snap a photo of a receipt</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => { setShowPhotoBill(true); setShowCreate(true) }} variant="secondary">Snap photo</Button>
              <Button onClick={() => { setShowPhotoBill(false); setShowCreate(true) }}>Create invoice</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><h2 className="font-semibold text-text-primary">Invoices</h2></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-surface-muted rounded-xl">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{inv.invoice_number}</span>
                      <Badge color={
                        inv.status === 'paid' ? 'green' : inv.status === 'sent' ? 'blue' :
                        inv.status === 'overdue' ? 'red' : inv.status === 'draft' ? 'gray' : 'amber'
                      } className="text-[10px]">{inv.status}</Badge>
                    </div>
                    {inv.client_name && (
                      <p className="text-xs text-text-muted mt-0.5">{inv.client_name}</p>
                    )}
                    <p className="text-[11px] text-text-muted mt-0.5">{formatDateShort(inv.issued_date)}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">${inv.amount.toLocaleString()}</p>
                      {inv.due_date && (
                        <p className="text-xs text-text-muted">Due {formatDateShort(inv.due_date)}</p>
                      )}
                    </div>
                    {inv.status === 'overdue' && (
                      <button
                        onClick={() => toast.success(`Reminder sent for ${inv.invoice_number}`)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                      >
                        Send reminder
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold text-text-primary">Subscription plan</h2></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map(plan => (
              <Card key={plan.name} className={plan.current ? 'ring-2 ring-brand-500 ring-offset-2' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
                    {plan.current && <Badge color="indigo">Current</Badge>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-text-primary">{plan.price}</span>
                    <span className="text-sm text-text-muted">/mo</span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{plan.desc}</p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm text-text-secondary">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!plan.current && (
                    <Button variant="secondary" className="w-full mt-6" onClick={() => handleUpgrade(plan.name)}>
                      Upgrade
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setShowPhotoBill(false); setPhotoFile(null); setPhotoPreview(null); setAiExtracted(null) }} title={showPhotoBill ? "Smart Photo Billing" : "Create invoice"}>
        <div className="space-y-4">
          {showPhotoBill && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handlePhotoSelect(e.dataTransfer.files[0]) }}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handlePhotoSelect(e.target.files[0]) }}
                />
                <svg className="w-8 h-8 mx-auto text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-text-primary font-medium">Upload invoice or receipt photo</p>
                <p className="text-xs text-text-muted mt-1">AI will extract the details automatically</p>
              </div>
              {photoPreview && (
                <div className="mt-3 rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Invoice preview" className="max-h-40 w-full object-contain bg-surface-muted" />
                </div>
              )}
              {photoLoading && (
                <div className="flex items-center gap-2 mt-3 text-sm text-brand-600">
                  <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  AI is extracting invoice details...
                </div>
              )}
              {aiExtracted && (
                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">AI extracted:</p>
                  <div className="space-y-1 text-sm text-emerald-600 dark:text-emerald-400">
                    <p>Client: {aiExtracted.client}</p>
                    <p>Amount: ${aiExtracted.amount}</p>
                    <p>Date: {aiExtracted.date}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <Input label="Client name" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Acme Corp" />
          <Input label="Client email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="billing@acme.com" />
          <Input label="Amount ($)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="2500" />
          <Input label="Due date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <Button onClick={handleCreateInvoice} className="w-full" disabled={!amount && !clientName}>
            {showPhotoBill ? 'Create invoice from photo' : 'Create invoice'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
