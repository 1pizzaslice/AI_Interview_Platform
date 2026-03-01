import type { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { verifyAccessToken } from '../../shared/utils';
import { AppError } from '../../shared/errors/app-error';
import type { InterviewState, AntiCheatEvent } from '../../shared/types';
import * as interviewService from './interview.service';
import { config } from '../../config';
import { createSTTAdapter } from '../../adapters/stt';
import { createTTSAdapter } from '../../adapters/tts';

interface WSClient {
  ws: WebSocket;
  sessionId: string | null;
  userId: string;
  role: string;
  pingTimer?: ReturnType<typeof setTimeout>;
  answerTimer?: ReturnType<typeof setTimeout>;
  pendingAudio: Promise<void> | null;
}

type ClientEvent =
  | { type: 'join'; sessionId: string; token: string }
  | { type: 'answer'; sessionId: string; text: string }
  | { type: 'anticheat'; sessionId: string; event: AntiCheatEvent }
  | { type: 'recording_start'; sessionId: string }
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
  send(ws, { type: 'ai_message', text });
  client.pendingAudio = (async () => {
    try {
      const tts = createTTSAdapter();
      const stream = tts.synthesizeStream(text);
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
          console.error('[Gateway] TTS stream error:', err);
          send(ws, { type: 'audio_end' });
          resolve();
        });
      });
    } catch (err) {
      console.error('[Gateway] TTS synthesis error:', err);
      send(ws, { type: 'audio_end' });
    } finally {
      client.pendingAudio = null;
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

  resetAnswerTimeout(client, clients, config.ANSWER_TIMEOUT_SECONDS * 1000);

  if (client.pendingAudio) await client.pendingAudio;

  let transcript: string;
  try {
    const stt = createSTTAdapter();
    const result = await stt.transcribe(data, { mimeType: 'audio/webm' });
    transcript = result.text.trim();
  } catch (err) {
    console.error('[Gateway] STT transcription error:', err);
    sendError(ws, 'STT_ERROR', 'Failed to transcribe audio');
    return;
  }

  if (!transcript) {
    send(ws, { type: 'stt_empty' });
    return;
  }

  send(ws, { type: 'candidate_transcript', text: transcript });

  try {
    const result = await interviewService.processAnswer(
      client.sessionId,
      client.userId,
      transcript,
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
      clearAnswerTimeout(client);
    }
  } catch (err) {
    if (err instanceof AppError) {
      sendError(ws, err.code, err.message);
    } else {
      console.error('[Gateway] processAnswer error (audio):', err);
      sendError(ws, 'INTERNAL_ERROR', 'Failed to process answer');
    }
  }
}

export function setupInterviewGateway(wss: WebSocketServer): void {
  const clients = new Map<WebSocket, WSClient>();

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const client: WSClient = { ws, sessionId: null, userId: '', role: '', pendingAudio: null };
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
      if (client.answerTimer) clearTimeout(client.answerTimer);

      if (client.sessionId) {
        try {
          await interviewService.abandonSession(client.sessionId);
          broadcastToSession(clients, client.sessionId, client.ws, {
            type: 'session_abandoned',
            sessionId: client.sessionId,
          });
        } catch (err) {
          console.error('[Gateway] Error abandoning session on disconnect:', err);
        }
      }

      clients.delete(ws);
    });

    ws.on('error', (err: Error) => {
      console.error('[Gateway] WebSocket error:', err.message);
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
        });

        if (session.currentState === 'INTRO') {
          const introMessage = await interviewService.getIntroMessage();
          await sendAIMessageWithAudio(ws, client, introMessage);
        }

        startAnswerTimeout(client, clients, config.ANSWER_TIMEOUT_SECONDS * 1000);
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

      resetAnswerTimeout(client, clients, config.ANSWER_TIMEOUT_SECONDS * 1000);

      if (client.pendingAudio) await client.pendingAudio;

      try {
        const result = await interviewService.processAnswer(
          client.sessionId,
          client.userId,
          event.text,
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
          clearAnswerTimeout(client);
        }
      } catch (err) {
        if (err instanceof AppError) {
          sendError(ws, err.code, err.message);
        } else {
          console.error('[Gateway] processAnswer error:', err);
          sendError(ws, 'INTERNAL_ERROR', 'Failed to process answer');
        }
      }
      break;
    }

    case 'recording_start': {
      if (!client.sessionId) return;
      resetAnswerTimeout(client, clients, config.ANSWER_TIMEOUT_SECONDS * 1000);
      break;
    }

    case 'anticheat': {
      if (!client.sessionId) return;
      try {
        await interviewService.recordAntiCheatEvent(client.sessionId, event.event);
      } catch (err) {
        console.error('[Gateway] anticheat recording error:', err);
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

function startAnswerTimeout(
  client: WSClient,
  clients: Map<WebSocket, WSClient>,
  timeoutMs: number,
): void {
  client.answerTimer = setTimeout(async () => {
    await sendAIMessageWithAudio(client.ws, client, "Are you still there? Take your time.");

    client.answerTimer = setTimeout(async () => {
      if (client.sessionId) {
        try {
          await interviewService.abandonSession(client.sessionId);
          send(client.ws, { type: 'state_change', state: 'ABANDONED' as InterviewState });
          send(client.ws, { type: 'session_abandoned', reason: 'timeout' });
        } catch (err) {
          console.error('[Gateway] Timeout abandon error:', err);
        }
      }
    }, config.ANSWER_FOLLOWUP_TIMEOUT_SECONDS * 1000);
  }, timeoutMs);
}

function resetAnswerTimeout(
  client: WSClient,
  clients: Map<WebSocket, WSClient>,
  timeoutMs: number,
): void {
  clearAnswerTimeout(client);
  startAnswerTimeout(client, clients, timeoutMs);
}

function clearAnswerTimeout(client: WSClient): void {
  if (client.answerTimer) {
    clearTimeout(client.answerTimer);
    client.answerTimer = undefined;
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
