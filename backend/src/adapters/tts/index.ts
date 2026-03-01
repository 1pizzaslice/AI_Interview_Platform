import { config } from '../../config';
import type { ITTSAdapter } from './tts.interface';
import { MockTTSAdapter } from './mock-tts.adapter';
import { DeepgramTTSAdapter } from './deepgram-tts.adapter';

let instance: ITTSAdapter | null = null;

export function createTTSAdapter(): ITTSAdapter {
  if (instance) return instance;

  if (config.TTS_PROVIDER === 'deepgram') {
    instance = new DeepgramTTSAdapter(config.DEEPGRAM_API_KEY!);
    return instance;
  }

  if (config.TTS_PROVIDER === 'elevenlabs') {
    throw new Error('ElevenLabs TTS adapter not yet implemented');
  }

  instance = new MockTTSAdapter();
  return instance;
}

export type { ITTSAdapter, SynthesisOptions } from './tts.interface';
