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

async function tryGemini(prompt: string, timeoutMs = 8000): Promise<string | null> {
  if (!genAI) return null
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await Promise.race([
        model.generateContent([{ text: prompt }]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ])
      const text = (result as Awaited<ReturnType<typeof model.generateContent>>).response.text()
      if (text && text.length > 10) return text
    } catch {
      continue
    }
  }
  return null
}

const projectTemplates: Record<string, {
  phases: { name: string; order: number }[]
  generateTasks: (projectName: string) => { title: string; phase: string; priority: string; estimated_hours: number; instructions: string }[]
  guide: (projectName: string) => string
}> = {
  website: {
    phases: [
      { name: 'Planning & Research', order: 0 },
      { name: 'Design', order: 1 },
      { name: 'Frontend Development', order: 2 },
      { name: 'Backend Development', order: 3 },
      { name: 'Testing & Launch', order: 4 },
    ],
    generateTasks: (name) => [
      { title: `Define goals and target audience for ${name}`, phase: 'Planning & Research', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Write down what ${name} needs to achieve (e.g., sell products, showcase portfolio, provide information)\n2. Identify who will use the site — their age, needs, and technical skill level\n3. Research 3-5 competitor websites in the same space\n4. List 5 key features the site must have\n5. Create a one-page project brief summarizing your findings' },
      { title: 'Create sitemap and wireframes', phase: 'Planning & Research', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. List all pages the website needs (Home, About, Services, Contact, etc.)\n2. Draw rough wireframes for each page — paper sketches are fine\n3. Plan the user flow: what does a visitor do from landing to goal?\n4. Use a tool like Figma or draw.io to create digital wireframes\n5. Get feedback from stakeholders before moving to design' },
      { title: 'Design visual mockups and brand guide', phase: 'Design', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Choose a color palette (primary, secondary, accent) — use coolors.co for inspiration\n2. Pick 2-3 fonts (one for headings, one for body text)\n3. Design high-fidelity mockups in Figma or similar\n4. Create a style guide document with colors, fonts, button styles, spacing\n5. Ensure designs are responsive (desktop + mobile versions)' },
      { title: 'Set up development environment', phase: 'Frontend Development', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Choose your stack (Next.js 14+, Tailwind CSS, TypeScript recommended)\n2. Initialize the project with `npx create-next-app@latest`\n3. Install dependencies: Tailwind CSS, any UI libraries needed\n4. Set up folder structure: components/, app/, lib/, public/\n5. Configure Tailwind with your brand colors and fonts\n6. Initialize Git and make your first commit' },
      { title: 'Build layout shell (header, footer, navigation)', phase: 'Frontend Development', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Create a Layout component with Header (logo + nav links) and Footer\n2. Make navigation responsive — hamburger menu on mobile\n3. Add the layout to all pages using Next.js root layout\n4. Style everything to match your brand guide\n5. Test navigation works on desktop, tablet, and mobile' },
      { title: 'Build homepage', phase: 'Frontend Development', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Create hero section with headline, subtext, and CTA button\n2. Add features/services section highlighting key offerings\n3. Include a testimonials or social proof section\n4. Add a contact form or call-to-action section\n5. Optimize images and ensure fast loading\n6. Test the page at different screen sizes' },
      { title: 'Build inner pages (About, Services, Contact)', phase: 'Frontend Development', priority: 'medium', estimated_hours: 8, instructions: '**How to do this task:**\n1. About page: company story, team photos, mission statement\n2. Services/Products page: detailed descriptions with images\n3. Contact page: form with name/email/message fields, Google Maps embed\n4. Ensure consistent styling across all pages\n5. Add page transitions or animations for polish' },
      { title: 'Set up backend API and database', phase: 'Backend Development', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Set up Supabase project (or your chosen backend)\n2. Create database tables for contacts, users, or content\n3. Set up API routes in Next.js for form submissions\n4. Add server-side validation for all inputs\n5. Test API endpoints with a tool like Postman' },
      { title: 'Add authentication and user accounts', phase: 'Backend Development', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Implement sign-up/sign-in with Supabase Auth\n2. Add protected routes for authenticated users\n3. Create user profile page\n4. Handle password reset flow\n5. Test the full auth flow end-to-end' },
      { title: 'Test all features and fix bugs', phase: 'Testing & Launch', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Test every link, button, and form on the site\n2. Check the site on Chrome, Firefox, Safari, and Edge\n3. Test on real mobile devices (iPhone, Android)\n4. Run Lighthouse audit for performance + accessibility\n5. Fix any broken layouts, slow pages, or form errors\n6. Get a friend or colleague to do a fresh walkthrough' },
      { title: 'Deploy to production', phase: 'Testing & Launch', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Push code to GitHub repository\n2. Connect repo to Vercel (or your hosting provider)\n3. Set up environment variables on the hosting platform\n4. Configure custom domain (if you have one)\n5. Set up SSL certificate (automatic with Vercel)\n6. Deploy and verify everything works on the live URL\n7. Set up analytics (Google Analytics or Plausible)' },
      { title: 'Post-launch monitoring and SEO', phase: 'Testing & Launch', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Submit sitemap to Google Search Console\n2. Add meta tags and OG images for social sharing\n3. Set up uptime monitoring (e.g., UptimeRobot)\n4. Create a maintenance plan for updates and backups\n5. Plan the first round of improvements based on feedback' },
    ],
    guide: (name) => `## Project Guide: ${name}\n\nThis guide will walk you through building ${name} from scratch — from planning to launch.\n\n**The big picture:**\nWe'll plan what to build, design the look and feel, develop the frontend and backend, test everything, and launch. Each task has step-by-step instructions.\n\n**How to use this guide:**\n• Tasks are organized by phase — work through them in order\n• Each task has detailed how-to instructions\n• Click on any task to see its instructions and add subtasks\n• Use the AI Agent for help — ask questions, get guidance\n• Move tasks through: Backlog → To Do → In Progress → Review → Done\n\n**Tips:**\n• Start with Planning tasks before jumping into code\n• Ask the AI Agent when you get stuck — I'm here to help!\n• Update task status as you go so the team can see progress\n• Don't skip testing — it saves time in the long run`,
  },

  app: {
    phases: [
      { name: 'Planning', order: 0 },
      { name: 'Design', order: 1 },
      { name: 'Frontend', order: 2 },
      { name: 'Backend', order: 3 },
      { name: 'Testing & Deploy', order: 4 },
    ],
    generateTasks: (name) => [
      { title: `Define app requirements and user stories for ${name}`, phase: 'Planning', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Write 10-15 user stories following "As a [user], I want [goal] so that [reason]" format\n2. Prioritize features into MVP vs. future\n3. Define success metrics (e.g., signups, engagement rate)\n4. Create a technical requirements document\n5. Review with stakeholders' },
      { title: 'Design system architecture', phase: 'Planning', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Choose tech stack (frontend framework, backend, database, hosting)\n2. Draw architecture diagram showing components and data flow\n3. Plan database schema (tables, relationships, indexes)\n4. Define API endpoints and data shapes\n5. Document auth strategy (JWT, sessions, OAuth)' },
      { title: 'Design UI/UX mockups', phase: 'Design', priority: 'high', estimated_hours: 10, instructions: '**How to do this task:**\n1. Create user flow diagrams for key journeys\n2. Design low-fidelity wireframes for all screens\n3. Create high-fidelity mockups in Figma\n4. Design dark mode and light mode variants\n5. Build a design system with reusable components\n6. Create a clickable prototype for user testing' },
      { title: 'Set up project and components', phase: 'Frontend', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Initialize project with Next.js, Tailwind, TypeScript\n2. Create shared UI components (Button, Input, Card, Modal)\n3. Set up routing structure\n4. Configure state management (React Context or Zustand)\n5. Set up API client with error handling' },
      { title: 'Build core features', phase: 'Frontend', priority: 'high', estimated_hours: 16, instructions: '**How to do this task:**\n1. Implement the main user-facing features one by one\n2. Build forms with validation\n3. Add loading states and error handling\n4. Implement responsive design for all screen sizes\n5. Test each feature as you build it' },
      { title: 'Build backend API', phase: 'Backend', priority: 'high', estimated_hours: 12, instructions: '**How to do this task:**\n1. Set up database and create tables\n2. Implement API routes for CRUD operations\n3. Add authentication middleware\n4. Implement business logic and validation\n5. Write database queries with proper indexing\n6. Add rate limiting and security measures' },
      { title: 'Integration and testing', phase: 'Testing & Deploy', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Connect frontend to backend API\n2. Test all user flows end-to-end\n3. Fix bugs and edge cases\n4. Performance optimization (lazy loading, caching)\n5. Security audit (XSS, CSRF, SQL injection prevention)' },
      { title: 'Deploy and launch', phase: 'Testing & Deploy', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Deploy to production hosting\n2. Set up monitoring and error tracking\n3. Configure custom domain and SSL\n4. Submit to app stores if applicable\n5. Create launch checklist and go!' },
    ],
    guide: (name) => `## Project Guide: ${name}\n\nThis guide covers building ${name} from scratch — a full-stack application with frontend and backend.\n\n**What we'll build:**\nWe'll create a production-ready app with authentication, database, and all core features. Each task includes step-by-step instructions.\n\n**How to use this guide:**\n• Work through phases in order — each builds on the previous\n• Click any task to see detailed instructions\n• Use the AI Agent for help with specific questions\n• Mark tasks done as you complete them`,
  },

  mobile: {
    phases: [
      { name: 'Planning', order: 0 },
      { name: 'Design', order: 1 },
      { name: 'Development', order: 2 },
      { name: 'Testing', order: 3 },
      { name: 'Launch', order: 4 },
    ],
    generateTasks: (name) => [
      { title: `Define app concept and features for ${name}`, phase: 'Planning', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Define the core problem the app solves\n2. List must-have features vs. nice-to-have\n3. Research competitor apps\n4. Define target platform (iOS, Android, or both)\n5. Choose development approach (React Native, Flutter, or native)' },
      { title: 'Design app screens and navigation', phase: 'Design', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Create user flow diagrams\n2. Design wireframes for each screen\n3. Design high-fidelity mockups with proper spacing\n4. Follow platform design guidelines (Material Design / HIG)\n5. Create prototype for user testing' },
      { title: 'Set up development environment', phase: 'Development', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Install required tools (Xcode, Android Studio, Node.js)\n2. Initialize project with chosen framework\n3. Set up navigation structure\n4. Configure theming and shared styles\n5. Set up version control' },
      { title: 'Build main screens and features', phase: 'Development', priority: 'high', estimated_hours: 20, instructions: '**How to do this task:**\n1. Build core screens one at a time\n2. Implement navigation between screens\n3. Add forms and user input handling\n4. Integrate with backend API\n5. Handle loading, empty, and error states' },
      { title: 'Testing and bug fixes', phase: 'Testing', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Test on real devices (both iOS and Android)\n2. Fix UI layout issues\n3. Test edge cases and error scenarios\n4. Performance testing and optimization\n5. Beta test with a small group of users' },
      { title: 'Prepare for app store submission', phase: 'Launch', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Create app store screenshots and descriptions\n2. Prepare privacy policy\n3. Set up app store developer accounts\n4. Submit for review\n5. Plan marketing and launch communication' },
    ],
    guide: (name) => `## Project Guide: ${name}\n\nThis guide covers building a mobile app from concept to app store.\n\n**The process:**\nWe'll plan the app, design the screens, build the features, test thoroughly, and launch. Each task has hands-on instructions.\n\n**Need help?**\nAsk the AI Agent anything — technical questions, design advice, or troubleshooting.`,
  },

  marketing: {
    phases: [
      { name: 'Strategy', order: 0 },
      { name: 'Content', order: 1 },
      { name: 'Execution', order: 2 },
      { name: 'Analysis', order: 3 },
    ],
    generateTasks: (name) => [
      { title: `Define campaign goals and KPIs for ${name}`, phase: 'Strategy', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Set SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)\n2. Define target audience personas\n3. Choose primary KPIs (reach, engagement, conversions, ROI)\n4. Set benchmarks based on past campaigns\n5. Create a campaign brief document' },
      { title: 'Research target audience and channels', phase: 'Strategy', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Analyze customer data and past campaign results\n2. Research which channels your audience uses most\n3. Study competitor marketing strategies\n4. Select primary and secondary channels\n5. Create audience segmentation' },
      { title: 'Create content calendar and assets', phase: 'Content', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Plan content themes for each week\n2. Write copy for ads, emails, social posts\n3. Design visual assets (images, videos, graphics)\n4. Schedule posts in a content calendar\n5. Get approvals from stakeholders' },
      { title: 'Launch campaign across channels', phase: 'Execution', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Set up ad campaigns on chosen platforms\n2. Configure targeting and budgets\n3. Schedule email sequences\n4. Publish social media content\n5. Set up tracking and UTM parameters' },
      { title: 'Monitor and optimize performance', phase: 'Analysis', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Check campaign dashboards daily\n2. A/B test ad creative and copy\n3. Adjust budgets based on performance\n4. Respond to comments and engagement\n5. Document what is working and what is not' },
      { title: 'Report results and document learnings', phase: 'Analysis', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Compile campaign results into a report\n2. Compare actual vs. planned KPIs\n3. Calculate ROI and cost per acquisition\n4. Document lessons learned\n5. Present findings to stakeholders' },
    ],
    guide: (name) => `## Project Guide: ${name}\n\nThis guide will help you run a successful marketing campaign from strategy to analysis.\n\n**How to use this guide:**\n• Start with strategy tasks before jumping into content creation\n• Each task has practical instructions\n• Track progress by moving tasks through the workflow\n• Ask the AI Agent for marketing advice and tips`,
  },
}

function detectProjectType(input: string): keyof typeof projectTemplates | 'other' {
  const text = input.toLowerCase()
  if (text.match(/\b(website|web\s*site|landing\s*page|blog|ecommerce|e-commerce|shop|store|portfolio|saas|web\s*app)\b/)) return 'website'
  if (text.match(/\b(app|application|software|tool|platform|dashboard|crm|cms|api|backend|server)\b/)) return 'app'
  if (text.match(/\b(mobile|ios|android|react\s*native|flutter|phone|tablet)\b/)) return 'mobile'
  if (text.match(/\b(marketing|campaign|advert|social\s*media|seo|content|email|newsletter|brand)\b/)) return 'marketing'
  return 'other'
}

function generateInstructions(title: string, phase: string): string {
  const phaseLower = phase.toLowerCase()
  const templates: Record<string, string[]> = {
    planning: [
      'Start by researching the requirements. Talk to stakeholders and document what they need.',
      'Gather all necessary data and resources. Set up a shared workspace.',
      'Define success criteria and KPIs. Create a project charter.',
    ],
    development: [
      'Set up the development environment first. Work iteratively and test each piece as you go.',
      'Break this task into smaller sub-tasks. Ask for feedback early and often.',
      'Start with a working prototype, then refine. Document your approach.',
    ],
    testing: [
      'Write test cases first. Cover edge cases and normal flows.',
      'Run automated tests first, then manual testing. Document issues found.',
      'Do regression testing. Get sign-off before marking done.',
    ],
    launch: [
      'Prepare a deployment checklist. Make sure tests pass. Have a rollback plan.',
      'Do a dry run first. Monitor closely after deployment.',
      'Coordinate with the team. Prepare communication for stakeholders.',
    ],
    default: [
      'Start by understanding what needs to be done. Break it into smaller steps.',
      'Collaborate with the team if you get stuck. Ask questions early.',
      'Focus on quality. Review your work before marking it complete.',
    ],
  }
  let pool: string[]
  if (phaseLower.includes('plan') || phaseLower.includes('research') || phaseLower.includes('design')) pool = templates.planning
  else if (phaseLower.includes('develop') || phaseLower.includes('build') || phaseLower.includes('code')) pool = templates.development
  else if (phaseLower.includes('test') || phaseLower.includes('qa') || phaseLower.includes('review')) pool = templates.testing
  else if (phaseLower.includes('launch') || phaseLower.includes('deploy') || phaseLower.includes('release')) pool = templates.launch
  else pool = templates.default
  const tip = pool[Math.floor(Math.random() * pool.length)]
  return `**How to do this task:**\n1. Understand the goal: "${title}"\n2. ${tip}\n3. Update the task status as you make progress and add comments if you have questions.`
}

function localExtractPlan(input: string): ExtractedPlan {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
  const projectName = lines[0]?.length < 60 ? lines[0] : 'New Project'
  const projectType = detectProjectType(input)

  if (projectType !== 'other') {
    const template = projectTemplates[projectType]
    return {
      projectName,
      description: input.slice(0, 200),
      phases: template.phases,
      tasks: template.generateTasks(projectName),
      guide: template.guide(projectName),
    }
  }

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
    if (kw.keywords.some(k => text.includes(k))) matchedPhases.add(kw.name)
  }

  const phases: ExtractedPlan['phases'] = []
  const phaseLines = lines.filter(l => l.match(/phase|step|stage|milestone/i) || l.match(/^\d+\./))
  if (phaseLines.length > 0) {
    phaseLines.forEach((l, i) => {
      const name = l.replace(/^\d+[\.\)]\s*/, '').replace(/^(phase|step|stage)\s*\d*:?\s*/i, '').trim()
      if (name) phases.push({ name, order: i })
    })
  }
  if (phases.length === 0) { [...matchedPhases].forEach((name, i) => phases.push({ name, order: i })) }
  if (phases.length === 0) { phases.push({ name: 'Phase 1', order: 0 }) }

  const taskLines = lines.filter(l => !l.match(/^(phase|step|stage)/i) && l.match(/^[-•*]|^\d+[\.\)]/))
  if (taskLines.length > 0) {
    taskLines.forEach((l, i) => {
      const title = l.replace(/^[-•*\d\s\.\)]+/, '').trim()
      if (title && title.length > 3) {
        const phaseIndex = i % phases.length
        tasks.push({
          title, phase: phases[phaseIndex].name,
          priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
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
        title, phase: phases[phaseIndex].name,
        priority: i === 0 ? 'high' : 'medium',
        estimated_hours: [2, 4, 8][Math.floor(Math.random() * 3)],
        instructions: generateInstructions(title, phases[phaseIndex].name),
      })
    })
  }

  return {
    projectName,
    description: input.slice(0, 200),
    phases,
    tasks: tasks.slice(0, 25),
    guide: `## Project Guide: ${projectName}\n\nThis project has been broken into ${phases.length} phases with ${Math.min(tasks.length, 25)} tasks.\n\n**How to use this guide:**\n• Each task has instructions on how to approach it\n• Move tasks through: Backlog → To Do → In Progress → Review → Done\n• Use comments to ask questions or give updates\n• The AI Agent can help with any task — click the Agent button\n\n**Tips for success:**\n1. Start with the first phase and work through tasks in order\n2. Ask the AI Agent for help whenever you're stuck\n3. Update task status as you make progress\n4. Complete all tasks in a phase before moving to the next`,
  }
}

function localPredictRisks(
  _projectName: string,
  tasks: { title: string; status: string; due_date: string | null; assignee: string | null }[],
): RiskPrediction {
  const risks: RiskPrediction['risks'] = []
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassigned = tasks.filter(t => !t.assignee)
  const notStarted = tasks.filter(t => t.status === 'todo' || t.status === 'backlog')

  if (overdue.length > 0) risks.push({ type: 'overdue', severity: overdue.length > 3 ? 'high' : 'medium', message: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue`, details: { count: overdue.length } })
  if (unassigned.length > 0) risks.push({ type: 'workload', severity: unassigned.length > 5 ? 'high' : 'low', message: `${unassigned.length} task${unassigned.length > 1 ? 's have' : ' has'} no assignee`, details: { count: unassigned.length } })
  if (notStarted.length > 5) risks.push({ type: 'bottleneck', severity: 'medium', message: `${notStarted.length} tasks haven't been started yet`, details: { count: notStarted.length } })
  if (risks.length === 0) risks.push({ type: 'risk', severity: 'low', message: 'Project is on track', details: {} })

  return { risks }
}

export async function extractTasksFromText(input: string): Promise<ExtractedPlan> {
  const systemPrompt = `You are SnapTask AI, a project supervisor who builds comprehensive project plans. Given a project description, generate a complete plan with phases, tasks, and detailed how-to instructions for each task.

IMPORTANT: Generate BETWEEN 8 AND 15 tasks for a complete project. Each task MUST include step-by-step instructions on how to actually do it.

Respond with this JSON format ONLY:
{
  "projectName": "string",
  "description": "string describing the project",
  "phases": [{ "name": "string", "order": number }],
  "tasks": [
    {
      "title": "string - clear task name",
      "phase": "string - must match one of the phase names above",
      "priority": "low|medium|high|urgent",
      "estimated_hours": number or null,
      "instructions": "Detailed step-by-step how-to guidance. Include specific actions, tools, and steps. Format: **How to do this task:** then numbered steps."
    }
  ],
  "guide": "A comprehensive project guide with tips for success, overview of what will be built, and advice for the team."
}`

  const geminiResult = await tryGemini(`${systemPrompt}\n\nProject description:\n${input}`)
  if (geminiResult) {
    try {
      const parsed = JSON.parse(cleanJson(geminiResult))
      if (parsed.tasks && parsed.tasks.length > 0) {
        if (!parsed.guide) parsed.guide = `## Project Guide\n\nThis project has ${parsed.phases?.length || 0} phases and ${parsed.tasks?.length || 0} tasks. Follow the instructions for each task.`
        return parsed as ExtractedPlan
      }
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
