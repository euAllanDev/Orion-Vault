import { describe, expect, it } from 'vitest';
import { OrganizationPlanService } from '../../services/organization-plan.service';

describe('OrganizationPlanService', () => {
  it('normalizes valid ai responses into actions', () => {
    const service = new OrganizationPlanService();

    const actions = service.validate({
      provider: 'noop',
      actions: [
        {
          kind: 'move-note',
          id: 'action-1',
          sourcePath: 'inbox/note.md',
          destinationPath: 'organized/note.md'
        }
      ]
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe('move-note');
  });

  it('rejects malformed ai responses', () => {
    const service = new OrganizationPlanService();

    expect(() =>
      service.validate({
        provider: 'noop',
        actions: [
          {
            kind: 'move-note',
            id: 'action-1',
            sourcePath: '',
            destinationPath: ''
          }
        ] as never
      })
    ).toThrow();
  });
});
