import { describe, expect, it } from 'vitest';
import { isInsideRoot } from '../../filesystem/path-resolution/path-boundary';

describe('path boundary', () => {
  it('accepts paths inside the root', () => {
    expect(isInsideRoot('/vault', '/vault/notes/a.md')).toBe(true);
  });

  it('rejects paths outside the root', () => {
    expect(isInsideRoot('/vault', '/other/a.md')).toBe(false);
  });
});
