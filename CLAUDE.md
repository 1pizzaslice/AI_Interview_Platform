# AI Interview Platform — CLAUDE.md

## Project Purpose

An AI-powered interview platform similar to Mercor/micro1 where:
- Candidates upload resumes → AI parses them → AI generates personalized questions
- A voice agent conducts live conversational interviews (STT → LLM → TTS pipeline)
- AI evaluates answers in real-time, adapts difficulty, and generates context-aware follow-ups
- Answers are scored asynchronously across multiple dimensions; a report is generated for recruiters
- Anti-cheat signals are captured (tab switches, copy-paste, face detection, response timing)

---

## Stack Decisions

| Technology | Reason |
|------------|--------|
| **MongoDB + Mongoose** | Flexible schema for `parsedResume` (nested, variable-depth), transcript arrays, anti-cheat event arrays |
| **Node.js + Express** | Consistent TypeScript across frontend/backend; fast WebSocket integration |
| **BullMQ + Redis** | Reliable async job queue for scoring; Redis also used for session state and refresh tokens |
| **WebSocket (ws library)** | Low-latency bidirectional channel for real-time interview audio/text |
| **Next.js 14 (App Router)** | File-based routing, React Server Components, easy API route integration |
| **JWT (access + refresh)** | Stateless auth; refresh tokens stored in Redis for revocation |
| **Zod** | Runtime request validation, generates TypeScript types |
| **Anthropic Claude** | LLM for question generation, resume parsing, answer evaluation, answer scoring |
| **Deepgram** | Real-time STT (speech-to-text) with live WebSocket streaming |
| **ElevenLabs** | TTS (text-to-speech) with streaming audio |
| **Pino** | Structured JSON logging with log levels and request correlation |
| **Sentry** | Error tracking — `@sentry/node` (backend) + `@sentry/nextjs` (frontend) |
| **Puppeteer** | Server-side PDF generation for report exports |
| **Recharts** | Data visualization for recruiter analytics dashboard |
| **TensorFlow.js (BlazeFace)** | Browser-based face detection for anti-cheat |
| **Vitest** | Unit/integration testing for backend and frontend |

---

## Folder Structure

