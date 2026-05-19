# SnapTask Build Commands

- TypeScript check: `npx tsc --noEmit`
- Build: `npm run build`
- Dev server: `npm run dev`
- Lint: `npx next lint`

## Conventions

- Use Tailwind v4 for styling; prefer CSS variables from `globals.css`
- Dark mode uses `.dark` class on `<html>`, toggled by ThemeProvider
- All database mutations must go through Supabase client
- Offline support: use `enqueueSync()` from `@/lib/offline/sync` for writes when offline
- Toast notifications via `sonner` `toast`
- All AI calls go through `@/lib/ai/gemini.ts` with tryGemini fallback
- Use `cn()` from `@/lib/utils` for class merging
- Supabase Realtime for live updates on tasks and notifications
- New features requiring DB changes: add to `supabase/migrations/`
