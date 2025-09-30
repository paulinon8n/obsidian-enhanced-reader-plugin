export interface ILogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const ConsoleLogger: ILogger = {
  debug: (...args) => console.debug('[EnhancedReader]', ...args),
  info: (...args) => console.info('[EnhancedReader]', ...args),
  warn: (...args) => console.warn('[EnhancedReader]', ...args),
  error: (...args) => console.error('[EnhancedReader]', ...args),
};

export const NoopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createConsoleLogger(debugEnabled: boolean): ILogger {
  if (!debugEnabled) {
    // Only pass through warnings and errors when debug is off
    return {
      debug: () => {},
      info: () => {},
      warn: (...args) => ConsoleLogger.warn(...args),
      error: (...args) => ConsoleLogger.error(...args),
    };
  }
  return ConsoleLogger;
}
