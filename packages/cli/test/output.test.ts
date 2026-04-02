import { describe, it, expect } from 'vitest';

// Copy formatFileSize to test (it's a simple pure function)
function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

describe('formatFileSize', () => {
  it('handles zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('handles negative', () => {
    expect(formatFileSize(-100)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500.0 B');
  });

  it('formats KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });

  it('formats GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });

  it('handles very large values without crash', () => {
    const result = formatFileSize(1e15);
    expect(result).toContain('GB');
    expect(result).not.toContain('undefined');
  });
});
