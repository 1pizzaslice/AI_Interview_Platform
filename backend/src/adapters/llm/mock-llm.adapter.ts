import type { ILLMAdapter, LLMMessage, LLMOptions } from './llm.interface';

export class MockLLMAdapter implements ILLMAdapter {
  async complete(messages: LLMMessage[], _options?: LLMOptions): Promise<string> {
    const lastMessage = messages[messages.length - 1];
    console.log('[MockLLM] complete called with last message:', lastMessage?.content?.slice(0, 80));
    return `[MockLLM response to: "${lastMessage?.content?.slice(0, 50)}"]`;
  }

  async *stream(messages: LLMMessage[], _options?: LLMOptions): AsyncIterable<string> {
    const response = await this.complete(messages, _options);
    const words = response.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}