```
AI_Interview/
├── CLAUDE.md
├── FEATURES.md                        # Full feature checklist (v0 → v1.2)
├── .gitignore
├── docker-compose.yml
├── .github/workflows/ci.yml          # CI/CD pipeline
│
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── server.ts                  # Entry: boots Express + WS + DB + Redis + Sentry
│       ├── app.ts                     # Express app factory — middleware, routes, rate limiting, error handler
│       ├── config/
│       │   └── index.ts               # Validates + exports all env vars as typed config
│       ├── adapters/
│       │   ├── llm/
│       │   │   ├── llm.interface.ts
│       │   │   ├── claude.adapter.ts
│       │   │   ├── mock-llm.adapter.ts
│       │   │   └── index.ts           # Factory: reads LLM_PROVIDER env var
│       │   ├── stt/
│       │   │   ├── stt.interface.ts   # ISTTAdapter + ILiveSTTSession interfaces
│       │   │   ├── deepgram-stt.adapter.ts       # Batch STT
│       │   │   ├── deepgram-live-stt.adapter.ts  # Live streaming STT
│       │   │   ├── mock-stt.adapter.ts
│       │   │   └── index.ts
│       │   ├── tts/
│       │   │   ├── tts.interface.ts
│       │   │   ├── elevenlabs-tts.adapter.ts
│       │   │   ├── mock-tts.adapter.ts
│       │   │   └── index.ts
│       │   └── storage/
│       │       ├── storage.interface.ts
│       │       ├── local-storage.adapter.ts
│       │       ├── s3-storage.adapter.ts   # Stub — not yet wired
│       │       └── index.ts
│       ├── features/
│       │   ├── auth/
│       │   │   ├── auth.routes.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── auth.service.ts
│       │   │   └── auth.middleware.ts       # requireAuth + requireRole middleware
│       │   ├── candidate/
│       │   │   ├── candidate.routes.ts
│       │   │   ├── candidate.controller.ts
│       │   │   ├── candidate.service.ts
│       │   │   └── candidate.model.ts
│       │   ├── job/
│       │   │   ├── job.routes.ts
│       │   │   ├── job.controller.ts
│       │   │   ├── job.service.ts
│       │   │   └── job.model.ts             # Includes interviewConfig schema
│       │   ├── interview/
│       │   │   ├── interview.routes.ts
│       │   │   ├── interview.controller.ts
│       │   │   ├── interview.service.ts     # Core interview logic + LLM evaluation
│       │   │   ├── interview.model.ts       # Includes interviewConfig snapshot
│       │   │   ├── interview.gateway.ts     # WebSocket event handler + audio streaming
│       │   │   ├── interview.state-machine.ts  # Pure state machine (no I/O)
│       │   │   ├── interview.persona.ts     # AI persona system prompt
│       │   │   └── __tests__/
│       │   │       └── interview.state-machine.test.ts
│       │   ├── scoring/
│       │   │   ├── scoring.service.ts       # Multi-dimension scoring + consistency + red flags
│       │   │   ├── scoring.worker.ts        # BullMQ worker (separate process)
│       │   │   ├── scoring.queue.ts
│       │   │   └── score.model.ts           # Includes resumeAlignment, confidence, redFlags
│       │   ├── report/
│       │   │   ├── report.routes.ts         # Includes analytics, compare, export, feedback
│       │   │   ├── report.controller.ts
│       │   │   ├── report.service.ts
│       │   │   ├── report.model.ts
│       │   │   ├── analytics.service.ts     # MongoDB aggregation pipelines
│       │   │   ├── analytics.controller.ts
│       │   │   ├── export.service.ts        # PDF (Puppeteer) + CSV generation
│       │   │   ├── export.controller.ts
│       │   │   ├── feedback.service.ts      # Sanitized candidate feedback
│       │   │   └── feedback.controller.ts
│       │   ├── question-bank/
│       │   │   ├── question-bank.model.ts
│       │   │   ├── question-bank.service.ts
│       │   │   ├── question-bank.controller.ts
│       │   │   └── question-bank.routes.ts
│       │   └── pipeline/
│       │       ├── pipeline.model.ts        # Stages: applied → screened → interviewed → offered → rejected
│       │       ├── pipeline.service.ts
│       │       ├── pipeline.controller.ts
│       │       └── pipeline.routes.ts
│       ├── lib/
│       │   ├── db.ts                  # MongoDB connection (Mongoose)
│       │   ├── redis.ts               # ioredis client
│       │   ├── queue.ts               # BullMQ queue setup
│       │   └── logger.ts              # Pino structured logger
│       └── shared/
│           ├── types/index.ts
│           ├── errors/app-error.ts
│           ├── validators/index.ts
│           ├── utils/index.ts
│           └── __tests__/
│               └── sanitize.test.ts
│
└── frontend/
    ├── package.json
    ├── next.config.ts                  # Wrapped with withSentryConfig
    ├── tailwind.config.ts
    ├── .env.local.example
    └── src/
        ├── instrumentation.ts          # Sentry server-side init + onRequestError
        ├── instrumentation-client.ts   # Sentry client-side init + router transitions
        ├── middleware.ts               # Auth guards + role-based route protection
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── error.tsx               # Error boundary with retry
        │   ├── global-error.tsx        # Root error boundary (Sentry-instrumented)
        │   ├── not-found.tsx           # Custom 404 page
        │   ├── loading.tsx             # Global loading skeleton
        │   ├── (auth)/login/page.tsx
        │   ├── (auth)/register/page.tsx
        │   ├── candidate/onboard/page.tsx
        │   ├── candidate/interview/[id]/page.tsx
        │   ├── candidate/feedback/[id]/page.tsx
        │   ├── recruiter/dashboard/page.tsx
        │   ├── recruiter/jobs/page.tsx
        │   ├── recruiter/reports/[id]/page.tsx
        │   ├── recruiter/analytics/page.tsx
        │   ├── recruiter/compare/page.tsx
        │   ├── recruiter/pipeline/page.tsx
        │   └── recruiter/question-banks/page.tsx
        ├── components/
        │   ├── ui/                     # Reusable component library
        │   │   ├── Button.tsx, Input.tsx, Card.tsx, Badge.tsx
        │   │   ├── Modal.tsx, Toast.tsx, ProgressBar.tsx
        │   │   └── LoadingSkeleton.tsx
        │   ├── interview/
        │   │   ├── EquipmentCheck.tsx  # Pre-interview mic/speaker/network test
        │   │   ├── FaceDetector.tsx    # TensorFlow.js BlazeFace anti-cheat
        │   │   └── InterviewProgress.tsx  # Visual phase stepper
        │   ├── auth/
        │   │   └── AuthProvider.tsx    # Token refresh provider
        │   ├── report/
        │   └── shared/
        ├── hooks/
        ├── lib/
        │   ├── api.ts                  # Axios client with 401 interceptor + auto-refresh
        │   └── cn.ts                   # clsx + tailwind-merge utility
        ├── stores/
        └── types/
```

