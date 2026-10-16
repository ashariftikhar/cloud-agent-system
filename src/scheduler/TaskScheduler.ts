/**
 * @file TaskScheduler.ts
 * @description Enterprise-grade priority task scheduler with cron/interval execution and exponential backoff retry semantics.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */

import { Task, TaskPriority, TaskExecutionResult } from '../types/index.js';
import { TelemetryLogger } from '../telemetry/TelemetryLogger.js';

export interface SchedulerOptions {
  pollingIntervalMs?: number;
  concurrency?: number;
  defaultMaxRetries?: number;
  defaultInitialDelayMs?: number;
  defaultBackoffFactor?: number;
}

export class TaskScheduler {
  private queue: Task<any, any>[] = [];
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private activeExecutions: number = 0;
  private logger: TelemetryLogger;
  private options: Required<SchedulerOptions>;

  constructor(options: SchedulerOptions = {}) {
    this.logger = TelemetryLogger.getInstance('task-scheduler');
    this.options = {
      pollingIntervalMs: options.pollingIntervalMs ?? 100,
      concurrency: options.concurrency ?? 5,
      defaultMaxRetries: options.defaultMaxRetries ?? 3,
      defaultInitialDelayMs: options.defaultInitialDelayMs ?? 200,
      defaultBackoffFactor: options.defaultBackoffFactor ?? 2,
    };
  }

  /**
   * Enqueues a task with priority ordering (Urgent > High > Normal > Low).
   */
  public enqueue<TPayload, TResult>(taskInput: {
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
  }): Task<TPayload, TResult> {
    const now = Date.now();
    const task: Task<TPayload, TResult> = {
      id: taskInput.id || `task_${Math.random().toString(36).slice(2, 11)}_${now}`,
      title: taskInput.title,
      description: taskInput.description,
      priority: taskInput.priority ?? TaskPriority.NORMAL,
      payload: taskInput.payload,
      status: 'pending',
      retries: 0,
      maxRetries: taskInput.maxRetries ?? this.options.defaultMaxRetries,
      initialDelayMs: taskInput.initialDelayMs ?? this.options.defaultInitialDelayMs,
      backoffFactor: taskInput.backoffFactor ?? this.options.defaultBackoffFactor,
      nextRunAt: now + (taskInput.delayMs || 0),
      createdAt: now,
      handler: taskInput.handler,
    };

    this.insertIntoQueue(task);
    this.logger.debug(`Task [${task.title}] enqueued with priority ${TaskPriority[task.priority]} (id: ${task.id})`);
    return task;
  }

  /**
   * Registers a recurring interval task.
   */
  public scheduleInterval<TPayload, TResult>(
    intervalMs: number,
    taskInput: {
      id?: string;
      title: string;
      priority?: TaskPriority;
      payload: TPayload;
      handler: (payload: TPayload) => Promise<TResult>;
    }
  ): Task<TPayload, TResult> {
    const task = this.enqueue({
      ...taskInput,
      delayMs: 0,
    });
    task.intervalMs = intervalMs;
    return task;
  }

