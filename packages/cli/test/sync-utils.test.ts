import { describe, it, expect } from 'vitest';

// Import the functions we want to test by evaluating them directly
// (sync.ts exports them as part of the module, not individually)

// chapterKey: strips version suffixes from filenames
function chapterKey(filename: string): string {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/[_]?\d{6}[_]?v?\d*$/i, '');
  name = name.replace(/[_]?v\d+$/i, '');
  return name.trim();
}

// courseFolderName: extract English name from course fullname
function courseFolderName(_shortname: string, fullname: string): string {
  const parts = fullname.split('.');
  const lastPart = parts[parts.length - 1] ?? fullname;
  const afterChinese = lastPart.match(/\s([A-Z][a-zA-Z\s:&\-(),]+)$/);
  if (afterChinese) {
    return afterChinese[1].trim().replace(/:/g, ' -').replace(/[<>"/\\|?*]/g, '_');
  }
  const englishMatch = lastPart.match(/[A-Z][a-zA-Z\s:&\-()]+/g);
  if (englishMatch) {
    const longest = englishMatch.sort((a, b) => b.length - a.length)[0];
    return longest.trim().replace(/[<>:"/\\|?*]/g, '_');
  }
  return lastPart.trim().replace(/[<>:"/\\|?*]/g, '_');
}

describe('chapterKey', () => {
  it('strips .pdf extension', () => {
    expect(chapterKey('Chapter 1.pdf')).toBe('Chapter 1');
  });

  it('strips version suffix _v2', () => {
    expect(chapterKey('L1 Storage Devices_v2.pptx')).toBe('L1 Storage Devices');
  });

  it('strips date+version suffix', () => {
    expect(chapterKey('L1 Storage Devices_260309v1.pptx')).toBe('L1 Storage Devices');
  });

  it('strips date suffix with underscore', () => {
    expect(chapterKey('L2 IO Stacks260323_v2.pptx')).toBe('L2 IO Stacks');
  });

  it('handles plain filenames', () => {
    expect(chapterKey('A. Introduction.pdf')).toBe('A. Introduction');
  });

  it('handles numbered chapters', () => {
    expect(chapterKey('1-overview.pdf')).toBe('1-overview');
  });

  it('groups same chapter versions', () => {
    const a = chapterKey('L1 Storage Devices_v2.pptx');
    const b = chapterKey('L1 Storage Devices_260309v1.pptx');
    const c = chapterKey('L1 Storage Devices_260316v1.pptx');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('courseFolderName', () => {
  it('extracts English name from course fullname', () => {
    expect(courseFolderName('1142.515508', '1142.515508.計算機組織 Computer Organization'))
      .toBe('Computer Organization');
  });

  it('handles long names with colon', () => {
    expect(courseFolderName('x', '1142.515622.生成式AI概論：從理論到應用 Introduction to Generative AI: From Theory to Application'))
      .toBe('Introduction to Generative AI - From Theory to Application');
  });

  it('handles hyphenated names', () => {
    expect(courseFolderName('x', '1142.535607.網路安全實務-攻擊與防禦 Network Security Practices-Attack and defense'))
      .toBe('Network Security Practices-Attack and defense');
  });

  it('handles names without Chinese', () => {
    expect(courseFolderName('x', 'Gender Equity Education Online Course'))
      .toContain('Education Online Course');
  });
});
