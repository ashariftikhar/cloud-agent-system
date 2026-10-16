/**
 * @file index.ts
 * @description Core TypeScript type definitions for the Cloud Agent System runtime.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export interface AgentContext {
  sessionId: string;
  userId?: string;
  variables: Record<string, unknown>;
  startTime: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  tools: string[];
  maxSteps?: number;
  status: AgentStatus;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  agentId: string;
  sessionId: string;
  stepNumber: number;
  env?: Record<string, string>;
}

export interface ToolParameterSchema {
  type: string;
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
  }>;
  required?: string[];
  description?: string;
}

export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;
}

export interface ExecutionStep {
  stepNumber: number;
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  observation?: unknown;
  timestamp: number;
  durationMs?: number;
  isFinal?: boolean;
}

export interface AgentExecutionReport {
  agentId: string;
  sessionId: string;
  success: boolean;
  finalAnswer?: string;
  steps: ExecutionStep[];
  totalSteps: number;
  durationMs: number;
  error?: string;
}

export type TaskPriorityLevel = 'urgent' | 'high' | 'normal' | 'low';

export enum TaskPriority {
  URGENT = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying';

export interface Task<TPayload = unknown, TResult = unknown> {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  payload: TPayload;
  status: TaskStatus;
  retries: number;
  maxRetries: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  intervalMs?: number; // For recurring interval schedules
  cron?: string;
  nextRunAt: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
  handler?: (payload: TPayload) => Promise<TResult>;
}

export interface TaskExecutionResult<TResult = unknown> {
  taskId: string;
  success: boolean;
  result?: TResult;
  error?: string;
  durationMs: number;
  retryCount: number;
}

export type CrmEntityType = 'lead' | 'contact' | 'deal' | 'account' | 'activity' | 'custom';
export type CrmSyncStatus = 'synced' | 'pending' | 'failed' | 'conflict';

export interface CrmSyncRecord {
  id: string;
  entityType: CrmEntityType;
  data: Record<string, unknown>;
  checksum: string;
  version: number;
  lastSyncedAt?: number;
  syncStatus: CrmSyncStatus;
}

export interface CrmVerificationResult {
  verified: boolean;
  recordId: string;
  expectedChecksum: string;
  actualChecksum?: string;
  matchedFields: string[];
  mismatchedFields: string[];
  latencyMs: number;
}

export interface CrmAdapter {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  upsert(record: CrmSyncRecord): Promise<CrmSyncRecord>;
  read(id: string): Promise<CrmSyncRecord | null>;
  query(filter: Record<string, unknown>): Promise<CrmSyncRecord[]>;
}

export interface MemoryItem {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type RuntimeEventType =
  | 'start'
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'step'
  | 'completion'
  | 'error'
  | 'max_steps_exceeded';

export interface RuntimeEventPayload {
  agentId: string;
  sessionId: string;
  eventType: RuntimeEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type RuntimeEventListener = (event: RuntimeEventPayload) => void;