  private insertIntoQueue(task: Task<any, any>): void {
    this.queue.push(task);
    this.sortQueue();
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // 1. Sort by Priority (0 = Urgent is highest)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 2. Sort by next scheduled run time
      if (a.nextRunAt !== b.nextRunAt) {
        return a.nextRunAt - b.nextRunAt;
      }
      // 3. FIFO by creation time
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Executes a single ready task from the queue.
   */
  public async processNext(): Promise<TaskExecutionResult | null> {
    const now = Date.now();
    const readyIndex = this.queue.findIndex(
      (t) => (t.status === 'pending' || t.status === 'retrying') && t.nextRunAt <= now
    );

    if (readyIndex === -1) {
      return null;
    }

    const task = this.queue[readyIndex];
    task.status = 'in_progress';
    this.activeExecutions++;

    const startTime = Date.now();
    try {
      if (!task.handler) {
        throw new Error(`Task [${task.id}] has no executable handler.`);
      }

      this.logger.debug(`Executing task [${task.title}] (attempt ${task.retries + 1}/${task.maxRetries + 1})`);
      const result = await task.handler(task.payload);
      const durationMs = Date.now() - startTime;

      task.status = 'completed';
      task.completedAt = Date.now();
      this.activeExecutions--;

      // If it's a recurring task, schedule the next cycle
      if (task.intervalMs && task.intervalMs > 0) {
        task.status = 'pending';
        task.retries = 0;
        task.nextRunAt = Date.now() + task.intervalMs;
        this.sortQueue();
      } else {
        // Remove completed non-recurring task
        this.queue.splice(this.queue.indexOf(task), 1);
      }

      return {
        taskId: task.id,
        success: true,
        result,
        durationMs,
        retryCount: task.retries,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.activeExecutions--;

      task.error = errorMsg;

      if (task.retries < task.maxRetries) {
        task.retries++;
        task.status = 'retrying';

        const factor = task.backoffFactor ?? this.options.defaultBackoffFactor;
        const baseDelay = task.initialDelayMs ?? this.options.defaultInitialDelayMs;
        const backoffMs = baseDelay * Math.pow(factor, task.retries - 1);
        task.nextRunAt = Date.now() + backoffMs;

        this.logger.warn(`Task [${task.title}] failed. Retrying in ${backoffMs}ms (retry ${task.retries}/${task.maxRetries})`, {
          taskId: task.id,
          error: errorMsg,
        });

        this.sortQueue();

        return {
          taskId: task.id,
          success: false,
          error: errorMsg,
          durationMs,
          retryCount: task.retries,
        };
      } else {
        task.status = 'failed';
        this.logger.error(`Task [${task.title}] permanently failed after ${task.retries} retries.`, {
          taskId: task.id,
          error: errorMsg,
        });

        // Recurring tasks still reschedule even after permanent error
        if (task.intervalMs && task.intervalMs > 0) {
          task.status = 'pending';
          task.retries = 0;
          task.nextRunAt = Date.now() + task.intervalMs;
          this.sortQueue();
        } else {
          this.queue.splice(this.queue.indexOf(task), 1);
        }

        return {
          taskId: task.id,
          success: false,
          error: errorMsg,
          durationMs,
          retryCount: task.retries,
        };
      }
    }
  }

  /**
   * Processes all currently pending and ready tasks sequentially until queue is drained or blocked on timers.
   */
  public async processAllPending(): Promise<TaskExecutionResult[]> {
    const results: TaskExecutionResult[] = [];
    while (true) {
      const res = await this.processNext();
      if (!res) break;
      results.push(res);
    }
    return results;
  }

  /**
   * Starts background execution loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const tick = async () => {
      if (!this.isRunning) return;

      while (this.activeExecutions < this.options.concurrency) {
        const processed = await this.processNext();
        if (!processed) break;
      }

      if (this.isRunning) {
        this.timer = setTimeout(tick, this.options.pollingIntervalMs);
      }
    };

    this.timer = setTimeout(tick, this.options.pollingIntervalMs);
    this.logger.info('TaskScheduler loop started.');
  }

  /**
   * Stops background execution loop.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.logger.info('TaskScheduler loop stopped.');
  }

  public getQueue(): ReadonlyArray<Task<any, any>> {
    return [...this.queue];
  }

  public getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    retrying: number;
    activeExecutions: number;
  } {
    const counts = {
      total: this.queue.length,
      pending: 0,
      inProgress: this.activeExecutions,
      retrying: 0,
      activeExecutions: this.activeExecutions,
    };

    for (const t of this.queue) {
      if (t.status === 'pending') counts.pending++;
      else if (t.status === 'retrying') counts.retrying++;
    }

    return counts;
  }
}
