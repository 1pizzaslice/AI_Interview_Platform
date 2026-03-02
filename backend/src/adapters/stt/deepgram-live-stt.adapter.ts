import { EventEmitter } from 'events';
import { LiveTranscriptionEvents } from '@deepgram/sdk';
import type { DeepgramClient, ListenLiveClient } from '@deepgram/sdk';
import type { ILiveSTTSession, STTOptions, TranscriptionResult } from './stt.interface';

export class DeepgramLiveSTTSession extends EventEmitter implements ILiveSTTSession {
  private connection: ListenLiveClient;
  private closed = false;

  constructor(client: DeepgramClient, options?: STTOptions) {
    super();

    this.connection = client.listen.live({
      model: 'nova-2',
      language: options?.language ?? 'en',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1500,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: 16000,
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      // Session is ready to receive audio
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data: DeepgramTranscriptEvent) => {
      if (this.closed) return;

      const alt = data.channel?.alternatives?.[0];
      if (!alt || !alt.transcript) return;

      if (data.is_final) {
        const result: TranscriptionResult = {
          text: alt.transcript,
          confidence: alt.confidence ?? 0.9,
          durationMs: Math.round((data.duration ?? 0) * 1000),
          words: alt.words?.map((w: DeepgramWord) => ({
            word: w.word,
            startMs: Math.round(w.start * 1000),
            endMs: Math.round(w.end * 1000),
          })),
        };
        this.emit('final', result);
      } else {
        this.emit('partial', alt.transcript);
      }
    });

    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (!this.closed) this.emit('utterance_end');
    });

    this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
      if (!this.closed) this.emit('speech_started');
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err: Error) => {
      if (!this.closed) this.emit('error', err);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      this.closed = true;
      this.emit('close');
    });
  }

  sendAudio(chunk: Buffer): void {
    if (this.closed) return;
    // Cast to satisfy Deepgram's SocketDataLike — Buffer is compatible at runtime
    this.connection.send(chunk as unknown as ArrayBuffer);
  }

  finishUtterance(): void {
    if (this.closed) return;
    // Send a FinishStream message to get the final transcript for the current utterance
    this.connection.requestClose();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.connection.requestClose();
  }
}

// Deepgram SDK types for transcript events (simplified)
interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface DeepgramTranscriptEvent {
  is_final: boolean;
  duration?: number;
  channel?: {
    alternatives?: Array<{
      transcript: string;
      confidence?: number;
      words?: DeepgramWord[];
    }>;
  };
}
