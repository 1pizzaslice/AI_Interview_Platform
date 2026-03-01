import { config } from '../../config';
import type { ILLMAdapter } from './llm.interface';
import { ClaudeAdapter } from './claude.adapter';
import { MockLLMAdapter } from './mock-llm.adapter';

let instance: ILLMAdapter | null = null;

export function createLLMAdapter(): ILLMAdapter {
  if (instance) return instance;

  if (config.LLM_PROVIDER === 'claude') {
    instance = new ClaudeAdapter(config.ANTHROPIC_API_KEY!);
  } else {
    instance = new MockLLMAdapter();
  }

  return instance;
}

export type { ILLMAdapter, LLMMessage, LLMOptions } from './llm.interface';