---

## Adapter Pattern

All vendor integrations are abstracted behind interfaces. Swapping providers requires only:
1. Implementing the interface
2. Setting the appropriate env var

```typescript
// Example: swap STT provider
STT_PROVIDER=deepgram  // instead of 'mock'
```

The factory in each adapter's `index.ts` reads the env var and returns the right implementation:

```typescript
export function createLLMAdapter(): ILLMAdapter {
  if (config.LLM_PROVIDER === 'mock') return new MockLLMAdapter();
  return new ClaudeAdapter(config.ANTHROPIC_API_KEY);
}
```

---

## Interview State Machine

```
INTRO ──────────────────────────────────────────────────────┐
  │ candidate says "ready"                                   │
  ▼                                                          │
WARMUP ──────────────────────────────────────────────────── │
  │ warmup questions exhausted (configurable count)          │
  ▼                                                          │
TOPIC_1 ─────────────────────────────────────────────────── │
  │ LLM evaluates answer depth → follow-up or next topic     │ ANY → ABANDONED
  ▼                                                          │ (disconnect/silence)
TOPIC_2 ... TOPIC_N (configurable max topics)                │
  │ all topics complete                                      │
  ▼                                                          │
WRAP_UP ──────────────────────────────────────────────────── │
  │ AI closes session                                        │
  ▼                                                          │
SCORING (BullMQ job dispatched)                              │
  │ worker completes                                         │
  ▼                                                          │
DONE ◄───────────────────────────────────────────────────────┘
```

Follow-up logic within TOPIC_N states:
- After answer, LLM evaluates depth (replaced word-count heuristic)
- Shallow/vague/off-topic → context-aware dynamic follow-up (max configurable per question)
- Follow-ups reference specific claims in the candidate's answer + resume data
- Natural LLM-generated transitions between topics

Silence detection (Deepgram-based):
- 5-15s silence: gentle nudge ("Take your time...")
- 15-30s: "Are you still there?"
- 30s+: abandonment logic

---

## API Routes

