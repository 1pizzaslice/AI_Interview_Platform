import type { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { verifyAccessToken, sanitizeForTTS } from '../../shared/utils';
import { AppError } from '../../shared/errors/app-error';
import type { InterviewState, AntiCheatEvent } from '../../shared/types';
import * as interviewService from './interview.service';

import { createSTTAdapter, type ILiveSTTSession } from '../../adapters/stt';
import { createTTSAdapter } from '../../adapters/tts';
import { logger } from '../../lib/logger';

// --- Graduated silence thresholds (in ms) ---
const SILENCE_NUDGE_MS = 90_000;       // 90s: gentle nudge
const SILENCE_CHECK_MS = 180_000;      // 3min: "Are you still there?"
const SILENCE_ABANDON_MS = 300_000;    // 5min: abandon session

interface WSClient {
  ws: WebSocket;
  sessionId: string | null;
  userId: string;
  role: string;
  pingTimer?: ReturnType<typeof setTimeout>;
  silenceNudgeTimer?: ReturnType<typeof setTimeout>;
  silenceCheckTimer?: ReturnType<typeof setTimeout>;
  silenceAbandonTimer?: ReturnType<typeof setTimeout>;
  pendingAudio: Promise<void> | null;
  lastAiMessageAt: number | null;
  liveSTT: ILiveSTTSession | null;
  isTTSSpeaking: boolean;
  isUserSpeaking: boolean;
  accumulatedTranscript: string;
}

type ClientEvent =
  | { type: 'join'; sessionId: string; token: string }
  | { type: 'answer'; sessionId: string; text: string }
  | { type: 'anticheat'; sessionId: string; event: AntiCheatEvent }
  | { type: 'recording_start'; sessionId: string }
  | { type: 'playback_complete'; sessionId: string }
  | { type: 'ping' };

function send(ws: WebSocket, event: object): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: 'error', code, message });
}

async function sendAIMessageWithAudio(ws: WebSocket, client: WSClient, text: string): Promise<void> {
  client.lastAiMessageAt = Date.now();
  client.isTTSSpeaking = true;
  send(ws, { type: 'ai_message', text }); // original text for chat display
  client.pendingAudio = (async () => {
    try {
      const tts = createTTSAdapter();
      const stream = tts.synthesizeStream(sanitizeForTTS(text)); // clean text for TTS
      send(ws, { type: 'audio_start' });
      await new Promise<void>((resolve) => {
        stream.on('data', (chunk: Buffer) => {
          if (chunk.length > 0 && ws.readyState === ws.OPEN) ws.send(chunk);
        });
        stream.on('end', () => {
          send(ws, { type: 'audio_end' });
          resolve();
        });
        stream.on('error', (err: Error) => {
          logger.error({ err }, '[Gateway] TTS stream error');
          send(ws, { type: 'audio_end' });
          resolve();
        });
      });
    } catch (err) {
      logger.error({ err }, '[Gateway] TTS synthesis error');
      send(ws, { type: 'audio_end' });
    } finally {
      client.pendingAudio = null;
      client.isTTSSpeaking = false;
    }
  })();
  await client.pendingAudio;
}

async function handleAudioInput(
  ws: WebSocket,
  client: WSClient,
  data: Buffer,
  clients: Map<WebSocket, WSClient>,
): Promise<void> {
  if (!client.sessionId || !client.userId) {
    sendError(ws, 'NOT_JOINED', 'Must join a session first');
    return;
  }

  // If live STT session exists, pipe audio to it
  if (client.liveSTT) {
    resetSilenceTimers(client, clients);
    client.liveSTT.sendAudio(data);
    return;
  }

  // Fallback: batch STT (original flow)
  resetSilenceTimers(client, clients);

  if (client.pendingAudio) await client.pendingAudio;

  let transcript: string;
  try {
    const stt = createSTTAdapter();
    const result = await stt.transcribe(data, { mimeType: 'audio/webm' });
    transcript = result.text.trim();
  } catch (err) {
    logger.error({ err }, '[Gateway] STT transcription error');
    sendError(ws, 'STT_ERROR', 'Failed to transcribe audio');
    return;
  }

  if (!transcript) {
    send(ws, { type: 'stt_empty' });
    return;
  }

  send(ws, { type: 'candidate_transcript', text: transcript });

  const audioResponseTimeMs = client.lastAiMessageAt
    ? Date.now() - client.lastAiMessageAt
    : null;

  await processAnswerAndRespond(ws, client, clients, transcript, audioResponseTimeMs);
}

