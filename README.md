# AI Interview Platform

An AI-powered interview platform where candidates upload resumes, an AI agent conducts live voice interviews, and recruiters receive detailed scoring reports.

## Features

- **Resume Parsing** — Claude extracts skills, experience, and education from uploaded PDFs
- **AI Question Generation** — Tailored interview questions generated from resume + job description
- **Live Interview Engine** — WebSocket-based conversational interview with a state machine (INTRO → WARMUP → TOPIC\_N → WRAP\_UP → DONE)
- **Async Scoring** — BullMQ workers score each answer across 4 dimensions using Claude
- **Recruiter Reports** — Narrative summary with strengths, weaknesses, and hire recommendation
- **Anti-Cheat Signals** — Tab switch, focus loss, and copy-paste events captured during sessions
- **Adapter Pattern** — LLM, STT, TTS, and Storage are all swappable via env vars

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB + Mongoose |
| Cache / Queue | Redis + BullMQ |
| Real-time | WebSocket (`ws` library) |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) |
| Auth | JWT (access + refresh tokens, refresh stored in Redis) |
| Validation | Zod |

## Project Structure

```
AI_Interview/
├── backend/
│   └── src/
│       ├── adapters/          # LLM, STT, TTS, Storage — interface + factory pattern
│       ├── features/          # auth, candidate, job, interview, scoring, report
│       ├── lib/               # db, redis, queue
│       └── shared/            # types, errors, validators, utils
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router pages
│       ├── components/        # interview room, report viewer, shared UI
│       ├── hooks/
│       └── stores/            # Zustand state
└── docker-compose.yml         # MongoDB + Redis
```

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Environment Setup

```bash
cp backend/.env.example backend/.env
# Fill in ANTHROPIC_API_KEY and any other required values

cp frontend/.env.local.example frontend/.env.local
```

### 2. Start Infrastructure

```bash
docker-compose up -d mongodb redis
```

### 3. Backend

```bash
cd backend
npm install
npm run dev          # API + WebSocket on port 4000
```

### 4. Scoring Worker (separate terminal)

```bash
cd backend
npm run worker       # BullMQ worker — required for scoring + reports
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev          # Next.js on port 3001
```

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | `claude` or `mock` |
| `STT_PROVIDER` | `mock` (Deepgram in Phase 5+) |
| `TTS_PROVIDER` | `mock` (ElevenLabs in Phase 5+) |
| `STORAGE_PROVIDER` | `local` or `s3` |
| `ANTHROPIC_API_KEY` | Required when `LLM_PROVIDER=claude` |

See `backend/.env.example` for the full list.

## Interview State Machine

```
INTRO → WARMUP → TOPIC_1 → TOPIC_2 ... TOPIC_N → WRAP_UP → SCORING → DONE
                                                      ↑
                                               ANY → ABANDONED (disconnect / timeout)
```

- Follow-up questions are triggered when answers lack depth (max 2 per question)
- 90s silence → "Are you still there?"; 60s more → session abandoned

## API Overview

```
POST   /api/auth/register|login|refresh|logout
GET    /api/candidates/me
POST   /api/candidates/resume
POST   /api/jobs
GET    /api/jobs/:id
POST   /api/interviews
GET    /api/interviews/:id
GET    /api/reports/:sessionId
WS     ws://localhost:4000/interview
```

## WebSocket Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Client → Server | `join` | Join interview session |
| Client → Server | `answer` | Submit text answer |
| Client → Server | `anticheat` | Report anti-cheat signal |
| Server → Client | `ai_message` | AI interviewer message |
| Server → Client | `state_change` | Interview state transition |
| Server → Client | `interview_complete` | Session finished, scoring queued |

## Build Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Foundation | ✅ | Express, MongoDB, Redis, JWT, Docker |
| 2 — Candidate/Job/Resume | ✅ | CRUD, resume upload, LLM parsing |
| 3 — Interview Engine | ✅ | State machine, WebSocket gateway, question gen |
| 4 — Scoring/Reports | ✅ | BullMQ pipeline, LLM scoring, report narrative |
| 5 — Audio Layer | ✅ | Adapter interfaces wired, ready for Deepgram/ElevenLabs |
| 6 — Frontend | ✅ | Next.js pages, Zustand stores, WebSocket interview room |
