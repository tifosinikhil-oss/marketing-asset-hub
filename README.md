# Marketing Asset Hub

A modern marketing operations platform: brief intake, AI-assisted drafting, end-to-end workflow (research → draft → review → design → web dev → published), and a searchable content repository with RAG chat.

Built for marketing teams (content, design, web dev) inside an Office 365 / Microsoft Entra trust boundary, with multi-tenant and multi-brand support baked in from day one.

## Stack

| Concern              | Choice                                                          |
|----------------------|-----------------------------------------------------------------|
| App framework        | Next.js 16 (App Router) + TypeScript + React Server Components  |
| UI                   | Tailwind CSS 4 + shadcn/ui (Radix) + lucide                     |
| Database             | Postgres (Neon) with `pgvector`                                 |
| ORM                  | Prisma                                                          |
| Auth                 | NextAuth v5 with Microsoft Entra ID                             |
| Background jobs      | Inngest                                                         |
| File storage         | Cloudflare R2 (presigned URLs)                                  |
| Cache / rate limit   | Upstash Redis                                                   |
| Email                | Microsoft Graph (`sendMail` from a shared mailbox)              |
| AI generation        | Anthropic Claude (Sonnet 4.6)                                   |
| Embeddings           | Voyage AI (`voyage-3-large`, 1024-dim)                          |
| Voice transcription  | Deepgram (Phase 7)                                              |
| Web research         | Tavily (Phase 6)                                                |
| Realtime             | Pusher Channels (Phase 3)                                       |

## Repo layout

```
prisma/schema.prisma                multi-tenant + multi-brand data model with pgvector
src/auth.ts                         NextAuth v5 config (Entra ID provider)
src/middleware.ts                   route guard
src/lib/db.ts                       Prisma singleton
src/lib/redis.ts                    Upstash + ratelimit
src/lib/rbac.ts                     role/permission matrix
src/lib/storage/r2.ts               presigned URL helpers
src/lib/ai/anthropic.ts             Claude client + brief/WBS prompts (tool-use, prompt caching)
src/lib/ai/embeddings.ts            Voyage client + chunker
src/lib/email/graph.ts              Microsoft Graph send wrapper
src/lib/email/templates.ts          transactional email HTML
src/lib/validators/brief.ts         zod schemas + content-type/status maps
src/inngest/                        Inngest client + functions
src/server/actions/                 Next.js Server Actions (create request, transition, comment, AI draft)
src/app/(app)/                      authenticated app shell, dashboard, requests, repository, chat...
src/app/api/                        auth, inngest, upload-url
src/components/forms/brief-form.tsx the standardized brief form with AI draft button
src/components/app-shell.tsx        sidebar + topbar layout
src/components/ui/                  shadcn primitives (button, input, card, badge, ...)
prisma/seed.ts                      demo org + brand + sample request
```

## Quick demo (one command)

If you have Docker:

```bash
docker compose up
# wait ~30s for postgres + the app to boot, then visit http://localhost:3000
# pick "Continue (dev)" with admin@demo.local — no Entra needed.
```

This boots Postgres + pgvector, runs the schema migration, seeds a demo org / brand / sample request, and starts the Next.js dev server with the dev-mode credentials provider so you can sign in without provisioning Microsoft Entra.

## Local development (without Docker)

```bash
cp .env.example .env
# Fill in DATABASE_URL (Neon free tier works) and AUTH_SECRET at minimum.
# For local-only sign-in without Entra, set DEV_AUTH=true and DEV_AUTH_EMAIL.
npm install
npx prisma db push          # (or `prisma migrate dev --name init` once you want a migration history)
npm run db:seed
npm run dev
```

Production sign-in: configure Microsoft Entra ID and `Mail.Send` (Application permission, scoped via `New-ApplicationAccessPolicy` to your shared mailbox). See the plan at `/root/.claude/plans/i-want-to-create-silly-lighthouse.md` for the full IT setup.

## Phase status

This commit lands **Phase 0 (Foundations)** and a working slice of **Phase 1 (Request loop MVP)**:

- ✅ Multi-tenant + multi-brand Prisma schema (orgs, brands, users, requests, tasks, drafts, files, comments, activity, notifications, repository, customization, governance)
- ✅ NextAuth v5 + Microsoft Entra ID
- ✅ App shell with sidebar + topbar
- ✅ Standardized brief form with zod validation and AI-draft-from-description
- ✅ Request list and request detail with status state machine + role-gated transitions
- ✅ Comments + activity timeline
- ✅ Microsoft Graph email — submit notification + status-change notification (via Inngest)
- ✅ R2 presigned uploads
- ✅ RBAC matrix (Admin / Manager / Producer / Reviewer / Requester / Freelancer / Viewer)

Next phases per the plan: AI WBS generation, end-to-end workflow with Tiptap drafts and design uploads, repository + RAG, integrations + insights, brand-quality lint, multi-channel intake.

## Scripts

| Script                  | What it does                                  |
|-------------------------|-----------------------------------------------|
| `npm run dev`           | Start the dev server                          |
| `npm run build`         | `prisma generate` + `next build`              |
| `npm run typecheck`     | `tsc --noEmit`                                |
| `npm run lint`          | `next lint`                                   |
| `npm run prisma:migrate`| Run a new migration in dev                    |
| `npm run db:seed`       | Seed a demo org, brand, and request           |

## Security notes

- All domain tables carry `orgId`; queries must scope by `session.user.orgId`. Brand isolation goes one level deeper via `brandId`.
- AI calls are logged to `AiUsageEvent` for cost attribution and per-user/team caps.
- File uploads go directly from the browser to R2 via presigned URLs — files never transit the app server.
- Audit log table exists; wire `AuditLog.create()` from sensitive Server Actions in Phase 5.
