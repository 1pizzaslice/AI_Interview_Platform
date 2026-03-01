import { createClient } from '@deepgram/sdk';
import type { DeepgramClient } from '@deepgram/sdk';
import type { Readable } from 'stream';
import type { ISTTAdapter, STTOptions, TranscriptionResult } from './stt.interface';

export class DeepgramSTTAdapter implements ISTTAdapter {
  private readonly client: DeepgramClient;

  constructor(apiKey: string) {
    this.client = createClient(apiKey);
  }

  async transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<TranscriptionResult> {
    const { result, error } = await this.client.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
        language: options?.language ?? 'en',
        ...(options?.mimeType ? { mimetype: options.mimeType } : {}),
      },
    );

    if (error) throw error;

    const channel = result.results.channels[0];
    const alt = channel.alternatives[0];

    const words = alt.words?.map((w) => ({
      word: w.word,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
    }));

    return {
      text: alt.transcript,
      confidence: alt.confidence,
      durationMs: Math.round((result.metadata?.duration ?? 0) * 1000),
      words,
    };
  }

  async *transcribeStream(
    audioStream: Readable,
    options?: STTOptions,
  ): AsyncIterable<TranscriptionResult> {
    // Collect the full stream then submit to the prerecorded API.
    // Deepgram live transcription requires a persistent WebSocket connection
    // which is better managed at the gateway layer; this covers the batch case.
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const buffer = Buffer.concat(chunks);
    const result = await this.transcribe(buffer, options);
    yield result;
  }
}
