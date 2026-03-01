# AI Interview Platform — CLAUDE.md

## Project Purpose

An AI-powered interview platform similar to Mercor/micro1 where:
- Candidates upload resumes → AI parses them → AI generates personalized questions
- A voice agent conducts live conversational interviews (STT → LLM → TTS pipeline)
- Answers are scored asynchronously; a report is generated for recruiters
- Anti-cheat signals are captured during the interview session

---

## Stack Decisions

| Technology | Reason |
|------------|--------|
| **MongoDB + Mongoose** | Flexible schema for `parsedResume` (nested, variable-depth), transcript arrays, anti-cheat event arrays |
| **Node.js + Express** | Consistent TypeScript across frontend/backend; fast WebSocket integration |
| **BullMQ + Redis** | Reliable async job queue for scoring; Redis also used for session state |
| **WebSocket (ws library)** | Low-latency bidirectional channel for real-time interview audio/text |
| **Next.js 14 (App Router)** | File-based routing, React Server Components, easy API route integration |
| **JWT (access + refresh)** | Stateless auth; refresh tokens stored in Redis for revocation |
| **Zod** | Runtime request validation, generates TypeScript types |
| **Anthropic Claude** | LLM for question generation, resume parsing, answer scoring |

---

## Full Folder Structure

```
AI_Interview/
├── CLAUDE.md
├── .gitignore
├── docker-compose.yml               # backend + mongodb + redis
│
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts                # Entry: boots Express + WS + DB + Redis
│       ├── app.ts                   # Express app factory — middleware, routes, error handler
│       ├── config/
│       │   └── index.ts             # Validates + exports all env vars as typed config
│       ├── adapters/
│       │   ├── llm/
│       │   │   ├── llm.interface.ts
│       │   │   ├── claude.adapter.ts
│       │   │   ├── mock-llm.adapter.ts
│       │   │   └── index.ts         # Factory: reads LLM_PROVIDER env var
│       │   ├── stt/
│       │   │   ├── stt.interface.ts
│       │   │   ├── mock-stt.adapter.ts
│       │   │   └── index.ts
│       │   ├── tts/
│       │   │   ├── tts.interface.ts
│       │   │   ├── mock-tts.adapter.ts
│       │   │   └── index.ts
│       │   └── storage/
│       │       ├── storage.interface.ts
│       │       ├── local-storage.adapter.ts
│       │       ├── s3-storage.adapter.ts   # Phase 6+ stub
│       │       └── index.ts
│       ├── features/
│       │   ├── auth/
│       │   │   ├── auth.routes.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── auth.service.ts
│       │   │   └── auth.middleware.ts      # JWT verify middleware
│       │   ├── candidate/
│       │   │   ├── candidate.routes.ts
│       │   │   ├── candidate.controller.ts
│       │   │   ├── candidate.service.ts
│       │   │   └── candidate.model.ts
│       │   ├── job/
│       │   │   ├── job.routes.ts
│       │   │   ├── job.controller.ts
│       │   │   ├── job.service.ts
│       │   │   └── job.model.ts
│       │   ├── interview/
│       │   │   ├── interview.routes.ts
│       │   │   ├── interview.controller.ts
│       │   │   ├── interview.service.ts
│       │   │   ├── interview.model.ts
│       │   │   ├── interview.gateway.ts    # WebSocket event handler
│       │   │   └── interview.state-machine.ts
│       │   ├── scoring/
│       │   │   ├── scoring.service.ts
│       │   │   ├── scoring.worker.ts
│       │   │   ├── scoring.queue.ts
│       │   │   └── score.model.ts
│       │   └── report/
│       │       ├── report.routes.ts
│       │       ├── report.controller.ts
│       │       ├── report.service.ts
│       │       └── report.model.ts
│       ├── lib/
│       │   ├── db.ts                # MongoDB connection (Mongoose)
│       │   ├── redis.ts             # ioredis client
│       │   └── queue.ts             # BullMQ queue setup
│       └── shared/
│           ├── types/index.ts
│           ├── errors/app-error.ts
│           ├── validators/index.ts
│           └── utils/index.ts
│
└── frontend/
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── .env.local.example
    └── src/
        ├── app/
        │   ├── (auth)/login/page.tsx
        │   ├── (auth)/register/page.tsx
        │   ├── candidate/onboard/page.tsx
        │   ├── candidate/interview/[id]/page.tsx
        │   ├── recruiter/dashboard/page.tsx
        │   ├── recruiter/jobs/page.tsx
        │   ├── recruiter/reports/[id]/page.tsx
        │   ├── layout.tsx
        │   └── page.tsx
        ├── components/
        │   ├── interview/
        │   ├── report/
        │   └── shared/
        ├── hooks/
        ├── lib/api.ts
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
  │ 2 warmup questions exhausted                             │
  ▼                                                          │
TOPIC_1 ─────────────────────────────────────────────────── │
  │ topic questions + follow-ups exhausted                   │ ANY → ABANDONED
  ▼                                                          │ (disconnect/timeout)
TOPIC_2 ... TOPIC_N                                          │
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
- After answer, AI evaluates depth
- Shallow → ask follow-up (max 2 per question)
- Follow-ups are pre-generated in `Question.followUpPrompts`

Timeout rules:
- No answer in 90s → AI asks "Are you still there?"
- No response in another 60s → ABANDONED

---

## Docker Setup

```bash
# Start all backend services
docker-compose up -d

# Services started:
# - backend (port 4000)
# - mongodb (port 27017)
# - redis (port 6379)

# Frontend runs separately
cd frontend && npm run dev   # port 3000
```

---

## Conventions

- **File naming**: camelCase (`interview.service.ts`, `job.model.ts`)
- **Classes**: PascalCase (`ClaudeAdapter`, `InterviewService`)
- **Feature modules**: All domain logic self-contained in `features/<domain>/`
- **Validation**: Zod schemas in `shared/validators/index.ts` for all request bodies
- **Errors**: `AppError` class with status codes; global error handler in `app.ts`
- **Config**: All env vars validated at startup via `config/index.ts` — no `process.env` elsewhere
- **No barrel files** for features — import directly from the specific file
- **Adapters**: Never import vendor SDKs directly in features — always go through adapters

---

## Phased Build — What's Real vs Mocked

| Phase | Real | Mocked |
|-------|------|--------|
| 1 — Foundation | Express, MongoDB, Redis, JWT auth | Everything else |
| 2 — Candidate/Job/Resume | Claude LLM, local storage, CRUD | STT, TTS |
| 3 — Interview Engine | State machine, WS gateway, question gen, text interview | STT (text passthrough), TTS (log) |
| 4 — Scoring/Reports | BullMQ scoring, LLM scoring, report generation | STT, TTS |
| 5 — Audio Layer | Adapter interfaces fully wired | Actual STT/TTS vendor calls |
| 6 — Frontend | All UI, API calls, WS, anti-cheat events | Audio (text input initially) |

---

## Environment Variables

See `backend/.env.example` for all required variables.

Key variables:
- `LLM_PROVIDER` — `claude` | `mock`
- `STT_PROVIDER` — `mock` (Deepgram in Phase 5+)
- `TTS_PROVIDER` — `mock` (ElevenLabs in Phase 5+)
- `STORAGE_PROVIDER` — `local` | `s3`
- `ANTHROPIC_API_KEY` — Required when `LLM_PROVIDER=claude`
