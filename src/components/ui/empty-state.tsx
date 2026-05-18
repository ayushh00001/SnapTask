'use client'

import { type ReactNode } from 'react'

const illustrations: Record<string, ReactNode> = {
  projects: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="25" width="80" height="70" rx="8" stroke="#E2E6EF" strokeWidth="2" fill="#F8F9FC" />
      <rect x="30" y="35" width="25" height="4" rx="2" fill="#C7D2FE" />
      <rect x="30" y="45" width="40" height="3" rx="1.5" fill="#E2E6EF" />
      <rect x="30" y="55" width="35" height="3" rx="1.5" fill="#E2E6EF" />
      <rect x="30" y="65" width="60" height="3" rx="1.5" fill="#E2E6EF" />
      <rect x="30" y="75" width="20" height="3" rx="1.5" fill="#E2E6EF" />
      <circle cx="85" cy="40" r="12" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5" />
      <path d="M85 35v10M80 40h10" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  tasks: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="25" y="20" width="70" height="18" rx="6" stroke="#E2E6EF" strokeWidth="1.5" fill="#F8F9FC" />
      <circle cx="35" cy="29" r="4" fill="#C7D2FE" />
      <rect x="44" y="27" width="30" height="3" rx="1.5" fill="#E2E6EF" />
      <rect x="25" y="46" width="70" height="18" rx="6" stroke="#E2E6EF" strokeWidth="1.5" fill="#F8F9FC" />
      <circle cx="35" cy="55" r="4" fill="#C7D2FE" />
      <rect x="44" y="53" width="40" height="3" rx="1.5" fill="#E2E6EF" />
      <rect x="25" y="72" width="70" height="18" rx="6" stroke="#E2E6EF" strokeWidth="1.5" fill="#F8F9FC" />
      <circle cx="35" cy="81" r="4" fill="#E2E6EF" />
      <rect x="44" y="79" width="25" height="3" rx="1.5" fill="#E2E6EF" />
    </svg>
  ),
  team: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="45" cy="35" r="12" stroke="#E2E6EF" strokeWidth="2" fill="#F8F9FC" />
      <circle cx="45" cy="35" r="5" fill="#C7D2FE" />
      <path d="M30 65c0-8.284 6.716-15 15-15s15 6.716 15 15" stroke="#E2E6EF" strokeWidth="2" fill="#F8F9FC" />
      <circle cx="75" cy="35" r="12" stroke="#E2E6EF" strokeWidth="2" fill="#F8F9FC" />
      <circle cx="75" cy="35" r="5" fill="#E2E6EF" />
      <path d="M60 65c0-8.284 6.716-15 15-15s15 6.716 15 15" stroke="#E2E6EF" strokeWidth="2" fill="#F8F9FC" />
      <path d="M55 80h30" stroke="#C7D2FE" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M45 80h10" stroke="#C7D2FE" strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  ),
}

export function EmptyState({
  type = 'projects',
  title,
  description,
  action,
}: {
  type?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-32 h-32 mb-6 animate-float">{illustrations[type] || illustrations.projects}</div>
      <h3 className="text-lg font-semibold text-text-primary text-center">{title}</h3>
      {description && <p className="text-sm text-text-secondary text-center mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
