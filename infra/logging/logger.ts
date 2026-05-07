import type { LoggerPort } from '../../application/ports/logger.port';

export function createConsoleLogger(minLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'): LoggerPort {
  const order: Record<'debug' | 'info' | 'warn' | 'error', number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
  };

  const shouldLog = (level: keyof typeof order): boolean => order[level] >= order[minLevel];

  return {
    debug(message, context) {
      if (shouldLog('debug')) console.debug(message, context ?? {});
    },
    info(message, context) {
      if (shouldLog('info')) console.info(message, context ?? {});
    },
    warn(message, context) {
      if (shouldLog('warn')) console.warn(message, context ?? {});
    },
    error(message, context, error) {
      if (shouldLog('error')) console.error(message, context ?? {}, error ?? '');
    }
  };
}
