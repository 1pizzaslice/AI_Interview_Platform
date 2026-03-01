import type { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { verifyAccessToken } from '../../shared/utils';
import { AppError } from '../../shared/errors/app-error';
import type { InterviewState, AntiCheatEvent } from '../../shared/types';
import * as interviewService from './interview.service';
import { config } from '../../config';

interface WSClient {
  ws: WebSocket;
  sessionId: string | null;
  userId: string;
  role: string;
  pingTimer?: ReturnType<typeof setTimeout>;
  answerTimer?: ReturnType<typeof setTimeout>;
}

type ClientEvent =
  | { type: 'join'; sessionId: string; token: string }
  | { type: 'answer'; sessionId: string; text: string }
  | { type: 'anticheat'; sessionId: string; event: AntiCheatEvent }
  | { type: 'ping' };

function send(ws: WebSocket, event: object): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  send(ws, { type: 'error', code, message });
}

export function setupInterviewGateway(wss: WebSocketServer): void {
  const clients = new Map<WebSocket, WSClient>();

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const client: WSClient = { ws, sessionId: null, userId: '', role: '' };
    clients.set(ws, client);

    ws.on('message', async (data: Buffer) => {
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
          send(ws, { type: 'ai_message', text: introMessage });
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

        send(ws, { type: 'ai_message', text: result.aiMessage });

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
    send(client.ws, { type: 'ai_message', text: "Are you still there? Take your time." });

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
