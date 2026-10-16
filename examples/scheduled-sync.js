/**
 * @file scheduled-sync.js
 * @description Demonstrates the TaskScheduler executing periodic CRM synchronization with priority queuing and backoff retry.
 * @run node examples/scheduled-sync.js
 */

import {
  TaskScheduler,
  TaskPriority,
  CrmSyncEngine,
  TelemetryLogger,
} from '../dist/index.js';

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

async function main() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   ⚡ ASHFLOW CLOUD AGENT SYSTEM - SCHEDULED CRM SYNC DEMO ⚡   ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  const logger = new TelemetryLogger('scheduler-demo', 'info', false);
  const scheduler = new TaskScheduler({
    pollingIntervalMs: 50,
    concurrency: 3,
    defaultMaxRetries: 2,
    defaultInitialDelayMs: 100,
  });

  const crm = new CrmSyncEngine('sqlite-turso');

  // Enqueue normal priority periodic sync task
  let syncCycle = 0;
  scheduler.enqueue({
    id: 'crm-sync-periodic-batch',
    title: 'Periodic Edge Batch Sync',
    priority: TaskPriority.NORMAL,
    payload: { batchSize: 5 },
    handler: async (payload) => {
      syncCycle++;
      const records = [
        { id: `lead-auto-${syncCycle}-A`, entityType: 'lead', data: { cycle: syncCycle, score: 85, status: 'synced' } },
        { id: `lead-auto-${syncCycle}-B`, entityType: 'lead', data: { cycle: syncCycle, score: 92, status: 'synced' } },
      ];
      const results = await crm.syncBatch(records);
      const verified = results.every((r) => r.verification.verified);
      return { syncedCount: results.length, verified, cycle: syncCycle };
    },
  });

  // Enqueue an URGENT task that runs ahead of normal queue
  scheduler.enqueue({
    id: 'urgent-enterprise-deal-close',
    title: 'Urgent Enterprise Deal Sync ($120k ARR)',
    priority: TaskPriority.URGENT,
    payload: { dealId: 'deal-999', value: 120000 },
    handler: async (payload) => {
      const syncResult = await crm.syncRecord({
        id: payload.dealId,
        entityType: 'deal',
        data: { value: payload.value, stage: 'closed-won', timestamp: Date.now() },
      });
      return { dealId: payload.dealId, verified: syncResult.verification.verified };
    },
  });

  // Enqueue a task that simulates transient failure then recovers via retry
  let attemptCount = 0;
  scheduler.enqueue({
    id: 'resilient-webhook-dispatch',
    title: 'Resilient Webhook Dispatch with Backoff',
    priority: TaskPriority.HIGH,
    payload: { endpoint: 'https://ashflow.site/hooks/enterprise' },
    maxRetries: 3,
    initialDelayMs: 50,
    backoffFactor: 2,
    handler: async (payload) => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('Simulated 503 Service Unavailable (Network Jitter)');
      }
      return { status: 200, deliveredTo: payload.endpoint, attempts: attemptCount };
    },
  });

  console.log(`${BOLD}Initial Queue Stats:${RESET}`, scheduler.getStats());
  console.log(`\nExecuting scheduled tasks according to priority order...\n`);

  // Process tasks
  while (scheduler.getStats().total > 0) {
    const result = await scheduler.processNext();
    if (result) {
      const color = result.success ? GREEN : (result.retryCount > 0 ? YELLOW : RED);
      const statusLabel = result.success ? '✓ SUCCESS' : '⚠ RETRY/FAIL';
      console.log(`[${color}${statusLabel}${RESET}] Task ${BOLD}${result.taskId}${RESET} (${result.durationMs}ms)`);
      if (result.result) {
        console.log(`   Output:`, JSON.stringify(result.result));
      }
      if (result.error) {
        console.log(`   Notice: ${YELLOW}${result.error}${RESET}`);
      }
    } else {
      // Small sleep if backoff delay is pending
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  console.log(`\n${GREEN}${BOLD}✓ All scheduled sync jobs and retries successfully executed!${RESET}`);
  console.log(`${BOLD}Final Queue Stats:${RESET}`, scheduler.getStats(), '\n');
}

main().catch((err) => {
  console.error('Fatal scheduler error:', err);
  process.exit(1);
});