async function processAnswerAndRespond(
  ws: WebSocket,
  client: WSClient,
  _clients: Map<WebSocket, WSClient>,
  answerText: string,
  responseTimeMs: number | null,
): Promise<void> {
  try {
    const result = await interviewService.processAnswer(
      client.sessionId!,
      client.userId,
      answerText,
      responseTimeMs,
    );

    send(ws, {
      type: 'transcript_update',
      entry: result.transcriptEntry,
    });

    if (result.stateChanged) {
      send(ws, {
        type: 'state_change',
        state: result.nextState,
      });
    }

    await sendAIMessageWithAudio(ws, client, result.aiMessage);

    if (result.isComplete) {
      if (result.nextState === 'SCORING') {
        send(ws, { type: 'interview_complete', sessionId: client.sessionId });
      }
      clearSilenceTimers(client);
    } else {
      // Don't restart timers here — wait for client's playback_complete event
      // so timers don't fire while the candidate is still listening to the AI
      clearSilenceTimers(client);
    }
  } catch (err) {
    if (err instanceof AppError) {
      sendError(ws, err.code, err.message);
    } else {
      logger.error({ err }, '[Gateway] processAnswer error');
      sendError(ws, 'INTERNAL_ERROR', 'Failed to process answer');
    }
  }
}

function setupLiveSTT(ws: WebSocket, client: WSClient, clients: Map<WebSocket, WSClient>): void {
  const stt = createSTTAdapter();
  if (!stt.createLiveSession) return;

  const liveSession = stt.createLiveSession();
  if (!liveSession) return;

  client.liveSTT = liveSession;

  liveSession.on('partial', (text: string) => {
    send(ws, { type: 'partial_transcript', text });
  });

  liveSession.on('final', (result: { text: string }) => {
    if (!result.text.trim()) return;
    client.accumulatedTranscript += (client.accumulatedTranscript ? ' ' : '') + result.text.trim();
  });

  liveSession.on('utterance_end', () => {
    client.isUserSpeaking = false;
    const fullTranscript = client.accumulatedTranscript.trim();
    if (!fullTranscript) return;

    client.accumulatedTranscript = '';
    send(ws, { type: 'candidate_transcript', text: fullTranscript });

    const responseTimeMs = client.lastAiMessageAt
      ? Date.now() - client.lastAiMessageAt
      : null;

    void processAnswerAndRespond(ws, client, clients, fullTranscript, responseTimeMs);
  });

  liveSession.on('speech_started', () => {
    client.isUserSpeaking = true;
    // Interruption handling: if AI is speaking and candidate starts talking
    if (client.isTTSSpeaking) {
      send(ws, { type: 'audio_stop' });
      client.isTTSSpeaking = false;
      // The pending audio promise will still resolve, but the client will stop playback
    }
    resetSilenceTimers(client, clients);
  });

  liveSession.on('error', (err: Error) => {
    logger.error({ err: err.message }, '[Gateway] Live STT error');
    // Fall back to batch mode by clearing the live session
    client.liveSTT = null;
  });

  liveSession.on('close', () => {
    client.liveSTT = null;
  });
}

export function setupInterviewGateway(wss: WebSocketServer): void {
  const clients = new Map<WebSocket, WSClient>();

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const client: WSClient = {
      ws,
      sessionId: null,
      userId: '',
      role: '',
      pendingAudio: null,
      lastAiMessageAt: null,
      liveSTT: null,
      isTTSSpeaking: false,
      isUserSpeaking: false,
      accumulatedTranscript: '',
    };
    clients.set(ws, client);

    ws.on('message', async (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        await handleAudioInput(ws, client, data, clients);
        return;
      }

      let event: ClientEvent;
      try {
        event = JSON.parse(data.toString()) as ClientEvent;
      } catch {
        sendError(ws, 'PARSE_ERROR', 'Invalid JSON');
        return;
      }

      await handleEvent(ws, client, event, clients);
    });

    ws.on('close', async () => {
      if (client.pingTimer) clearTimeout(client.pingTimer);
      clearSilenceTimers(client);
      client.liveSTT?.close();

      if (client.sessionId) {
        try {
          await interviewService.abandonSession(client.sessionId);
          broadcastToSession(clients, client.sessionId, client.ws, {
            type: 'session_abandoned',
            sessionId: client.sessionId,
          });
        } catch (err) {
          logger.error({ err }, '[Gateway] Error abandoning session on disconnect');
        }
      }

      clients.delete(ws);
    });

    ws.on('error', (err: Error) => {
      logger.error({ err: err.message }, '[Gateway] WebSocket error');
    });
  });
}

