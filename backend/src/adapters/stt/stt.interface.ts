import type { Readable } from 'stream';
import { EventEmitter } from 'events';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  durationMs: number;
  words?: Array<{ word: string; startMs: number; endMs: number }>;
}

export interface STTOptions {
  language?: string;
  mimeType?: string;
}

export interface ILiveSTTSession extends EventEmitter {
  /** Send an audio chunk to the live session */
  sendAudio(chunk: Buffer): void;
  /** Signal that no more audio will be sent for this utterance */
  finishUtterance(): void;
  /** Close the live session and clean up */
  close(): void;
}

/**
 * Events emitted by ILiveSTTSession:
 * - 'partial'   (text: string)                    Interim/partial transcript
 * - 'final'     (result: TranscriptionResult)     Final transcript for an utterance
 * - 'utterance_end' ()                            Silence detected — utterance boundary
 * - 'speech_started' ()                           Speech detected after silence
 * - 'error'     (err: Error)                      Error in the live session
 * - 'close'     ()                                Session closed
 */

export interface ISTTAdapter {
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<TranscriptionResult>;
  transcribeStream(audioStream: Readable, options?: STTOptions): AsyncIterable<TranscriptionResult>;
  /** Create a persistent live STT session (e.g., Deepgram WebSocket). Returns null if not supported. */
  createLiveSession?(options?: STTOptions): ILiveSTTSession | null;
}
