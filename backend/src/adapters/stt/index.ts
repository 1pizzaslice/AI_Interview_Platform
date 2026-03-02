import { config } from '../../config';
import type { ISTTAdapter } from './stt.interface';
import { MockSTTAdapter } from './mock-stt.adapter';
import { DeepgramSTTAdapter } from './deepgram-stt.adapter';

let instance: ISTTAdapter | null = null;

export function createSTTAdapter(): ISTTAdapter {
  if (instance) return instance;

  if (config.STT_PROVIDER === 'deepgram') {
    instance = new DeepgramSTTAdapter(config.DEEPGRAM_API_KEY!);
    return instance;
  }

  instance = new MockSTTAdapter();
  return instance;
}

export type { ISTTAdapter, ILiveSTTSession, TranscriptionResult, STTOptions } from './stt.interface';
