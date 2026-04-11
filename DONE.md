# Progress Tracker (DONE.md)

## What is being done
- Build completed. Awaiting user environment configuration.

## What needs to be done
- User must configure `.env.local` keys.
- User must run the Supabase schema in `supabase/schema.sql`.
- User must run `node scripts/seed_data.mjs` to generate RAG context.
- Run `npm run dev` to test the application locally.

## What has been done
- Initialized Next.js, shadcn/ui, and all dependencies.
- Created Backend Middlewares (`lib/ml.ts`, `lib/supabase.ts`, `lib/groq.ts`).
- Created Core NLP Agent Pipeline (`/api/process-ticket/route.ts`).
- Developed Submission Portal (`app/page.tsx`) with real-time Thought Process observability.
- Developed Admin Kanban Board (`app/admin/page.tsx`).
