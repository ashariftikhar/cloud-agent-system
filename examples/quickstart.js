/**
 * @file quickstart.js
 * @description Autonomous Cloud Agent executing multi-step ReAct reasoning, tool execution, and RAW-verified CRM edge sync.
 * @run node examples/quickstart.js
 */

import {
  AgentRuntime,
  CrmSyncEngine,
  TelemetryLogger,
} from '../dist/index.js';

// ANSI styling for CLI output
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';

async function main() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}   ⚡ ASHFLOW CLOUD AGENT SYSTEM - AUTONOMOUS RUNTIME DEMO ⚡   ${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // 1. Initialize Telemetry & Runtime
  const logger = new TelemetryLogger('quickstart-demo', 'info', false);
  const runtime = new AgentRuntime({ defaultMaxSteps: 6, logger });
  const crm = new CrmSyncEngine('sqlite-turso');

  // 2. Stream real-time agent lifecycle events
  runtime.on((event) => {
    switch (event.eventType) {
      case 'start':
        console.log(`${MAGENTA}[AGENT START]${RESET} Agent ID: ${event.agentId} | Session: ${event.sessionId}`);
        break;
      case 'thought':
        console.log(`${YELLOW}[THOUGHT Step ${event.data.stepNumber}]${RESET} ${event.data.thought}`);
        break;
      case 'tool_call':
        console.log(`  ${CYAN}⚡ [ACTION]${RESET} Invoking tool "${event.data.tool}" with input:`, JSON.stringify(event.data.input));
        break;
      case 'tool_result':
        console.log(`  ${GREEN}✓ [OBSERVATION]${RESET} Completed in ${event.data.durationMs}ms`);
        break;
      case 'completion':
        console.log(`\n${GREEN}${BOLD}[AGENT COMPLETED]${RESET} All objectives achieved.\n`);
        break;
    }
  });

  // 3. Define the Autonomous Agent
  const agent = {
    id: 'agent_enterprise_closer',
    name: 'Enterprise Revenue Specialist',
    role: 'Autonomous Sales & Qualification Executive',
    systemPrompt: 'Qualify enterprise accounts, calculate pipeline value, and ensure atomic CRM synchronization.',
    tools: ['lead_qualifier', 'calculator', 'crm_lookup'],
    status: 'idle',
    maxSteps: 5,
  };

  const userInstruction = 'Qualify prospective lead for Acme Global with 250 employees and $85,000 budget, calculate 15% discount on $85000: (85000 * 0.85), and record status.';
  console.log(`${BOLD}User Prompt:${RESET} "${userInstruction}"\n`);

  // 4. Execute the Agent ReAct loop
  const report = await runtime.execute(agent, userInstruction);

  console.log(`${BOLD}Execution Summary:${RESET}`);
  console.log(`- Success: ${report.success ? GREEN + 'true' + RESET : 'false'}`);
  console.log(`- Total Steps: ${report.totalSteps}`);
  console.log(`- Duration: ${report.durationMs}ms`);
  console.log(`\n${BOLD}Final Response:${RESET}\n${report.finalAnswer}\n`);

  // 5. Update CRM with RAW (Read-After-Write) State Verification
  console.log(`${CYAN}${BOLD}----------------------------------------------------------------${RESET}`);
  console.log(`${CYAN}${BOLD}  SYNCHRONIZING EDGE CRM STATE (READ-AFTER-WRITE VERIFICATION)  ${RESET}`);
  console.log(`${CYAN}${BOLD}----------------------------------------------------------------${RESET}`);

  const leadSyncPayload = {
    id: 'lead-acme-global-2026',
    entityType: 'lead',
    data: {
      company: 'Acme Global',
      headcount: 250,
      annualBudget: 85000,
      discountedArr: 72250,
      tier: 'Tier 1 Enterprise',
      stage: 'Sales Qualified Lead (SQL)',
      qualifiedBy: agent.id,
      verifiedTimestamp: Date.now(),
    },
  };

  const { record, verification } = await crm.syncRecord(leadSyncPayload);

  console.log(`\n${GREEN}✓ Record Synchronized Successfully!${RESET}`);
  console.log(`- Record ID:         ${record.id}`);
  console.log(`- Storage Adapter:   ${crm.getAdapter().name}`);
  console.log(`- Verified Status:   ${record.syncStatus.toUpperCase()}`);
  console.log(`- Expected Checksum: ${verification.expectedChecksum.slice(0, 16)}...`);
  console.log(`- Actual Checksum:   ${verification.actualChecksum?.slice(0, 16)}...`);
  console.log(`- Matched Fields:    ${verification.matchedFields.length} of ${Object.keys(leadSyncPayload.data).length}`);
  console.log(`- RAW Latency:       ${verification.latencyMs}ms\n`);

  console.log(`${GREEN}${BOLD}✨ Quickstart completed with zero errors.${RESET}\n`);
}

main().catch((err) => {
  console.error('Quickstart fatal error:', err);
  process.exit(1);
});
