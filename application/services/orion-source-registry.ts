import { randomBytes } from 'node:crypto';

export interface OrionSourceLocation {
  readonly vaultIndex: number;
  readonly relativePath: string;
}

/** Runtime-only map between opaque agent references and configured Vault locations. */
export class OrionSourceRegistry {
  private readonly locations = new Map<string, OrionSourceLocation>();

  register(vaultIndex: number, relativePath: string): string {
    let sourceRef: string;
    do {
      sourceRef = `orion:src_${randomBytes(18).toString('base64url')}`;
    } while (this.locations.has(sourceRef));

    this.locations.set(sourceRef, { vaultIndex, relativePath });
    return sourceRef;
  }

  resolve(sourceRef: string | undefined): OrionSourceLocation | undefined {
    return sourceRef ? this.locations.get(sourceRef) : undefined;
  }
}
