import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

export interface ExtractedPlan {
  projectName: string
  description: string
  phases: { name: string; order: number }[]
  tasks: { title: string; phase: string; priority: string; estimated_hours: number | null; assignee?: string | null; instructions?: string }[]
  guide: string
  research?: string
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

async function tryGemini(prompt: string, timeoutMs = 3000): Promise<string | null> {
  if (!genAI) return null
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  const results = await Promise.allSettled(models.map(modelName =>
    Promise.race([
      genAI!.getGenerativeModel({ model: modelName }).generateContent([{ text: prompt }]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]).then(r => r.response.text())
  ))
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.length > 10) return r.value
  }
  return null
}

function generateTasksForProject(name: string, projectType: string): {
  phases: { name: string; order: number }[]
  tasks: { title: string; phase: string; priority: string; estimated_hours: number; instructions: string }[]
  guide: string
} {
  const templates: Record<string, {
    phases: { name: string; order: number }[]
    tasks: { title: string; phase: string; priority: string; estimated_hours: number; instructions: string }[]
    guide: string
  }> = {
    website: {
      phases: [
        { name: 'Planning & Research', order: 0 },
        { name: 'Design', order: 1 },
        { name: 'Frontend Development', order: 2 },
        { name: 'Backend Development', order: 3 },
        { name: 'Testing & Launch', order: 4 },
      ],
      tasks: [
        { title: `Define goals and target audience`, phase: 'Planning & Research', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Write down what this project needs to achieve\n2. Identify who will use it — their age, needs, and skill level\n3. Research 3-5 competitor projects in the same space\n4. List 5 key features the project must have\n5. Create a one-page brief summarizing your findings' },
        { title: `Create sitemap and wireframes`, phase: 'Planning & Research', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. List all pages/screens needed\n2. Draw rough wireframes for each — paper sketches are fine\n3. Plan the user flow: what does a visitor do from landing to goal?\n4. Use a tool like Figma or draw.io to create digital wireframes\n5. Get feedback before moving to design' },
        { title: 'Research and select tech stack', phase: 'Planning & Research', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Decide on frontend framework (Next.js, React, or plain HTML/CSS/JS)\n2. Choose styling approach (Tailwind CSS, vanilla CSS, or a component library)\n3. Pick hosting platform (Vercel, Netlify, AWS, or shared hosting)\n4. Decide if you need a backend (CMS, database, authentication)\n5. Document your tech stack decisions' },
        { title: 'Design visual mockups and brand guide', phase: 'Design', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Choose a color palette — use coolors.co for inspiration\n2. Pick 2-3 fonts (one for headings, one for body text)\n3. Design high-fidelity mockups in Figma or similar\n4. Create a style guide with colors, fonts, button styles, spacing\n5. Ensure designs are responsive (desktop + mobile versions)' },
        { title: 'Design responsive breakpoints and layout', phase: 'Design', priority: 'medium', estimated_hours: 3, instructions: '**How to do this task:**\n1. Define breakpoints for mobile, tablet, desktop\n2. Set up a CSS grid or flexbox layout system\n3. Design how each page adapts at each breakpoint\n4. Create mobile-specific navigation patterns\n5. Document the responsive behavior' },
        { title: 'Set up development environment', phase: 'Frontend Development', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Initialize the project (Next.js recommended)\n2. Install dependencies: Tailwind CSS, UI libraries\n3. Set up folder structure: components/, app/, lib/, public/\n4. Configure Tailwind with your brand colors and fonts\n5. Initialize Git and make your first commit' },
        { title: 'Build layout shell (header, footer, navigation)', phase: 'Frontend Development', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Create a Layout component with Header (logo + nav links) and Footer\n2. Make navigation responsive — hamburger menu on mobile\n3. Add the layout to all pages\n4. Style everything to match your brand guide\n5. Test navigation works on desktop, tablet, and mobile' },
        { title: 'Build homepage', phase: 'Frontend Development', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Create hero section with headline, subtext, and CTA button\n2. Add features/services section highlighting key offerings\n3. Include a testimonials or social proof section\n4. Add a contact form or call-to-action section\n5. Test the page at different screen sizes' },
        { title: 'Build inner pages (About, Services, Contact)', phase: 'Frontend Development', priority: 'medium', estimated_hours: 8, instructions: '**How to do this task:**\n1. About page: company story, team photos, mission statement\n2. Services/Products page: detailed descriptions with images\n3. Contact page: form with name/email/message fields\n4. Ensure consistent styling across all pages\n5. Add page transitions or animations for polish' },
        { title: 'Add animations and micro-interactions', phase: 'Frontend Development', priority: 'low', estimated_hours: 4, instructions: '**How to do this task:**\n1. Choose animation approach (CSS transitions, Framer Motion, GSAP)\n2. Add hover effects to buttons, cards, and links\n3. Implement scroll-triggered animations\n4. Add loading animations for page transitions\n5. Test animations dont cause performance issues on mobile' },
        { title: 'Optimize images and assets', phase: 'Frontend Development', priority: 'medium', estimated_hours: 3, instructions: '**How to do this task:**\n1. Compress all images (use TinyPNG, Squoosh, or Next.js Image component)\n2. Convert images to modern formats (WebP, AVIF)\n3. Set up lazy loading for images below the fold\n4. Create responsive image srcsets for different screen sizes\n5. Verify page speed with Lighthouse' },
        { title: 'Set up backend API and database', phase: 'Backend Development', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Set up Supabase project (or your chosen backend)\n2. Create database tables for contacts, users, or content\n3. Set up API routes for form submissions\n4. Add server-side validation for all inputs\n5. Test API endpoints with a tool like Postman' },
        { title: 'Add authentication and user accounts', phase: 'Backend Development', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Implement sign-up/sign-in with Supabase Auth\n2. Add protected routes for authenticated users\n3. Create user profile page\n4. Handle password reset flow\n5. Test the full auth flow end-to-end' },
        { title: 'Implement SEO and meta tags', phase: 'Backend Development', priority: 'medium', estimated_hours: 3, instructions: '**How to do this task:**\n1. Add meta descriptions, title tags, and OG tags to every page\n2. Generate a sitemap.xml automatically\n3. Add structured data (JSON-LD) for rich search results\n4. Set up canonical URLs to avoid duplicate content\n5. Test with Google Rich Results tool' },
        { title: 'Test all features and fix bugs', phase: 'Testing & Launch', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Test every link, button, and form on the site\n2. Check the site on Chrome, Firefox, Safari, and Edge\n3. Test on real mobile devices (iPhone, Android)\n4. Run Lighthouse audit for performance + accessibility\n5. Get a friend or colleague to do a fresh walkthrough' },
        { title: 'Deploy to production', phase: 'Testing & Launch', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Push code to GitHub repository\n2. Connect repo to Vercel (or your hosting provider)\n3. Set up environment variables on the hosting platform\n4. Configure custom domain (if you have one)\n5. Deploy and verify everything works on the live URL' },
        { title: 'Post-launch monitoring and maintenance', phase: 'Testing & Launch', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Submit sitemap to Google Search Console\n2. Set up uptime monitoring (e.g., UptimeRobot)\n3. Create a maintenance plan for updates and backups\n4. Plan the first round of improvements based on feedback' },
      ],
      guide: `## Project Guide\n\nThis guide will walk you through building this project from scratch.\n\n**How to use this guide:**\n- Tasks are organized by phase — work through them in order\n- Each task has detailed how-to instructions\n- Click on any task to see its instructions\n- Use the AI Agent for help — ask questions, get guidance\n\n**Tips:**\n- Start with Planning tasks before jumping into code\n- Ask the AI Agent when you get stuck\n- Update task status as you go so the team can see progress`,
    },
    app: {
      phases: [
        { name: 'Planning', order: 0 },
        { name: 'Design', order: 1 },
        { name: 'Frontend', order: 2 },
        { name: 'Backend', order: 3 },
        { name: 'Testing & Deploy', order: 4 },
      ],
      tasks: [
        { title: 'Define app requirements and user stories', phase: 'Planning', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Write 10-15 user stories following "As a [user], I want [goal] so that [reason]" format\n2. Prioritize features into MVP vs. future\n3. Define success metrics (e.g., signups, engagement rate)\n4. Create a technical requirements document\n5. Review with stakeholders' },
        { title: 'Design system architecture', phase: 'Planning', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Choose tech stack (frontend, backend, database, hosting)\n2. Draw architecture diagram showing components and data flow\n3. Plan database schema (tables, relationships, indexes)\n4. Define API endpoints and data shapes\n5. Document auth strategy (JWT, sessions, OAuth)' },
        { title: 'Plan database schema and data models', phase: 'Planning', priority: 'high', estimated_hours: 5, instructions: '**How to do this task:**\n1. Identify all data entities needed\n2. Define relationships between entities\n3. Create SQL migration scripts or use an ORM\n4. Add proper indexes for frequently queried fields\n5. Set up Row Level Security policies (if using Supabase)' },
        { title: 'Design UI/UX mockups', phase: 'Design', priority: 'high', estimated_hours: 10, instructions: '**How to do this task:**\n1. Create user flow diagrams for key journeys\n2. Design low-fidelity wireframes for all screens\n3. Create high-fidelity mockups in Figma\n4. Design dark mode and light mode variants\n5. Build a design system with reusable components' },
        { title: 'Design component library and design tokens', phase: 'Design', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Define design tokens (colors, spacing, typography, shadows)\n2. Build reusable UI components (Button, Input, Select, Modal, Card, Table)\n3. Create component documentation (Storybook or similar)\n4. Ensure all components are accessible\n5. Test components in isolation before using in pages' },
        { title: 'Set up project and components', phase: 'Frontend', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Initialize project with Next.js, Tailwind, TypeScript\n2. Create shared UI components (Button, Input, Card, Modal)\n3. Set up routing structure\n4. Configure state management (React Context or Zustand)\n5. Set up API client with error handling' },
        { title: 'Build authentication screens and flow', phase: 'Frontend', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Build sign-up page with email/password and OAuth options\n2. Build sign-in page with "forgot password" link\n3. Create password reset flow\n4. Add form validation with error messages\n5. Handle loading states and error states' },
        { title: 'Build core features', phase: 'Frontend', priority: 'high', estimated_hours: 16, instructions: '**How to do this task:**\n1. Implement the main user-facing features one by one\n2. Build forms with validation\n3. Add loading states and error handling\n4. Implement responsive design for all screen sizes\n5. Test each feature as you build it' },
        { title: 'Add real-time updates and notifications', phase: 'Frontend', priority: 'medium', estimated_hours: 6, instructions: '**How to do this task:**\n1. Set up WebSocket or Supabase Realtime subscriptions\n2. Implement real-time updates for key data\n3. Add a notification bell/badge in the header\n4. Build a notification preferences page\n5. Test real-time features work across multiple browser tabs' },
        { title: 'Build backend API', phase: 'Backend', priority: 'high', estimated_hours: 12, instructions: '**How to do this task:**\n1. Set up database and create tables\n2. Implement API routes for CRUD operations\n3. Add authentication middleware\n4. Implement business logic and validation\n5. Write database queries with proper indexing' },
        { title: 'Implement file uploads and media handling', phase: 'Backend', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Choose storage solution (Supabase Storage, AWS S3, Cloudinary)\n2. Set up file upload API endpoint\n3. Add file type and size validation\n4. Implement image optimization (resize, compress on upload)\n5. Set up CDN for fast media delivery' },
        { title: 'Write automated tests', phase: 'Testing & Deploy', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Write unit tests for critical utility functions\n2. Write integration tests for API endpoints\n3. Write component tests for key UI components\n4. Set up end-to-end tests for main user flows\n5. Configure CI to run tests on every PR' },
        { title: 'Integration and end-to-end testing', phase: 'Testing & Deploy', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Connect frontend to backend API\n2. Test all user flows end-to-end\n3. Fix bugs and edge cases\n4. Performance optimization (lazy loading, caching)\n5. Security audit (XSS, CSRF, SQL injection prevention)' },
        { title: 'Performance optimization and caching', phase: 'Testing & Deploy', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Implement lazy loading for routes and components\n2. Set up server-side caching (Redis or in-memory)\n3. Optimize bundle size with code splitting\n4. Run Lighthouse — aim for 90+ scores\n5. Document performance benchmarks' },
        { title: 'Deploy and launch', phase: 'Testing & Deploy', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Deploy to production hosting\n2. Set up monitoring and error tracking\n3. Configure custom domain and SSL\n4. Submit to app stores if applicable\n5. Create launch checklist and go live' },
      ],
      guide: `## Project Guide\n\nThis guide covers building a full-stack application from scratch.\n\n**What we'll build:**\nWe'll create a production-ready app with authentication, database, and all core features. Each task includes step-by-step instructions.\n\n**How to use this guide:**\n- Work through phases in order — each builds on the previous\n- Click any task to see detailed instructions\n- Use the AI Agent for help with specific questions\n- Mark tasks done as you complete them`,
    },
    mobile: {
      phases: [
        { name: 'Planning', order: 0 },
        { name: 'Design', order: 1 },
        { name: 'Development', order: 2 },
        { name: 'Testing', order: 3 },
        { name: 'Launch', order: 4 },
      ],
      tasks: [
        { title: 'Define app concept and features', phase: 'Planning', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Define the core problem the app solves\n2. List must-have features vs. nice-to-have\n3. Research competitor apps\n4. Define target platform (iOS, Android, or both)\n5. Choose development approach (React Native, Flutter, or native)' },
        { title: 'Write user stories and technical specs', phase: 'Planning', priority: 'high', estimated_hours: 5, instructions: '**How to do this task:**\n1. Write 10-15 user stories for core features\n2. Define technical requirements (API needs, offline support)\n3. Plan data flow and state management approach\n4. Define minimum OS version targets\n5. Create a technical specification document' },
        { title: 'Design app screens and navigation', phase: 'Design', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Create user flow diagrams\n2. Design wireframes for each screen\n3. Design high-fidelity mockups with proper spacing\n4. Follow platform design guidelines (Material Design / HIG)\n5. Create prototype for user testing' },
        { title: 'Design onboarding and empty states', phase: 'Design', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Design a 3-4 screen onboarding flow for first-time users\n2. Design empty states for every list/tab\n3. Design error states (network error, server error)\n4. Design loading/skeleton screens\n5. Create animations for screen transitions' },
        { title: 'Set up development environment', phase: 'Development', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Install required tools (Xcode, Android Studio, Node.js)\n2. Initialize project with chosen framework\n3. Set up navigation structure\n4. Configure theming and shared styles\n5. Set up version control' },
        { title: 'Build authentication and user management', phase: 'Development', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Implement sign-up/sign-in screens\n2. Add biometric authentication (Face ID / fingerprint)\n3. Implement token storage and refresh\n4. Build profile/account screen\n5. Test on both iOS and Android simulators' },
        { title: 'Build main screens and features', phase: 'Development', priority: 'high', estimated_hours: 20, instructions: '**How to do this task:**\n1. Build core screens one at a time\n2. Implement navigation between screens\n3. Add forms and user input handling\n4. Integrate with backend API\n5. Handle loading, empty, and error states' },
        { title: 'Implement offline support and local storage', phase: 'Development', priority: 'medium', estimated_hours: 6, instructions: '**How to do this task:**\n1. Set up local database (SQLite, Realm, or MMKV)\n2. Implement data syncing between local and server\n3. Cache API responses for offline access\n4. Handle conflict resolution when syncing\n5. Test by enabling airplane mode and using the app' },
        { title: 'Add push notifications', phase: 'Development', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Set up push notification service (FCM, APNs)\n2. Request notification permissions on first launch\n3. Implement notification handling (foreground, background, tap)\n4. Build notification preferences screen\n5. Test notifications on both platforms' },
        { title: 'Performance optimization', phase: 'Testing', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Profile app performance on real devices\n2. Optimize list rendering (virtualization, recycling)\n3. Reduce app bundle size\n4. Optimize image loading and caching\n5. Test on low-end devices' },
        { title: 'Testing and bug fixes', phase: 'Testing', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Test on real devices (both iOS and Android)\n2. Fix UI layout issues\n3. Test edge cases and error scenarios\n4. Performance testing and optimization\n5. Beta test with a small group of users' },
        { title: 'Accessibility and localization', phase: 'Testing', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Add accessibility labels to all interactive elements\n2. Test with screen readers\n3. Ensure proper contrast ratios\n4. Prepare strings for localization\n5. Add support for at least one additional language' },
        { title: 'Prepare app store assets and metadata', phase: 'Launch', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Take screenshots of every screen in multiple device sizes\n2. Write compelling app description and keywords\n3. Create app icon in all required sizes\n4. Write privacy policy and terms of service\n5. Set up app analytics and crash reporting' },
        { title: 'Submit to app stores', phase: 'Launch', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Set up Apple Developer account and Google Play Console\n2. Fill in all required metadata\n3. Build release versions\n4. Upload to App Store Connect and Google Play Console\n5. Submit for review and monitor status' },
      ],
      guide: `## Project Guide\n\nThis guide covers building a mobile app from concept to app store.\n\n**The process:**\nWe'll plan the app, design the screens, build the features, test thoroughly, and launch. Each task has hands-on instructions.\n\n**Need help?**\nAsk the AI Agent anything — technical questions, design advice, or troubleshooting.`,
    },
    marketing: {
      phases: [
        { name: 'Strategy', order: 0 },
        { name: 'Content', order: 1 },
        { name: 'Execution', order: 2 },
        { name: 'Analysis', order: 3 },
      ],
      tasks: [
        { title: 'Define campaign goals and KPIs', phase: 'Strategy', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Set SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)\n2. Define target audience personas\n3. Choose primary KPIs (reach, engagement, conversions, ROI)\n4. Set benchmarks based on past campaigns\n5. Create a campaign brief document' },
        { title: 'Research target audience and channels', phase: 'Strategy', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Analyze customer data and past campaign results\n2. Research which channels your audience uses most\n3. Study competitor marketing strategies\n4. Select primary and secondary channels\n5. Create audience segmentation' },
        { title: 'Create budget and resource plan', phase: 'Strategy', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Define total campaign budget\n2. Allocate budget across channels\n3. Plan team roles and responsibilities\n4. Identify tools needed (scheduling, analytics, design)\n5. Create a timeline with key milestones' },
        { title: 'Create content calendar and assets', phase: 'Content', priority: 'high', estimated_hours: 8, instructions: '**How to do this task:**\n1. Plan content themes for each week\n2. Write copy for ads, emails, social posts\n3. Design visual assets (images, videos, graphics)\n4. Schedule posts in a content calendar\n5. Get approvals from stakeholders' },
        { title: 'Write email sequences and landing pages', phase: 'Content', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Draft welcome email sequence (3-5 emails)\n2. Write promotional emails for the campaign\n3. Create landing page copy that converts\n4. Design email templates (plain text + HTML)\n5. Set up A/B test variants for subject lines' },
        { title: 'Create video and visual content', phase: 'Content', priority: 'medium', estimated_hours: 6, instructions: '**How to do this task:**\n1. Plan video content (tutorials, testimonials, product demos)\n2. Write video scripts\n3. Record or source video footage\n4. Edit videos with captions and CTAs\n5. Create social media graphics for all platforms' },
        { title: 'Set up analytics and tracking', phase: 'Execution', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Set up UTM parameters for all campaign links\n2. Create conversion tracking pixels\n3. Set up dashboards in Google Analytics\n4. Configure goal tracking and funnel analysis\n5. Test that all tracking is working before launch' },
        { title: 'Launch campaign across channels', phase: 'Execution', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Set up ad campaigns on chosen platforms\n2. Configure targeting and budgets\n3. Schedule email sequences\n4. Publish social media content\n5. Set up tracking and UTM parameters' },
        { title: 'Manage community and engagement', phase: 'Execution', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Set up a social media monitoring dashboard\n2. Respond to comments and messages within 24 hours\n3. Engage with relevant conversations in your niche\n4. Share user-generated content\n5. Handle negative feedback professionally' },
        { title: 'Monitor and optimize performance', phase: 'Analysis', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Check campaign dashboards daily\n2. A/B test ad creative and copy\n3. Adjust budgets based on performance\n4. Respond to comments and engagement\n5. Document what is working and what is not' },
        { title: 'Run A/B tests and optimize conversion', phase: 'Analysis', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Identify pages/funnels with highest drop-off\n2. Create A/B test variants (headline, CTA, images, layout)\n3. Run tests with statistical significance (95% confidence)\n4. Implement winning variants\n5. Document test results and insights' },
        { title: 'Report results and document learnings', phase: 'Analysis', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Compile campaign results into a report\n2. Compare actual vs. planned KPIs\n3. Calculate ROI and cost per acquisition\n4. Document lessons learned\n5. Present findings to stakeholders' },
      ],
      guide: `## Project Guide\n\nThis guide will help you run a successful marketing campaign from strategy to analysis.\n\n**How to use this guide:**\n- Start with strategy tasks before jumping into content creation\n- Each task has practical instructions\n- Track progress by moving tasks through the workflow\n- Ask the AI Agent for marketing advice and tips`,
    },
  }

  const template = templates[projectType]
  if (template) return template

  return {
    phases: [
      { name: 'Planning', order: 0 },
      { name: 'Development', order: 1 },
      { name: 'Testing', order: 2 },
      { name: 'Launch', order: 3 },
    ],
    tasks: [
      { title: `Define project requirements for ${name}`, phase: 'Planning', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Define the core goal of the project\n2. List must-have features vs. nice-to-have\n3. Define success criteria\n4. Create a requirements document\n5. Get approval from stakeholders' },
      { title: 'Plan system architecture', phase: 'Planning', priority: 'high', estimated_hours: 4, instructions: '**How to do this task:**\n1. Choose your tech stack\n2. Draw architecture diagram\n3. Plan data model and database schema\n4. Define API endpoints\n5. Document the architecture decisions' },
      { title: 'Set up development environment', phase: 'Development', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Initialize project with chosen framework\n2. Install dependencies\n3. Set up folder structure\n4. Configure development tools\n5. Initialize Git repository' },
      { title: 'Build core functionality', phase: 'Development', priority: 'high', estimated_hours: 16, instructions: '**How to do this task:**\n1. Implement the main features one by one\n2. Build the user interface\n3. Add forms and data handling\n4. Implement backend logic\n5. Test each feature as you build it' },
      { title: 'Add authentication and user management', phase: 'Development', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Set up user registration and login\n2. Implement password reset\n3. Add user profile management\n4. Set up permissions and roles\n5. Test the full auth flow' },
      { title: 'Integrate with external services', phase: 'Development', priority: 'medium', estimated_hours: 5, instructions: '**How to do this task:**\n1. Identify third-party services needed\n2. Get API keys and set up integrations\n3. Handle API errors gracefully\n4. Implement caching for external calls\n5. Test all integrations work correctly' },
      { title: 'Write tests', phase: 'Testing', priority: 'high', estimated_hours: 6, instructions: '**How to do this task:**\n1. Write unit tests for core functions\n2. Write integration tests for APIs\n3. Test all user flows\n4. Fix bugs found during testing\n5. Run full test suite before launch' },
      { title: 'Performance optimization', phase: 'Testing', priority: 'medium', estimated_hours: 4, instructions: '**How to do this task:**\n1. Profile application performance\n2. Optimize slow queries and operations\n3. Implement caching where needed\n4. Reduce bundle size\n5. Run Lighthouse audit — aim for 90+' },
      { title: 'Deploy to production', phase: 'Launch', priority: 'high', estimated_hours: 3, instructions: '**How to do this task:**\n1. Prepare deployment checklist\n2. Set up production environment\n3. Deploy the application\n4. Verify everything works on live URL\n5. Set up monitoring and alerts' },
      { title: 'Documentation and handoff', phase: 'Launch', priority: 'medium', estimated_hours: 3, instructions: '**How to do this task:**\n1. Write user documentation\n2. Document technical architecture\n3. Create maintenance guide\n4. Train team members if needed\n5. Plan next iteration based on feedback' },
    ],
    guide: `## Project Guide\n\nThis guide will help you build this project from scratch.\n\n**How to use this guide:**\n- Work through phases in order\n- Each task has step-by-step instructions\n- Click any task for details\n- Use the AI Agent for help\n- Mark tasks done as you complete them`,
  }
}

function detectProjectType(input: string): string {
  const text = input.toLowerCase()
  if (text.match(/\b(website|web\s*site|landing\s*page|blog|ecommerce|e-commerce|shop|store|portfolio|saas|web\s*app)\b/)) return 'website'
  if (text.match(/\b(app|application|software|tool|platform|dashboard|crm|cms|api|backend|server)\b/)) return 'app'
  if (text.match(/\b(mobile|ios|android|react\s*native|flutter|phone|tablet)\b/)) return 'mobile'
  if (text.match(/\b(marketing|campaign|advert|social\s*media|seo|content|email|newsletter|brand)\b/)) return 'marketing'
  return 'other'
}

function localExtractPlan(input: string): ExtractedPlan {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
  const firstLine = lines[0] || ''
  const projectName = firstLine.length < 60 ? firstLine : (firstLine.substring(0, 55) + '...')
  const projectType = detectProjectType(input)
  const template = generateTasksForProject(projectName, projectType)

  return {
    projectName,
    description: input.substring(0, 300),
    phases: template.phases,
    tasks: template.tasks.map(t => ({ ...t })),
    guide: template.guide,
  }
}

export async function extractTasksFromText(input: string, onProgress?: (msg: string) => void, imageBase64?: string): Promise<ExtractedPlan> {
  onProgress?.('Researching your project...')

  let geminiResult: string | null = null

  if (imageBase64 && genAI) {
    onProgress?.('Analyzing photo with AI...')
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const imageParts = [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }]
      const result = await Promise.race([
        model.generateContent([
          { text: `Analyze this image and extract project information. Then create a comprehensive project plan.

The user also said: "${input}"

Respond with ONLY this JSON:
{
  "projectName": "project name",
  "description": "description",
  "research": "what you see in the image and how it relates to the project",
  "phases": [{ "name": "phase name", "order": 0 }],
  "tasks": [{ "title": "task", "phase": "phase name", "priority": "low|medium|high|urgent", "estimated_hours": number, "instructions": "step-by-step instructions" }],
  "guide": "project guide"
}

Generate 12 to 22 tasks with detailed instructions.` },
          ...imageParts,
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
      ])
      geminiResult = result.response.text()
      if (geminiResult) {
        try {
          const parsed = JSON.parse(cleanJson(geminiResult))
          if (parsed.tasks && parsed.tasks.length >= 3) {
            onProgress?.(`Generated ${parsed.tasks.length} tasks!`)
            return {
              projectName: parsed.projectName || 'New Project',
              description: parsed.description || input.substring(0, 300),
              phases: parsed.phases || [{ name: 'Phase 1', order: 0 }],
              tasks: parsed.tasks,
              guide: parsed.guide || '## Project Guide\n\nFollow the tasks in order.',
              research: parsed.research || '',
            }
          }
        } catch { /* fall through */ }
      }
    } catch { /* fall through to text-only */ }
  }

  const geminiPrompt = `You are SnapTask AI — an expert project supervisor who researches and builds comprehensive project plans.

The user wants to build:
"${input}"

STEP 1 — RESEARCH: Analyze this project. Think about:
- What is being built exactly
- What's the best tech stack and approach in 2026
- Standard phases and milestones
- Specific features and components needed
- Common challenges and best practices

STEP 2 — PLAN: Based on your research, create a complete project plan.

Respond with ONLY this JSON (no other text):
{
  "projectName": "short project name",
  "description": "brief description of the project",
  "research": "your research findings — what tech stack, approach, and best practices you recommend",
  "phases": [{ "name": "phase name", "order": 0 }],
  "tasks": [
    {
      "title": "clear task name",
      "phase": "must match a phase name above",
      "priority": "low|medium|high|urgent",
      "estimated_hours": number or null,
      "instructions": "**How to do this task:** then numbered steps with specific actions, commands, and tools."
    }
  ],
  "guide": "comprehensive project guide"
}

Generate 12 to 22 tasks. Make instructions specific and actionable — tell them exact commands to run, files to create, and steps to follow.`

  onProgress?.('Analyzing project requirements...')
  geminiResult = await tryGemini(geminiPrompt, 4000)

  if (geminiResult) {
    try {
      const parsed = JSON.parse(cleanJson(geminiResult))
      if (parsed.tasks && parsed.tasks.length >= 3) {
        onProgress?.(`Generated ${parsed.tasks.length} tasks!`)
        return {
          projectName: parsed.projectName || 'New Project',
          description: parsed.description || input.substring(0, 300),
          phases: parsed.phases || [{ name: 'Phase 1', order: 0 }],
          tasks: parsed.tasks,
          guide: parsed.guide || '## Project Guide\n\nFollow the tasks in order.',
          research: parsed.research || '',
        }
      }
    } catch {
      // fall through to local
    }
  }

  onProgress?.('Creating project plan...')
  return localExtractPlan(input)
}

export async function predictRisks(
  projectName: string,
  tasks: { title: string; status: string; due_date: string | null; assignee: string | null }[],
): Promise<RiskPrediction> {
  const prompt = `Analyze project risks as JSON:
{
  "risks": [{ "type": "risk|bottleneck|overdue|workload", "severity": "low|medium|high", "message": "string", "details": {} }]
}`

  const geminiResult = await tryGemini(`${prompt}\n\nProject: ${projectName}\nTasks: ${JSON.stringify(tasks)}`)
  if (geminiResult) {
    try {
      return JSON.parse(cleanJson(geminiResult))
    } catch {
      // fall through
    }
  }

  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const unassigned = tasks.filter(t => !t.assignee)
  const notStarted = tasks.filter(t => t.status === 'todo' || t.status === 'backlog')
  const risks: RiskPrediction['risks'] = []
  if (overdue.length > 0) risks.push({ type: 'overdue', severity: overdue.length > 3 ? 'high' : 'medium', message: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue`, details: { count: overdue.length } })
  if (unassigned.length > 0) risks.push({ type: 'workload', severity: unassigned.length > 5 ? 'high' : 'low', message: `${unassigned.length} task${unassigned.length > 1 ? 's have' : ' has'} no assignee`, details: { count: unassigned.length } })
  if (notStarted.length > 5) risks.push({ type: 'bottleneck', severity: 'medium', message: `${notStarted.length} tasks haven't been started yet`, details: { count: notStarted.length } })
  if (risks.length === 0) risks.push({ type: 'risk', severity: 'low', message: 'Project is on track', details: {} })
  return { risks }
}
