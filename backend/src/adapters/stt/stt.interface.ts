import type { Readable } from 'stream';

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

export interface ISTTAdapter {
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<TranscriptionResult>;
  transcribeStream(audioStream: Readable, options?: STTOptions): AsyncIterable<TranscriptionResult>;
}
