/**
 * @file index.ts
 * @description Cloud Agent System - Production TypeScript Agent Runtime, Priority Task Scheduler, and Edge CRM Sync Engine.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */

// Types & Interfaces
export * from './types/index.js';

// Core Runtime
export { AgentRuntime, type PlannerFunction, type AgentRuntimeOptions } from './runtime/AgentRuntime.js';

// Task Scheduler
export { TaskScheduler, type SchedulerOptions } from './scheduler/TaskScheduler.js';

// CRM Sync & Edge Adapters
export {
  CrmSyncEngine,
  calculateRecordChecksum,
  SqliteTursoAdapter,
  GoogleSheetsAdapter,
  WebhookAdapter,
} from './crm/CrmSyncEngine.js';

// Built-in Tools
export {
  CalculatorTool,
  WebSearchMockTool,
  LeadQualifierTool,
  CrmLookupTool,
  BUILTIN_TOOLS,
  getBuiltinTool,
  type LeadQualifierInput,
  type LeadQualificationResult,
} from './tools/builtin.js';

// Telemetry & Observability
export { TelemetryLogger, type LogLevel, type LogEntry } from './telemetry/TelemetryLogger.js';

import { fileURLToPath } from 'node:url';

// Direct execution entrypoint banner
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('⚡ Cloud Agent System v1.0.0 [Production Agent Runtime]');
  console.log('   Ecosystem: Ashflow (https://ashflow.site)');
  console.log('   Run "npm run demo" to launch autonomous agent execution.');
  console.log('   Run "npm test" to execute the test suite.');
}
