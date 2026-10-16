/**
 * @file TelemetryLogger.ts
 * @description Enterprise-grade structured JSON observability logger with ISO timestamps and high-resolution performance timings.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */
export class TelemetryLogger {
    static instance;
    namespace;
    level;
    timers = new Map();
    buffer = [];
    maxBufferSize = 1000;
    outputToConsole;
    static levelWeights = {
        debug: 10,
        info: 20,
        warn: 30,
        error: 40,
        silent: 99,
    };
    constructor(namespace = 'cloud-agent', level = 'info', outputToConsole = true) {
        this.namespace = namespace;
        this.level = level;
        this.outputToConsole = outputToConsole;
    }
    static getInstance(namespace) {
        if (!TelemetryLogger.instance) {
            TelemetryLogger.instance = new TelemetryLogger(namespace || 'cloud-agent');
        }
        return TelemetryLogger.instance;
    }
    setLevel(level) {
        this.level = level;
    }
    setOutputToConsole(enabled) {
        this.outputToConsole = enabled;
    }
    time(label) {
        this.timers.set(label, Date.now());
    }
    timeEnd(label, message, context) {
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
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    error(message, context) {
        this.log('error', message, context);
    }
    log(level, message, context, durationMs) {
        if (TelemetryLogger.levelWeights[level] < TelemetryLogger.levelWeights[this.level]) {
            return;
        }
        const entry = {
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
            }
            else if (level === 'warn') {
                console.warn(serialized);
            }
            else {
                console.log(serialized);
            }
        }
    }
    getBuffer() {
        return [...this.buffer];
    }
    clearBuffer() {
        this.buffer = [];
    }
}
//# sourceMappingURL=TelemetryLogger.js.map