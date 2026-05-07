import { DomainError } from './domain-error';

export class ValidationError extends DomainError {
  constructor(message: string, code = 'VALIDATION_ERROR', cause?: unknown) {
    super(message, code, cause);
    this.name = 'ValidationError';
  }
}
