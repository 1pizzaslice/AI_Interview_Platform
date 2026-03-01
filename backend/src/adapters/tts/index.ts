import { config } from '../../config';
import type { ITTSAdapter } from './tts.interface';
import { MockTTSAdapter } from './mock-tts.adapter';

let instance: ITTSAdapter | null = null;

export function createTTSAdapter(): ITTSAdapter {
  if (instance) return instance;

  if (config.TTS_PROVIDER === 'elevenlabs') {
    // TODO Phase 5: import and return ElevenLabsTTSAdapter
    throw new Error('ElevenLabs TTS adapter not yet implemented');
  }

  instance = new MockTTSAdapter();
  return instance;
}

export type { ITTSAdapter, SynthesisOptions } from './tts.interface';
