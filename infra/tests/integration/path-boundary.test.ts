import { describe, expect, it } from 'vitest';
import { isInsideRoot, resolveWithinRoot } from '../../filesystem/path-resolution/path-boundary';

describe('path boundary', () => {
  it('accepts paths inside the root', () => {
    expect(isInsideRoot('/vault', '/vault/notes/a.md')).toBe(true);
  });

  it('rejects paths outside the root', () => {
    expect(isInsideRoot('/vault', '/other/a.md')).toBe(false);
  });

  it.each(['../escape', '..\\escape'])('rejects traversal path %s before resolution', (candidatePath) => {
    expect(() => resolveWithinRoot('/vault', candidatePath)).toThrowError(`Path escapes vault boundary: ${candidatePath}`);
  });
});
