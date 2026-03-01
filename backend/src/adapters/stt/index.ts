import { config } from '../../config';
import type { ISTTAdapter } from './stt.interface';
import { MockSTTAdapter } from './mock-stt.adapter';

let instance: ISTTAdapter | null = null;

export function createSTTAdapter(): ISTTAdapter {
  if (instance) return instance;

  if (config.STT_PROVIDER === 'deepgram') {
    // TODO Phase 5: import and return DeepgramSTTAdapter
    throw new Error('Deepgram STT adapter not yet implemented');
  }

  instance = new MockSTTAdapter();
  return instance;
}

export type { ISTTAdapter, TranscriptionResult, STTOptions } from './stt.interface';
