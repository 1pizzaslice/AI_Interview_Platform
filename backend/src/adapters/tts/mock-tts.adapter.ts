import { Readable } from 'stream';
import type { ITTSAdapter, SynthesisOptions } from './tts.interface';

/**
 * Mock TTS adapter — logs text to console, returns empty buffer.
 * Used in Phases 1–4. Swap for ElevenLabs/other in Phase 5.
 */
export class MockTTSAdapter implements ITTSAdapter {
  async synthesize(text: string, _options?: SynthesisOptions): Promise<Buffer> {
    console.log('[MockTTS] synthesize:', text.slice(0, 100));
    return Buffer.alloc(0);
  }

  synthesizeStream(text: string, _options?: SynthesisOptions): Readable {
    console.log('[MockTTS] synthesizeStream:', text.slice(0, 100));
    const stream = new Readable({ read() {} });
    stream.push(null);
    return stream;
  }
}
