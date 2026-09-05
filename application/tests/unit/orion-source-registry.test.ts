import { describe, expect, it } from 'vitest';
import { OrionSourceRegistry } from '../../services/orion-source-registry';

describe('OrionSourceRegistry', () => {
  it('creates opaque, distinct runtime source references', () => {
    const registry = new OrionSourceRegistry();
    const first = registry.register(0, 'projects/orion/architecture.md');
    const second = registry.register(1, 'projects/orion/architecture.md');

    expect(first).toMatch(/^orion:src_[A-Za-z0-9_-]+$/);
    expect(second).toMatch(/^orion:src_[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('projects');
  });

  it('resolves only registered references', () => {
    const registry = new OrionSourceRegistry();
    const sourceRef = registry.register(1, 'projects/orion/architecture.md');

    expect(registry.resolve(sourceRef)).toEqual({ vaultIndex: 1, relativePath: 'projects/orion/architecture.md' });
    expect(registry.resolve('orion:src_missing')).toBeUndefined();
  });
});