async function handleEvent(
  ws: WebSocket,
  client: WSClient,
  event: ClientEvent,
  clients: Map<WebSocket, WSClient>,
): Promise<void> {
  switch (event.type) {
    case 'join': {
      try {
        const payload = verifyAccessToken(event.token);
        client.userId = payload.userId;
        client.role = payload.role;
        client.sessionId = event.sessionId;

        const session = await interviewService.getSession(event.sessionId);
        if (session.candidateId.toString() !== payload.userId && payload.role !== 'recruiter') {
          sendError(ws, 'FORBIDDEN', 'Not authorized to join this session');
          return;
        }

        // Start session if not already started
        if (session.status === 'SCHEDULED' && payload.role === 'candidate') {
          await interviewService.startSession(event.sessionId, payload.userId);
        }

        send(ws, {
          type: 'joined',
          sessionId: event.sessionId,
          currentState: session.currentState,
          totalQuestions: session.generatedQuestions?.length ?? 0,
          currentQuestionIndex: session.currentQuestionIndex ?? 0,
        });

        // Set up live STT if supported
        setupLiveSTT(ws, client, clients);

        if (session.currentState === 'INTRO') {
          const introMessage = await interviewService.getIntroMessage(event.sessionId);
          await sendAIMessageWithAudio(ws, client, introMessage);
          // Don't start silence timers here — client's playback_complete will trigger them
        } else {
          // Non-INTRO rejoin (e.g. reconnect mid-interview): start timers as fallback
          startSilenceTimers(client, clients);
        }
      } catch (err) {
        if (err instanceof AppError) {
          sendError(ws, err.code, err.message);
        } else {
          sendError(ws, 'UNAUTHORIZED', 'Invalid token');
        }
      }
      break;
    }

    case 'answer': {
      if (!client.sessionId || !client.userId) {
        sendError(ws, 'NOT_JOINED', 'Must join a session first');
        return;
      }

      resetSilenceTimers(client, clients);

      if (client.pendingAudio) await client.pendingAudio;

      const responseTimeMs = client.lastAiMessageAt
        ? Date.now() - client.lastAiMessageAt
        : null;

      await processAnswerAndRespond(ws, client, clients, event.text, responseTimeMs);
      break;
    }

    case 'recording_start': {
      if (!client.sessionId) return;
      resetSilenceTimers(client, clients);
      break;
    }

    case 'playback_complete': {
      if (!client.sessionId) return;
      // Client finished playing AI audio — now start counting silence
      resetSilenceTimers(client, clients);
      break;
    }

    case 'anticheat': {
      if (!client.sessionId) return;
      try {
        await interviewService.recordAntiCheatEvent(client.sessionId, event.event);
      } catch (err) {
        logger.error({ err }, '[Gateway] anticheat recording error');
      }
      break;
    }

    case 'ping': {
      send(ws, { type: 'pong' });
      break;
    }

    default: {
      sendError(ws, 'UNKNOWN_EVENT', 'Unknown event type');
    }
  }
}

// --- Graduated silence detection ---

function startSilenceTimers(
  client: WSClient,
  _clients: Map<WebSocket, WSClient>,
): void {
  // Nudge after 90s of silence
  client.silenceNudgeTimer = setTimeout(async () => {
    // Skip if AI is still speaking or user is mid-answer; reschedule
    if (client.isTTSSpeaking || client.isUserSpeaking) {
      resetSilenceTimers(client, _clients);
      return;
    }
    await sendAIMessageWithAudio(client.ws, client, "Take your time, I'm here whenever you're ready.");
  }, SILENCE_NUDGE_MS);

  // Check after 3min
  client.silenceCheckTimer = setTimeout(async () => {
    if (client.isTTSSpeaking || client.isUserSpeaking) {
      resetSilenceTimers(client, _clients);
      return;
    }
    await sendAIMessageWithAudio(client.ws, client, "Are you still there? No rush at all.");
  }, SILENCE_CHECK_MS);

  // Abandon after 5min
  client.silenceAbandonTimer = setTimeout(async () => {
    if (client.isTTSSpeaking || client.isUserSpeaking) {
      resetSilenceTimers(client, _clients);
      return;
    }
    if (client.sessionId) {
      try {
        await interviewService.abandonSession(client.sessionId);
        send(client.ws, { type: 'state_change', state: 'ABANDONED' as InterviewState });
        send(client.ws, { type: 'session_abandoned', reason: 'timeout' });
      } catch (err) {
        logger.error({ err }, '[Gateway] Timeout abandon error');
      }
    }
  }, SILENCE_ABANDON_MS);
}

function resetSilenceTimers(
  client: WSClient,
  clients: Map<WebSocket, WSClient>,
): void {
  clearSilenceTimers(client);
  startSilenceTimers(client, clients);
}

function clearSilenceTimers(client: WSClient): void {
  if (client.silenceNudgeTimer) {
    clearTimeout(client.silenceNudgeTimer);
    client.silenceNudgeTimer = undefined;
  }
  if (client.silenceCheckTimer) {
    clearTimeout(client.silenceCheckTimer);
    client.silenceCheckTimer = undefined;
  }
  if (client.silenceAbandonTimer) {
    clearTimeout(client.silenceAbandonTimer);
    client.silenceAbandonTimer = undefined;
  }
}

function broadcastToSession(
  clients: Map<WebSocket, WSClient>,
  sessionId: string,
  excludeWs: WebSocket,
  event: object,
): void {
  for (const [ws, c] of clients) {
    if (c.sessionId === sessionId && ws !== excludeWs) {
      send(ws, event);
    }
  }
}
