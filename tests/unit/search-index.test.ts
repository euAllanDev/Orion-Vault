import { describe, expect, it } from 'vitest';
import { buildSearchMatches } from '../../interfaces/cli/commands/search';

describe('buildSearchMatches', () => {
  it('supports exact phrase and tag filters', () => {
    const matches = buildSearchMatches(
      [
        {
          id: '1',
          relativePath: 'notes/alpha.md',
          absolutePath: '/vault/notes/alpha.md',
          content: '# Alpha\n\nProject details.',
          title: 'Project Alpha',
          tags: ['project', 'alpha']
        },
        {
          id: '2',
          relativePath: 'notes/brief.md',
          absolutePath: '/vault/notes/brief.md',
          content: '# Brief\n\nMentions alpha in body.',
          title: 'Brief note',
          tags: []
        }
      ],
      {
        query: 'project alpha',
        phrase: 'Project Alpha',
        tags: ['project']
      }
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].path).toBe('notes/alpha.md');
    expect(matches[0].matchedFields).toContain('title');
    expect(matches[0].matchedFields).toContain('tags');
    expect(matches[0].snippet).toContain('[[Project Alpha]]');
  });

  it('filters notes by required tags', () => {
    const matches = buildSearchMatches(
      [
        {
          id: '1',
          relativePath: 'notes/alpha.md',
          absolutePath: '/vault/notes/alpha.md',
          content: '# Alpha\n\nProject details.',
          title: 'Project Alpha',
          tags: ['project', 'alpha']
        },
        {
          id: '2',
          relativePath: 'notes/beta.md',
          absolutePath: '/vault/notes/beta.md',
          content: '# Beta\n\nProject details.',
          title: 'Project Beta',
          tags: ['beta']
        }
      ],
      {
        tags: ['alpha']
      }
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].path).toBe('notes/alpha.md');
  });
});
