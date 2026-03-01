import { createClient } from '@deepgram/sdk';
import type { DeepgramClient } from '@deepgram/sdk';
import { Readable } from 'stream';
import type { ITTSAdapter, SynthesisOptions } from './tts.interface';

// Deepgram Aura voice models — pass a Deepgram voice ID directly or use these shorthands
const VOICE_MAP: Record<string, string> = {
  female: 'aura-asteria-en',
  male: 'aura-orion-en',
};
const DEFAULT_VOICE = 'aura-asteria-en';

export class DeepgramTTSAdapter implements ITTSAdapter {
  private readonly client: DeepgramClient;

  constructor(apiKey: string) {
    this.client = createClient(apiKey);
  }

  private resolveVoice(voice?: string): string {
    if (!voice) return DEFAULT_VOICE;
    return VOICE_MAP[voice] ?? voice; // allow callers to pass Deepgram voice IDs directly
  }

  async synthesize(text: string, options?: SynthesisOptions): Promise<Buffer> {
    const response = await this.client.speak.request(
      { text },
      { model: this.resolveVoice(options?.voice) },
    );

    const stream = await response.getStream();
    if (!stream) throw new Error('[DeepgramTTS] No audio stream returned');

    const chunks: Buffer[] = [];
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  synthesizeStream(text: string, options?: SynthesisOptions): Readable {
    const readable = new Readable({ read() {} });

    this.synthesize(text, options)
      .then((buffer) => {
        readable.push(buffer);
        readable.push(null);
      })
      .catch((err: Error) => {
        readable.destroy(err);
      });

    return readable;
  }
}
