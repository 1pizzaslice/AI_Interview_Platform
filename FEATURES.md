# AI Interview Platform — Feature Checklist

> Use this to track what's built, what's tested, and what's planned.
> Update the `[ ]` to `[x]` as features are verified/tested.

---

## v0 — Working Prototype (All 6 Phases)

Core end-to-end flow: resume upload → AI parses → questions generated → live interview → async scoring → recruiter report.

### Phase 1: Foundation
- [ ] Express + TypeScript backend (port 4000)
- [ ] MongoDB + Mongoose (flexible schema for resume, transcripts, events)
- [ ] Redis + BullMQ (async job queue for scoring)
- [ ] JWT auth (access + refresh tokens, refresh stored in Redis)
- [ ] Docker Compose (MongoDB + Redis containers)
- [ ] Role-based access (candidate / recruiter)
- [ ] Zod request validation on all endpoints
- [ ] Global error handler with AppError class

### Phase 2: Candidate, Job & Resume
- [ ] Candidate registration + profile
- [ ] Recruiter job role CRUD (create, list, update, soft-delete)
- [ ] Resume upload (local storage adapter)
- [ ] Claude LLM parses resume → skills, experience, education, summary
- [ ] S3 storage adapter stub (interface ready, not wired)

### Phase 3: Interview Engine
- [ ] Interview state machine (INTRO → WARMUP → TOPIC_1..N → WRAP_UP → SCORING → DONE)
- [ ] WebSocket gateway (`ws://host:4000/interview`) for real-time communication
- [ ] AI question generation from resume + job context (Claude)
- [ ] Follow-up question logic (pre-generated follow-ups per question)
- [ ] Inactivity timeout (90s warning → 60s abandon)
- [ ] Text-based interview mode (STT/TTS mocked)
- [ ] Transcript recording (every AI/candidate message stored)
- [ ] Anti-cheat event types defined (TAB_SWITCH, WINDOW_BLUR, GAZE_LOST, COPY_PASTE, MULTIPLE_FACES)

### Phase 4: Scoring & Reports
- [ ] BullMQ scoring worker (separate process: `npm run worker`)
- [ ] Per-answer LLM scoring across 4 dimensions (technical, communication, depth, relevance)
- [ ] Report generation with narrative summary, strengths, weaknesses, recommendation
- [ ] Recruiter report view page

### Phase 5: Audio Layer (Adapters)
- [ ] STT adapter interface + mock adapter
- [ ] TTS adapter interface + mock adapter
- [ ] Deepgram STT adapter (real, wired)
- [ ] ElevenLabs TTS adapter (real, wired)
- [ ] Streaming TTS audio over WebSocket
- [ ] Audio recording + send from frontend

### Phase 6: Frontend
- [ ] Login / Register pages
- [ ] Candidate onboarding (resume upload)
- [ ] Candidate interview room (WebSocket, text + audio modes)
- [ ] Recruiter dashboard
- [ ] Recruiter jobs management page
- [ ] Recruiter report detail page
- [ ] Zustand stores for auth + interview state
- [ ] API client (`lib/api.ts`) with base URL config

---

## v1.0 — Interview Intelligence + Production Foundation

### Sprint 1: Core Intelligence — "Make the AI Smart"

- [ ] **LLM-powered answer evaluation** — replaced word-count heuristic with Claude call that returns `needsFollowUp`, `reason`, `detectedStrength`, `suggestedProbe`
- [ ] **Conversational AI persona** — persistent persona ("Alex, senior interviewer"), uses candidate name, acknowledges answers specifically, pushes gently on weak answers
- [ ] **Conversation memory** — full transcript passed as history to every LLM call during interview
- [ ] **Natural topic transitions** — LLM-generated bridges between topics (replaced hardcoded "Good answer. Moving on:")
- [ ] **Context-aware dynamic follow-ups** — follow-ups reference specific claims in the answer + cross-reference resume
- [ ] **Response timing analysis (anti-cheat)** — tracks `responseTimeMs` per transcript entry, flags suspiciously fast or robotic timing
- [ ] **Copy-paste detection (frontend)** — paste event listener sends `COPY_PASTE` anti-cheat event with `pastedLength` metadata

### Sprint 2: Adaptive Depth — "Make the AI Responsive"

- [ ] **Dynamic difficulty adjustment** — `performanceSnapshot` tracks rolling averages; generates harder/easier questions at runtime based on candidate performance
- [ ] **Cross-answer consistency scoring** — second scoring pass reviewing all answers together for contradictions and inconsistent depth
- [ ] **Resume verification scoring** — `resumeAlignment` dimension (0-10): does the answer substantiate or contradict resume claims?
- [ ] **Red flag detection** — AI-generated answer probability, memorized answer detection, timing anomaly analysis, severity levels per flag
- [ ] **Confidence scoring** — `confidence: 0.0-1.0` on each score (how certain the AI is about its assessment)

### Sprint 3: Live Audio — "Make it Sound Real"

- [ ] **Live STT streaming (Deepgram WebSocket)** — persistent Deepgram connection per session, real-time partial transcripts, no buffering
- [ ] **Interruption handling** — stops TTS when candidate starts speaking, marks interrupted utterances in transcript
- [ ] **Silence detection & natural pausing** — Deepgram utterance end events: 5s thinking, 15s nudge, 30s abandon (replaced blunt 90s timer)
- [ ] **Browser face detection (anti-cheat)** — TensorFlow.js BlazeFace at ~2 FPS, detects 0 faces (GAZE_LOST) or 2+ faces (MULTIPLE_FACES), small webcam preview

