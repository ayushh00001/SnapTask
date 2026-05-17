'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const plans = [
  {
    name: 'Free',
    price: '$0',
    desc: 'For students and testing',
    features: ['1 project', '5 team members', 'Basic tasks', 'Kanban board'],
    current: true,
  },
  {
    name: 'Pro',
    price: '$19',
    desc: 'For freelancers and small teams',
    features: ['Unlimited projects', '15 team members', 'AI task extraction', 'Offline mode', 'Photo input'],
    current: false,
  },
  {
    name: 'Team',
    price: '$49',
    desc: 'For growing agencies',
    features: ['Up to 50 members', 'AI risk predictions', 'Team dashboards', 'Integrations', 'Priority support'],
    current: false,
  },
]

export default function BillingPage() {
  const handleUpgrade = (name: string) => {
    toast.info(`${name} plan — payment coming soon. Currently free for all users.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Current plan</h2>
            <Badge color="green">Free</Badge>
          </div>
          <p className="text-sm text-gray-500">All features are currently free during beta.</p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map(plan => (
          <Card key={plan.name} className={plan.current ? 'ring-2 ring-indigo-500' : ''}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                {plan.current && <Badge color="blue">Current</Badge>}
              </div>
              <p className="text-3xl font-bold text-gray-900">{plan.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <p className="mt-1 text-sm text-gray-500">{plan.desc}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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
