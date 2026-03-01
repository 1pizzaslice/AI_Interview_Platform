import type { Readable } from 'stream';

export interface SynthesisOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface ITTSAdapter {
  synthesize(text: string, options?: SynthesisOptions): Promise<Buffer>;
  synthesizeStream(text: string, options?: SynthesisOptions): Readable;
}
