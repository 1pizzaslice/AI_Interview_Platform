import { describe, it, expect } from 'vitest';
import { sanitizeForTTS } from '../utils';

describe('sanitizeForTTS', () => {
  it('strips bold markdown', () => {
    expect(sanitizeForTTS('This is **bold** text')).toBe('This is bold text');
  });

  it('strips italic markdown', () => {
    expect(sanitizeForTTS('This is *italic* text')).toBe('This is italic text');
  });

  it('strips inline code', () => {
    expect(sanitizeForTTS('Use `npm install` to install')).toBe('Use npm install to install');
  });

  it('strips code blocks', () => {
    expect(sanitizeForTTS('Before\n```js\nconst x = 1;\n```\nAfter')).toBe('Before\n\nAfter');
  });

  it('strips headings', () => {
    expect(sanitizeForTTS('## Section Title\nContent')).toBe('Section Title\nContent');
  });

  it('strips list markers', () => {
    expect(sanitizeForTTS('- item 1\n- item 2')).toBe('item 1\nitem 2');
  });

  it('strips links, keeps text', () => {
    expect(sanitizeForTTS('[Click here](https://example.com)')).toBe('Click here');
  });

  it('collapses multiple blank lines', () => {
    expect(sanitizeForTTS('A\n\n\n\nB')).toBe('A\n\nB');
  });

  it('handles plain text without changes', () => {
    expect(sanitizeForTTS('Just normal text')).toBe('Just normal text');
  });
});
