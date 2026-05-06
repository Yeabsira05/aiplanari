# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint
```

## Environment variables (`.env.local`)

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CANVAS_BASE_URL=https://reykjavik.instructure.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Architecture

**Stack**: Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Supabase · OpenAI + Anthropic SDKs

### Canvas integration
- Canvas bearer token is stored in `localStorage["canvas_token"]` and sent to every `/api/canvas/*` route in the request body
- All Canvas API calls are server-side via `fetchAllPages<T>` in `src/lib/canvas-fetch.ts` — never called client-side
- Canvas instance: `https://reykjavik.instructure.com`
- Deadline IDs use the format `${courseId}-${assignmentId}` — split on `-` to reconstruct Canvas API paths (e.g. for submission)

### Supabase
- `src/lib/supabase.ts` exports a server-side admin client using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- Storage bucket: `resources` — files uploaded by students for sharing
- DB table: `resources` — metadata (title, course, type, uploader, url)

### AI routes
All under `src/app/api/ai/`. OpenAI SDK is used by most routes; `@anthropic-ai/sdk` is also available.

### Client-side storage
| Key | Storage | Purpose |
|-----|---------|---------|
| `canvas_token` | localStorage | Canvas bearer token |
| `student_name` | localStorage | Display name in header |
| `done_deadlines` | localStorage | Array of completed deadline IDs |
| `local_deadlines` | localStorage | Manually added deadlines |
| `canvas_deadlines_cache` | sessionStorage | Cached Canvas deadlines (`CACHE_VERSION=2`) |

Bump `CACHE_VERSION` in `src/app/dashboard/page.tsx` whenever the `Deadline` type shape changes to force re-fetch.

### PDF viewer
`src/components/PdfViewer.tsx` uses `react-pdf` + `pdfjs-dist`. The PDF.js worker must be configured via `GlobalWorkerOptions.workerSrc` before rendering.

## Key files

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | `Deadline` type — source of truth for data shape |
| `src/lib/canvas-fetch.ts` | `fetchAllPages<T>` pagination helper |
| `src/lib/supabase.ts` | Supabase admin client |
| `src/lib/localDeadlines.ts` | localStorage-backed custom deadline CRUD |
| `src/lib/dates.ts` | `getDaysLeft`, `getUrgency` utilities |
| `src/components/AppHeader.tsx` | App-wide nav + sign-out |
| `src/components/DeadlineCard.tsx` | Deadline card with submit modal, AI summarize, urgency bar |
| `src/components/PdfViewer.tsx` | PDF viewer with AI highlight + text-selection explain |
| `src/app/dashboard/page.tsx` | Main dashboard; deadline fetch + AI prioritization |
| `src/app/resources/page.tsx` | Resource upload/browse with recommendation scoring |
| `src/app/api/canvas/submit/route.ts` | 3-step Canvas S3 upload flow for `online_upload` assignments |
| `src/app/api/canvas/deadlines/route.ts` | Fetches all assignments across all courses |
