/**
 * @file runtime.test.js
 * @description Comprehensive automated test suite for Cloud Agent System using Node's native test runner.
 * @run node --test tests/runtime.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentRuntime,
  TaskScheduler,
  TaskPriority,
  CrmSyncEngine,
  calculateRecordChecksum,
  CalculatorTool,
  WebSearchMockTool,
  LeadQualifierTool,
  CrmLookupTool,
  TelemetryLogger,
  SqliteTursoAdapter,
  GoogleSheetsAdapter,
  WebhookAdapter,
} from '../dist/index.js';

describe('Cloud Agent System Test Suite', () => {
  describe('AgentRuntime & ReAct Loop', () => {
    it('should initialize runtime and load default built-in tools', () => {
      const logger = new TelemetryLogger('test-logger', 'silent', false);
      const runtime = new AgentRuntime({ logger });
      const tools = runtime.getTools();
      assert.ok(tools.length >= 4, 'Runtime should have at least 4 built-in tools');
      assert.ok(tools.some((t) => t.name === 'calculator'));
      assert.ok(tools.some((t) => t.name === 'web_search'));
      assert.ok(tools.some((t) => t.name === 'lead_qualifier'));
      assert.ok(tools.some((t) => t.name === 'crm_lookup'));
    });

    it('should stream execution events via runtime.on()', async () => {
      const logger = new TelemetryLogger('test-logger', 'silent', false);
      const runtime = new AgentRuntime({ logger });
      const capturedEvents = [];

      const unsubscribe = runtime.on((event) => {
        capturedEvents.push(event.eventType);
      });

      const agent = {
        id: 'agent-calc',
        name: 'Calculator Agent',
        role: 'Math Evaluator',
        systemPrompt: 'Calculate numbers accurately.',
        tools: ['calculator'],
        status: 'idle',
      };

      const report = await runtime.execute(agent, 'Calculate 25 * 4');
      unsubscribe();

      assert.strictEqual(report.success, true);
      assert.ok(capturedEvents.includes('start'), 'Should emit start event');
      assert.ok(capturedEvents.includes('thought'), 'Should emit thought event');
      assert.ok(capturedEvents.includes('tool_call'), 'Should emit tool_call event');
      assert.ok(capturedEvents.includes('tool_result'), 'Should emit tool_result event');
      assert.ok(capturedEvents.includes('completion'), 'Should emit completion event');
    });

    it('should enforce safety limit when maxSteps is exceeded', async () => {
      const logger = new TelemetryLogger('test-logger', 'silent', false);
      // Infinite loop planner with no completion
      const infinitePlanner = async () => ({
        thought: 'Thinking indefinitely...',
        action: 'calculator',
        actionInput: { expression: '1 + 1' },
        isFinal: false,
      });

      const runtime = new AgentRuntime({ defaultMaxSteps: 3, customPlanner: infinitePlanner, logger });
      const agent = {
        id: 'agent-safety',
        name: 'Looping Agent',
        role: 'Test Agent',
        systemPrompt: 'Loops continuously',
        tools: ['calculator'],
        status: 'idle',
        maxSteps: 3,
      };

      const report = await runtime.execute(agent, 'Do something forever');
      assert.strictEqual(report.success, false);
      assert.strictEqual(agent.status, 'failed');
      assert.ok(report.error?.includes('exceeded maximum safety step limit'));
    });

    it('should support custom planner injection', async () => {
      const logger = new TelemetryLogger('test-logger', 'silent', false);
      const customPlanner = async (_agent, prompt) => ({
        thought: `Custom reasoning completed for "${prompt}".`,
        isFinal: true,
        finalAnswer: 'Custom Planner Output',
      });

      const runtime = new AgentRuntime({ customPlanner, logger });
      const agent = {
        id: 'custom-agent',
        name: 'Custom Agent',
        role: 'Specialist',
        systemPrompt: 'System',
        tools: [],
        status: 'idle',
      };

      const report = await runtime.execute(agent, 'Run custom workflow');
      assert.strictEqual(report.success, true);
      assert.strictEqual(report.finalAnswer, 'Custom Planner Output');
    });
  });

  describe('Built-in Agent Tools', () => {
    it('CalculatorTool: should evaluate arithmetic expressions correctly', async () => {
      const ctx = { agentId: 'test', sessionId: 's1', stepNumber: 1 };
      const res = await CalculatorTool.execute({ expression: '(100 + 50) * 2 / 10' }, ctx);
      assert.strictEqual(res.result, 30);
    });

    it('CalculatorTool: should reject unsafe code injections', async () => {
      const ctx = { agentId: 'test', sessionId: 's1', stepNumber: 1 };
      await assert.rejects(
        async () => {
          await CalculatorTool.execute({ expression: 'process.exit(1)' }, ctx);
        },
        /Unsafe mathematical expression/
      );
    });

    it('LeadQualifierTool: should score enterprise lead as Tier 1', async () => {
      const ctx = { agentId: 'test', sessionId: 's1', stepNumber: 1 };
      const res = await LeadQualifierTool.execute(
        {
          companyName: 'Apex Enterprise',
          employeeCount: 600,
          annualRevenueOrBudget: 120000,
          urgency: 'immediate',
        },
        ctx
      );

      assert.strictEqual(res.qualified, true);
      assert.strictEqual(res.tier, 'Tier 1 Enterprise');
      assert.ok(res.score >= 75);
    });

    it('WebSearchMockTool: should return deterministic knowledge results', async () => {
      const ctx = { agentId: 'test', sessionId: 's1', stepNumber: 1 };
      const res = await WebSearchMockTool.execute({ query: 'ashflow crm runtime' }, ctx);
      assert.ok(res.results.length > 0);
      assert.ok(res.results[0].title.includes('Ashflow'));
    });

    it('CrmLookupTool: should find existing test CRM record', async () => {
      const ctx = { agentId: 'test', sessionId: 's1', stepNumber: 1 };
      const res = await CrmLookupTool.execute({ entityId: 'lead-001' }, ctx);
      assert.strictEqual(res.found, true);
      assert.strictEqual(res.record?.id, 'lead-001');
    });
  });

  describe('TaskScheduler & Priority Execution', () => {
    it('should execute tasks in order of priority (Urgent > High > Normal > Low)', async () => {
      const scheduler = new TaskScheduler();
      const executionOrder = [];

      scheduler.enqueue({
        title: 'Normal Task',
        priority: TaskPriority.NORMAL,
        payload: 'normal',
        handler: async (p) => {
          executionOrder.push(p);
        },
      });

      scheduler.enqueue({
        title: 'Low Task',
        priority: TaskPriority.LOW,
        payload: 'low',
        handler: async (p) => {
          executionOrder.push(p);
        },
      });

      scheduler.enqueue({
        title: 'Urgent Task',
        priority: TaskPriority.URGENT,
        payload: 'urgent',
        handler: async (p) => {
          executionOrder.push(p);
        },
      });

      scheduler.enqueue({
        title: 'High Task',
        priority: TaskPriority.HIGH,
        payload: 'high',
        handler: async (p) => {
          executionOrder.push(p);
        },
      });

      await scheduler.processAllPending();

      assert.deepStrictEqual(executionOrder, ['urgent', 'high', 'normal', 'low']);
    });

    it('should retry failed tasks with exponential backoff and eventually succeed', async () => {
      const scheduler = new TaskScheduler();
      let callCount = 0;

      scheduler.enqueue({
        title: 'Retry Task',
        priority: TaskPriority.HIGH,
        payload: 'retry-payload',
        maxRetries: 2,
        initialDelayMs: 20,
        backoffFactor: 2,
        handler: async () => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Temporary failure');
          }
          return 'success-after-retry';
        },
      });

      // 1st attempt fails
      const res1 = await scheduler.processNext();
      assert.strictEqual(res1?.success, false);
      assert.strictEqual(res1?.retryCount, 1);

      // Wait for backoff delay (20ms)
      await new Promise((resolve) => setTimeout(resolve, 30));

      // 2nd attempt succeeds
      const res2 = await scheduler.processNext();
      assert.strictEqual(res2?.success, true);
      assert.strictEqual(res2?.result, 'success-after-retry');
    });

    it('should mark task failed when maxRetries is exceeded', async () => {
      const scheduler = new TaskScheduler();
      scheduler.enqueue({
        title: 'Permanently Failing Task',
        priority: TaskPriority.HIGH,
        payload: {},
        maxRetries: 1,
        initialDelayMs: 10,
        handler: async () => {
          throw new Error('Permanent database offline');
        },
      });

      // Attempt 1 -> retrying
      await scheduler.processNext();
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Attempt 2 -> permanent failure
      const finalRes = await scheduler.processNext();
      assert.strictEqual(finalRes?.success, false);
      assert.ok(finalRes?.error?.includes('Permanent database offline'));
    });
  });

  describe('CrmSyncEngine & RAW State Verification', () => {
    it('should sync record with SQLite/Turso adapter and pass RAW verification', async () => {
      const crm = new CrmSyncEngine('sqlite-turso');
      const testData = {
        name: 'Ashflow Enterprise Deal',
        arr: 95000,
        currency: 'USD',
        active: true,
      };

      const result = await crm.syncRecord({
        id: 'deal-ashflow-1',
        entityType: 'deal',
        data: testData,
      });

      assert.strictEqual(result.record.syncStatus, 'synced');
      assert.strictEqual(result.verification.verified, true);
      assert.strictEqual(result.verification.recordId, 'deal-ashflow-1');
      assert.strictEqual(result.verification.expectedChecksum, result.verification.actualChecksum);
      assert.strictEqual(result.verification.mismatchedFields.length, 0);
    });

    it('should calculate deterministic SHA-256 checksums regardless of key insertion order', () => {
      const objA = { alpha: 'one', beta: 2, gamma: true };
      const objB = { gamma: true, alpha: 'one', beta: 2 };

      const hashA = calculateRecordChecksum(objA);
      const hashB = calculateRecordChecksum(objB);

      assert.strictEqual(hashA, hashB);
    });

    it('should sync across GoogleSheets and Webhook adapters', async () => {
      const crm = new CrmSyncEngine();
      crm.registerAdapter(new GoogleSheetsAdapter());
      crm.registerAdapter(new WebhookAdapter());

      // Sync via Google Sheets
      const sheetRes = await crm.syncRecord(
        {
          id: 'contact-sheet-01',
          entityType: 'contact',
          data: { email: 'client@domain.com', company: 'CloudCorp' },
        },
        { adapterName: 'google-sheets' }
      );
      assert.strictEqual(sheetRes.record.syncStatus, 'synced');
      assert.strictEqual(sheetRes.verification.verified, true);

      // Sync via Webhook
      const hookRes = await crm.syncRecord(
        {
          id: 'lead-hook-01',
          entityType: 'lead',
          data: { source: 'inbound', score: 99 },
        },
        { adapterName: 'crm-webhook' }
      );
      assert.strictEqual(hookRes.record.syncStatus, 'synced');
      assert.strictEqual(hookRes.verification.verified, true);
    });

    it('should detect RAW state verification mismatch when adapter returns corrupted data', async () => {
      // Mock corrupted adapter
      class CorruptedAdapter extends SqliteTursoAdapter {
        constructor() {
          super();
          this.name = 'corrupted-adapter';
        }
        async upsert(record) {
          const stored = await super.upsert(record);
          // Tamper data on store
          stored.data.tampered = true;
          return stored;
        }
      }

      const crm = new CrmSyncEngine();
      crm.registerAdapter(new CorruptedAdapter());

      const res = await crm.syncRecord(
        {
          id: 'lead-tampered',
          entityType: 'lead',
          data: { status: 'secure' },
        },
        { adapterName: 'corrupted-adapter' }
      );

      assert.strictEqual(res.verification.verified, false);
      assert.strictEqual(res.record.syncStatus, 'conflict');
      assert.notStrictEqual(res.verification.expectedChecksum, res.verification.actualChecksum);
    });
  });

  describe('TelemetryLogger', () => {
    it('should measure execution duration using time() and timeEnd()', async () => {
      const logger = new TelemetryLogger('perf-test', 'info', false);
      logger.time('async_operation');
      await new Promise((resolve) => setTimeout(resolve, 30));
      const duration = logger.timeEnd('async_operation');
      assert.ok(duration >= 20, `Duration should be >= 20ms, got ${duration}ms`);

      const buffer = logger.getBuffer();
      assert.ok(buffer.length > 0);
      assert.strictEqual(buffer[0].namespace, 'perf-test');
    });
  });
});
