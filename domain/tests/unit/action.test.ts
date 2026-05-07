import { describe, expect, it } from 'vitest';
import { OrganizationAction } from '../../organization/entities/action';

describe('OrganizationAction', () => {
  it('creates a move-note action', () => {
    const action = OrganizationAction.moveNote({
      id: 'action-1',
      sourcePath: 'inbox/note.md',
      destinationPath: 'topics/note.md'
    });

    expect(action.kind).toBe('move-note');
    expect(action.sourcePath).toBe('inbox/note.md');
    expect(action.destinationPath).toBe('topics/note.md');
  });
});