### Sprint 4: Production Foundation

- [ ] **Frontend component library** — extracted `Button`, `Input`, `Card`, `Badge`, `Modal`, `LoadingSkeleton`, `ProgressBar`, `Toast`, `cn()` utility
- [ ] **Auth guards + token refresh** — Next.js middleware for route protection, role-based redirects, 401 interceptor with auto-refresh
- [ ] **Error boundaries + loading states** — `error.tsx`, `not-found.tsx`, skeleton components replacing "Loading..." text
- [ ] **Rate limiting** — `express-rate-limit`: 100 req/min global, 5/min login, 3/min register, 10/hr interview create, 5/hr resume upload
- [ ] **Structured logging** — Pino logger with JSON format, request ID correlation, log levels from env (replaced all `console.error` calls)
- [ ] **Testing foundation** — Vitest + supertest (backend), 26 tests passing (state machine + sanitization). Vitest + RTL (frontend)
- [ ] **CI/CD pipeline** — GitHub Actions: lint → type-check → unit tests → build, with MongoDB + Redis service containers
- [ ] **Interview progress indicator** — visual stepper showing current phase (Intro → Warmup → Topics → Wrap Up)
- [ ] **Pre-interview equipment check** — mic test with VU meter, speaker test, network latency check, browser compatibility, "Skip to text mode" escape hatch

---

## v1.1 — Recruiter Power Tools + Candidate Experience

- [ ] **Advanced recruiter analytics dashboard** — MongoDB aggregation pipelines: score distribution, recommendation breakdown, dimension averages, time trends, role breakdown. Recharts visualizations with date/role filters
- [ ] **Candidate comparison view** — side-by-side comparison for 2-4 candidates with radar chart overlay, score table (highest highlighted), strengths/weaknesses cards
- [ ] **Custom question banks** — recruiters create/manage question banks per job. Hybrid mode: bank questions first, LLM fills gaps for uncovered topics
- [ ] **Interview template customization** — per-job config: maxTopics, warmupQuestions, maxFollowUps, estimatedDuration. Config snapshotted on session at creation time
- [ ] **Report export (PDF/CSV)** — `GET /api/reports/:sessionId/export?format=pdf|csv`. Puppeteer for PDF with styled HTML template, native CSV generation
- [ ] **Candidate pipeline management** — pipeline stages: applied → screened → interviewed → offered → rejected. Kanban board UI with HTML5 drag-and-drop
- [ ] **Post-interview candidate feedback** — sanitized feedback for candidates: performance tier, dimension ratings (Strong/Competent/Developing/Weak), improvement tips. No raw scores or hiring recommendation exposed
- [ ] **Error tracking (Sentry)** — `@sentry/node` on backend (init in server.ts, captureException in error handler), `@sentry/nextjs` on frontend (instrumentation files, global-error boundary, router transition tracking)

---

## v1.2 — Scale, Integrations & Polish (PLANNED)

> These features are designed and planned but **not yet implemented**.

- [ ] **Team/Organization management** — Organization model, member roles (owner/admin/member), org-scoped jobs and reports, multi-recruiter teams
- [ ] **Email notifications** — email adapter (Resend/SES/mock following adapter pattern). Triggers: report ready, interview invitation, bulk invites
- [ ] **Behavioral + situational questions** — `questionType: 'technical' | 'behavioral' | 'situational' | 'system_design'`, configurable mix per interview
- [ ] **Resume claim probing** — identify verifiable resume claims during question generation, store as metadata, evaluation checks if answers substantiate claims
- [ ] **S3 storage + HTTPS + DB backups + APM** — complete S3 adapter, reverse proxy with auto-TLS, Prometheus + Grafana, MongoDB backup strategy
- [ ] **Mobile responsiveness + dark mode** — responsive breakpoints audit, Tailwind `darkMode: 'class'`, theme toggle

---

## v2.0 — Platform & Monetization (FUTURE)

> High-level vision, not yet designed in detail.

- [ ] Multi-tenant architecture (tenantId on all models)
- [ ] Usage-based billing (Stripe)
- [ ] API access for enterprise (API keys, versioned API, webhooks)
- [ ] White-label capability (per-tenant branding, custom domains)
- [ ] Practice mode for candidates (reduced questions, instant feedback, no scoring)
- [ ] Code review / system design discussion modes
- [ ] Comparative candidate ranking (batch analysis across candidates)
- [ ] ATS integrations (Greenhouse, Lever)
- [ ] Calendar integration (scheduling, .ics generation)
- [ ] Multi-language support (Deepgram nova-2, 36+ languages)
- [ ] Voice tone analysis (speaking pace, filler words, confidence signals)
- [ ] Accessibility (WCAG 2.1 AA)

---

## How to Test

```bash
# 1. Start infrastructure
docker-compose up -d mongodb redis

# 2. Backend API + WebSocket (terminal 1)
cd backend && npm run dev          # port 4000

# 3. Scoring worker (terminal 2)
cd backend && npm run worker

# 4. Frontend (terminal 3)
cd frontend && npm run dev         # port 3000

# 5. Run backend tests
cd backend && npx vitest run       # 26 tests

# 6. Build checks
cd backend && npx tsc --noEmit     # type-check
cd frontend && npx next build      # full build
```

### Full E2E Smoke Test
1. Register as recruiter → create job role
2. Register as candidate → upload resume → verify AI parses it
3. Start interview → complete all phases (INTRO → WARMUP → TOPICS → WRAP_UP)
4. Wait for scoring worker to process → verify report generated
5. Check recruiter dashboard → analytics → pipeline → reports
