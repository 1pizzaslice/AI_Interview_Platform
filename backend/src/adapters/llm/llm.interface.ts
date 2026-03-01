export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface ILLMAdapter {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  stream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<string>;
}
