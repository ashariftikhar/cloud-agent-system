/**
 * @file TelemetryLogger.ts
 * @description Enterprise-grade structured JSON observability logger with ISO timestamps and high-resolution performance timings.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
  context?: Record<string, unknown>;
  durationMs?: number;
}

export class TelemetryLogger {
  private static instance: TelemetryLogger;
  private namespace: string;
  private level: LogLevel;
  private timers: Map<string, number> = new Map();
  private buffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;
  private outputToConsole: boolean;

  private static levelWeights: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 99,
  };

  constructor(namespace: string = 'cloud-agent', level: LogLevel = 'info', outputToConsole: boolean = true) {
    this.namespace = namespace;
    this.level = level;
    this.outputToConsole = outputToConsole;
  }

  public static getInstance(namespace?: string): TelemetryLogger {
    if (!TelemetryLogger.instance) {
      TelemetryLogger.instance = new TelemetryLogger(namespace || 'cloud-agent');
    }
    return TelemetryLogger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public setOutputToConsole(enabled: boolean): void {
    this.outputToConsole = enabled;
  }

  public time(label: string): void {
    this.timers.set(label, Date.now());
  }

  public timeEnd(label: string, message?: string, context?: Record<string, unknown>): number {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.warn(`Timer '${label}' was ended without being started.`);
      return 0;
    }
    const durationMs = Date.now() - start;
    this.timers.delete(label);

    const logMsg = message || `Timer [${label}] completed in ${durationMs}ms`;
    this.log('info', logMsg, { ...context, timerLabel: label }, durationMs);
    return durationMs;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, durationMs?: number): void {
    if (TelemetryLogger.levelWeights[level] < TelemetryLogger.levelWeights[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      context,
      durationMs,
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    if (this.outputToConsole) {
      const serialized = JSON.stringify(entry);
      if (level === 'error') {
        console.error(serialized);
      } else if (level === 'warn') {
        console.warn(serialized);
      } else {
        console.log(serialized);
      }
    }
  }

  public getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  public clearBuffer(): void {
    this.buffer = [];
  }
}
