/**
 * @file TaskScheduler.ts
 * @description Enterprise-grade priority task scheduler with cron/interval execution and exponential backoff retry semantics.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */
import { Task, TaskPriority, TaskExecutionResult } from '../types/index.js';
export interface SchedulerOptions {
    pollingIntervalMs?: number;
    concurrency?: number;
    defaultMaxRetries?: number;
    defaultInitialDelayMs?: number;
    defaultBackoffFactor?: number;
}
export declare class TaskScheduler {
    private queue;
    private isRunning;
    private timer;
    private activeExecutions;
    private logger;
    private options;
    constructor(options?: SchedulerOptions);
    /**
     * Enqueues a task with priority ordering (Urgent > High > Normal > Low).
     */
    enqueue<TPayload, TResult>(taskInput: {
        id?: string;
        title: string;
        description?: string;
        priority?: TaskPriority;
        payload: TPayload;
        handler: (payload: TPayload) => Promise<TResult>;
        maxRetries?: number;
        initialDelayMs?: number;
        backoffFactor?: number;
        delayMs?: number;
    }): Task<TPayload, TResult>;
    /**
     * Registers a recurring interval task.
     */
    scheduleInterval<TPayload, TResult>(intervalMs: number, taskInput: {
        id?: string;
        title: string;
        priority?: TaskPriority;
        payload: TPayload;
        handler: (payload: TPayload) => Promise<TResult>;
    }): Task<TPayload, TResult>;
    private insertIntoQueue;
    private sortQueue;
    /**
     * Executes a single ready task from the queue.
     */
    processNext(): Promise<TaskExecutionResult | null>;
    /**
     * Processes all currently pending and ready tasks sequentially until queue is drained or blocked on timers.
     */
    processAllPending(): Promise<TaskExecutionResult[]>;
    /**
     * Starts background execution loop.
     */
    start(): void;
    /**
     * Stops background execution loop.
     */
    stop(): void;
    getQueue(): ReadonlyArray<Task<any, any>>;
    getStats(): {
        total: number;
        pending: number;
        inProgress: number;
        retrying: number;
        activeExecutions: number;
    };
}
//# sourceMappingURL=TaskScheduler.d.ts.map