import type { Readable } from 'stream';
import type { ISTTAdapter, STTOptions, TranscriptionResult } from './stt.interface';

/**
 * Mock STT adapter — treats the buffer as raw UTF-8 text (text passthrough).
 * Used in Phases 1–4 where text interviews bypass real audio processing.
 */
export class MockSTTAdapter implements ISTTAdapter {
  async transcribe(audioBuffer: Buffer, _options?: STTOptions): Promise<TranscriptionResult> {
    const text = audioBuffer.toString('utf-8');
    console.log('[MockSTT] transcribe — text passthrough:', text.slice(0, 80));
    return {
      text,
      confidence: 1.0,
      durationMs: 0,
    };
  }

  async *transcribeStream(
    audioStream: Readable,
    _options?: STTOptions,
  ): AsyncIterable<TranscriptionResult> {
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const text = Buffer.concat(chunks).toString('utf-8');
    yield { text, confidence: 1.0, durationMs: 0 };
  }
}
