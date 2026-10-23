import { describe, expect, it } from 'vitest';
import { publicTagPath } from './index';

describe('publicTagPath (D51)', () => {
  it('сторінка тегу — /{мова}/news/tag/{slug}: адреса вже в посиланнях, її формат не змінюється', () => {
    expect(publicTagPath('uk', 'transfer-window')).toBe('/uk/news/tag/transfer-window');
    expect(publicTagPath('en', 'var')).toBe('/en/news/tag/var');
  });
});
