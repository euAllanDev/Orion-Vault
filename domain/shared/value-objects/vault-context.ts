import type { Note } from '../../notes/entities/note';
import type { Vault } from '../../organization/entities/vault';

export interface VaultContextProps {
  readonly vault: Vault;
  readonly notes: readonly Note[];
}

export class VaultContext {
  public readonly vault: Vault;
  public readonly notes: readonly Note[];

  constructor(props: VaultContextProps) {
    this.vault = props.vault;
    this.notes = Object.freeze([...props.notes]);
    Object.freeze(this);
  }
}
