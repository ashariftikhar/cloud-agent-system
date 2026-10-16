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
export declare class TelemetryLogger {
    private static instance;
    private namespace;
    private level;
    private timers;
    private buffer;
    private maxBufferSize;
    private outputToConsole;
    private static levelWeights;
    constructor(namespace?: string, level?: LogLevel, outputToConsole?: boolean);
    static getInstance(namespace?: string): TelemetryLogger;
    setLevel(level: LogLevel): void;
    setOutputToConsole(enabled: boolean): void;
    time(label: string): void;
    timeEnd(label: string, message?: string, context?: Record<string, unknown>): number;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
    private log;
    getBuffer(): LogEntry[];
    clearBuffer(): void;
}
//# sourceMappingURL=TelemetryLogger.d.ts.map