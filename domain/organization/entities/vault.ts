import { ValidationError } from '../../shared/errors/validation-error';

export interface VaultProps {
  readonly rootPath: string;
  readonly name?: string;
}

export class Vault {
  public readonly rootPath: string;
  public readonly name?: string;

  constructor(props: VaultProps) {
    if (!props.rootPath.trim()) {
      throw new ValidationError('Vault root path cannot be empty', 'VAULT_ROOT_EMPTY');
    }

    this.rootPath = props.rootPath;
    this.name = props.name?.trim() || undefined;
    Object.freeze(this);
  }
}
