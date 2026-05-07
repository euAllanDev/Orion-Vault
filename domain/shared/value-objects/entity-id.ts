import { ValidationError } from '../errors/validation-error';

export class EntityId {
  public readonly value: string;

  constructor(value: string) {
    if (!value.trim()) {
      throw new ValidationError('Entity id cannot be empty', 'ENTITY_ID_EMPTY');
    }

    this.value = value;
    Object.freeze(this);
  }

  toString(): string {
    return this.value;
  }
}