```
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout          (protected)

# Candidates
GET    /api/candidates/me        (candidate)
PATCH  /api/candidates/me        (candidate)
POST   /api/candidates/resume    (candidate, rate-limited 5/hr)

# Jobs
POST   /api/jobs                 (recruiter)
GET    /api/jobs                 (any auth)
GET    /api/jobs/:id             (any auth)
PATCH  /api/jobs/:id             (recruiter)
DELETE /api/jobs/:id             (recruiter, soft-delete)

# Interviews
POST   /api/interviews           (candidate, rate-limited 10/hr)
GET    /api/interviews/:id       (owner only)
GET    /api/interviews/me        (candidate)
GET    /api/interviews/job/:id   (recruiter)

# Reports
GET    /api/reports/:sessionId           (recruiter)
GET    /api/reports/recruiter/me         (recruiter)
GET    /api/reports/recruiter/analytics  (recruiter)
GET    /api/reports/recruiter/compare?sessionIds=a,b,c  (recruiter, max 4)
GET    /api/reports/:sessionId/export?format=pdf|csv    (recruiter)
GET    /api/reports/:sessionId/feedback  (candidate, sanitized)

# Question Banks
POST   /api/question-banks       (recruiter)
GET    /api/question-banks       (recruiter)
GET    /api/question-banks/:id   (recruiter)
PATCH  /api/question-banks/:id   (recruiter)
DELETE /api/question-banks/:id   (recruiter)

# Pipeline
GET    /api/pipeline             (recruiter)
POST   /api/pipeline             (recruiter)
PATCH  /api/pipeline/:id/stage   (recruiter)
DELETE /api/pipeline/:id         (recruiter)

# WebSocket
WS     ws://host:4000/interview  (join|answer|anticheat|ping events)

# Health
GET    /health
```

---

## Dev Startup Commands

```bash
# 1. MongoDB + Redis (required first)
docker-compose up -d mongodb redis

# 2. Backend API + WebSocket server (terminal 1)
cd backend && npm run dev        # port 4000

# 3. BullMQ scoring worker (terminal 2 — separate process, required for reports)
cd backend && npm run worker

# 4. Frontend (terminal 3)
cd frontend && npm run dev       # port 3000
```

```bash
# Tests
cd backend && npx vitest run     # 26 tests (state machine + sanitization)

# Type checking
cd backend && npx tsc --noEmit
cd frontend && npx next build
```

> Note: `backend/.env` already has `LLM_PROVIDER=claude` and `ANTHROPIC_API_KEY` set.
> Do not commit `.env` — it is gitignored.

---

## Current Build Status

**v0 (all 6 phases) + v1.0 (Sprints 1-4) + v1.1 (all 8 features) are complete.**

See `FEATURES.md` for the full feature checklist with testing checkboxes.

- Backend: `npx tsc --noEmit` passes clean
- Frontend: `npx next build` passes clean (13 pages)
- Tests: 26/26 passing (Vitest)
- Sentry: zero warnings

**Next milestone:** v1.2 (Scale, Integrations, Polish) — not yet started.

---

## Conventions

- **File naming**: kebab-case for feature modules (`question-bank.service.ts`), camelCase for utilities (`interview.service.ts`)
- **Classes**: PascalCase (`ClaudeAdapter`, `InterviewService`)
- **Feature modules**: All domain logic self-contained in `features/<domain>/`
- **Validation**: Zod schemas in `shared/validators/index.ts` for all request bodies
- **Errors**: `AppError` class with status codes; global error handler in `app.ts`
- **Config**: All env vars validated at startup via `config/index.ts` — no `process.env` elsewhere (except frontend `NEXT_PUBLIC_*`)
- **No barrel files** for features — import directly from the specific file
- **Adapters**: Never import vendor SDKs directly in features — always go through adapters
- **Logging**: Use Pino logger (`src/lib/logger.ts`) — format: `logger.error({ err }, 'message')`, never `console.log/error`
- **Tests**: Vitest in `__tests__/` directories alongside source files

---

## Environment Variables

See `backend/.env.example` for all required variables.

Key variables:
- `LLM_PROVIDER` — `claude` | `mock`
- `STT_PROVIDER` — `deepgram` | `mock`
- `TTS_PROVIDER` — `elevenlabs` | `mock`
- `STORAGE_PROVIDER` — `local` | `s3`
- `ANTHROPIC_API_KEY` — Required when `LLM_PROVIDER=claude`
- `DEEPGRAM_API_KEY` — Required when `STT_PROVIDER=deepgram`
- `ELEVENLABS_API_KEY` — Required when `TTS_PROVIDER=elevenlabs`
- `SENTRY_DSN` — Optional, enables backend error tracking
- `NEXT_PUBLIC_SENTRY_DSN` — Optional, enables frontend error tracking
