'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const plans = [
  {
    name: 'Free', price: '$0', desc: 'For students and testing',
    features: ['1 project', '5 team members', 'Basic tasks', 'Kanban board'],
    current: true,
  },
  {
    name: 'Pro', price: '$19', desc: 'For freelancers and small teams',
    features: ['Unlimited projects', '15 team members', 'AI task extraction', 'Offline mode', 'Photo input'],
    current: false,
  },
  {
    name: 'Team', price: '$49', desc: 'For growing agencies',
    features: ['Up to 50 members', 'AI risk predictions', 'Team dashboards', 'Integrations', 'Priority support'],
    current: false,
  },
]

export default function BillingPage() {
  const handleUpgrade = (name: string) => {
    toast.info(`${name} plan — payment coming soon. Currently free for all users.`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Billing</h1>
        <p className="text-text-secondary text-sm mt-1">Manage your subscription plan</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-text-primary">Current plan</h2>
                <p className="text-sm text-text-muted">All features are free during beta</p>
              </div>
            </div>
            <Badge color="green">Free</Badge>
          </div>
        </CardHeader>
      </Card>

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
                    <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
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
    </div>
  )
}
