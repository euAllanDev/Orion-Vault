import { ValidationError } from '../../shared/errors/validation-error';

export class NotePath {
  public readonly value: string;

  constructor(value: string) {
    if (!value.trim()) {
      throw new ValidationError('Note path cannot be empty', 'NOTE_PATH_EMPTY');
    }

    this.value = value;
    Object.freeze(this);
  }

  toString(): string {
    return this.value;
  }
}
