type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = __DEV__ ? 'debug' : 'info';

/**
 * Structured logging with a single choke point, so shipping logs to a crash
 * reporter later means editing `emit` and nothing else.
 *
 * Events are dotted names (`sync.upload.failed`) rather than sentences, because
 * the thing you actually do with field logs is group and count them.
 */
function emit(level: Level, event: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const payload = context ? `${event} ${JSON.stringify(context)}` : event;
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.log(payload);
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => emit('debug', event, context),
  info: (event: string, context?: Record<string, unknown>) => emit('info', event, context),
  warn: (event: string, context?: Record<string, unknown>) => emit('warn', event, context),
  error: (event: string, context?: Record<string, unknown>) => emit('error', event, context),
};
