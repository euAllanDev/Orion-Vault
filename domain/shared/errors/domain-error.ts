export class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
