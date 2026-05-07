export interface TelemetryPort {
  mark(event: string, attributes?: Record<string, unknown>): void;
}

export function createNoopTelemetry(): TelemetryPort {
  return {
    mark() {
      return undefined;
    }
  };
}
