import { describe, expect, it } from 'vitest';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('User Search Regex Escaping', () => {
  it('escapes all regex metacharacters properly', () => {
    const metaChars = '.*+?^${}()|[\\]\\';
    const escaped = escapeRegex(metaChars);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\\\\\]\\\\');

    const reg = new RegExp(escaped, 'i');
    expect(reg.test(metaChars)).toBe(true);
    expect(reg.test('plain-text')).toBe(false);
  });

  it('treats user input as literal text during regex construction', () => {
    const userSearch = 'admin(test)[1]+*?';
    const escaped = escapeRegex(userSearch);
    const reg = new RegExp(`^${escaped}$`, 'i');

    expect(reg.test('admin(test)[1]+*?')).toBe(true);
    expect(reg.test('admin1')).toBe(false);
  });
});
