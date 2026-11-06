import { describe, expect, it } from 'vitest';
import { linkDoDriveValido } from './link-drive';

describe('link do Drive', () => {
  it('aceita drive.google.com e docs.google.com', () => {
    expect(linkDoDriveValido('https://drive.google.com/file/d/abc/view')).toBe(true);
    expect(linkDoDriveValido('https://docs.google.com/document/d/abc/edit')).toBe(true);
    expect(linkDoDriveValido('  https://drive.google.com/file/d/abc/view  ')).toBe(true);
  });

  it('recusa outros endereços, mesmo parecidos', () => {
    expect(linkDoDriveValido('https://drive.google.com.exemplo.com/abc')).toBe(false);
    expect(linkDoDriveValido('https://exemplo.com/drive.google.com/abc')).toBe(false);
    expect(linkDoDriveValido('http://drive.google.com/abc')).toBe(false);
    expect(linkDoDriveValido('javascript:alert(1)')).toBe(false);
    expect(linkDoDriveValido('drive.google.com/abc')).toBe(false);
    expect(linkDoDriveValido('https://drive.google.com/com espaço')).toBe(false);
    expect(linkDoDriveValido('')).toBe(false);
  });
});
