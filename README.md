# AI Interview Platform

An AI-powered interview platform where candidates upload resumes, an AI agent conducts live voice interviews, and recruiters receive detailed scoring reports.

## Features

- **Resume Parsing** — Claude extracts skills, experience, and education from uploaded PDFs
- **AI Question Generation** — Tailored interview questions generated from resume + job description
- **Live Interview Engine** — WebSocket-based conversational interview with a state machine (INTRO → WARMUP → TOPIC\_N → WRAP\_UP → DONE)
- **Streaming TTS Audio** — AI speech begins playing within ~500 ms via MediaSource Extensions + chunked WebSocket delivery
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

## Prerequisites

- [Docker + Docker Compose](https://docs.docker.com/get-docker/)
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

---

## Quick Start

### 1. Copy and fill in environment files

```bash
cp backend/.env.example backend/.env
# Open backend/.env and set ANTHROPIC_API_KEY (and optionally DEEPGRAM_API_KEY)

cp frontend/.env.local.example frontend/.env.local
# No changes needed for local dev
```

### 2. First-time setup — install deps and start everything

```bash
npm run fresh
```

That's it. `fresh` installs all dependencies and then starts MongoDB, Redis, the backend API, the BullMQ scoring worker, and the frontend in one shot.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:4000 |
| WebSocket | ws://localhost:4000/interview |

---

## Scripts

Run all of these from the **project root** (`AI_Interview/`).

| Command | What it does |
|---------|-------------|
| `npm run fresh` | Install all deps + start infra + start all processes |
| `npm run up` | Start infra + all processes (assumes deps already installed) |
| `npm run down` | Stop Docker containers (MongoDB + Redis) |
| `npm run setup` | Install backend and frontend dependencies only |

> **`up` vs `fresh`**: Use `fresh` the first time or after a `git pull` that added new packages. Use `up` for day-to-day restarts.

To stop the running processes, press `Ctrl+C` in the terminal where you ran `up`/`fresh`, then run `npm run down` to also stop the containers.

---

## Manual Startup (fine-grained control)

If you need individual terminals for better log visibility:

```bash
# Terminal 0 — infra (run once)
docker-compose up -d mongodb redis

# Terminal 1 — backend API + WebSocket (port 4000)
cd backend && npm run dev

# Terminal 2 — BullMQ scoring worker (required for reports)
cd backend && npm run worker

# Terminal 3 — frontend (port 3000)
cd frontend && npm run dev
```

---

## Project Structure

```
AI_Interview/
├── package.json               # Root scripts (up / down / fresh / setup)
├── docker-compose.yml         # MongoDB + Redis
├── backend/
│   └── src/
│       ├── adapters/          # LLM, STT, TTS, Storage — interface + factory pattern
│       ├── features/          # auth, candidate, job, interview, scoring, report
│       ├── lib/               # db, redis, queue
│       └── shared/            # types, errors, validators, utils
└── frontend/
    └── src/
        ├── app/               # Next.js App Router pages
        ├── components/        # interview room, report viewer, shared UI
        ├── hooks/
        └── stores/            # Zustand state
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | When `LLM_PROVIDER=claude` | — | Claude API key |
| `DEEPGRAM_API_KEY` | When `STT_PROVIDER=deepgram` or `TTS_PROVIDER=deepgram` | — | Deepgram API key |
| `LLM_PROVIDER` | No | `mock` | `claude` or `mock` |
| `STT_PROVIDER` | No | `mock` | `mock` or `deepgram` |
| `TTS_PROVIDER` | No | `mock` | `mock` or `deepgram` |
| `STORAGE_PROVIDER` | No | `local` | `local` or `s3` |
| `JWT_SECRET` | Yes | — | Long random string |
| `JWT_REFRESH_SECRET` | Yes | — | Different long random string |

See `backend/.env.example` for the full list including MongoDB URI, Redis URL, timeouts, and S3 config.

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

No changes needed for local development.

---

## Interview State Machine

```
INTRO → WARMUP → TOPIC_1 → TOPIC_2 ... TOPIC_N → WRAP_UP → SCORING → DONE
                                                      ↑
                                               ANY → ABANDONED (disconnect / timeout)
```

- Follow-up questions are triggered when answers lack depth (max 2 per question)
- 90 s silence → "Are you still there?"; 60 s more → session abandoned

---

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
| Client → Server | `join` | Join interview session with JWT |
| Client → Server | `answer` | Submit text answer |
| Client → Server | `recording_start` | Signal mic is active (resets inactivity timer) |
| Client → Server | `anticheat` | Report anti-cheat signal (tab switch, blur) |
| Client → Server | `ping` | Keepalive ping |
| Server → Client | `joined` | Confirmed join + current state |
| Server → Client | `ai_message` | AI interviewer text |
| Server → Client | `audio_start` | Streaming TTS begins — initialise MSE player |
| Server → Client | `audio_end` | Streaming TTS complete — finalise MSE player |
| Server → Client | `candidate_transcript` | STT result echoed back |
| Server → Client | `state_change` | Interview state transition |
| Server → Client | `interview_complete` | Session finished, scoring queued |
| Server → Client | `session_abandoned` | Session timed out or disconnected |
| Server → Client | `pong` | Keepalive response |

Binary frames sent between `audio_start` and `audio_end` are raw MP3 chunks for progressive playback via MediaSource Extensions.

---

## Build Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Foundation | ✅ | Express, MongoDB, Redis, JWT, Docker |
| 2 — Candidate/Job/Resume | ✅ | CRUD, resume upload, LLM parsing |
| 3 — Interview Engine | ✅ | State machine, WebSocket gateway, question gen |
| 4 — Scoring/Reports | ✅ | BullMQ pipeline, LLM scoring, report narrative |
| 5 — Audio Layer | ✅ | Streaming TTS via MSE; Deepgram/ElevenLabs adapter interfaces wired |
| 6 — Frontend | ✅ | Next.js pages, Zustand stores, WebSocket interview room |
