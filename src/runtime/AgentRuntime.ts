/**
 * @file AgentRuntime.ts
 * @description Enterprise TypeScript ReAct agent execution engine with dynamic tool dispatch, safety step limiting, and event streaming.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */

import {
  Agent,
  AgentContext,
  AgentExecutionReport,
  ExecutionStep,
  MemoryItem,
  RuntimeEventListener,
  RuntimeEventPayload,
  RuntimeEventType,
  ToolDefinition,
  ToolExecutionContext,
} from '../types/index.js';
import { BUILTIN_TOOLS } from '../tools/builtin.js';
import { TelemetryLogger } from '../telemetry/TelemetryLogger.js';

export type PlannerFunction = (
  agent: Agent,
  prompt: string,
  context: AgentContext,
  history: ExecutionStep[],
  availableTools: ToolDefinition[]
) => Promise<{
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
  isFinal?: boolean;
}>;

export interface AgentRuntimeOptions {
  defaultMaxSteps?: number;
  customPlanner?: PlannerFunction;
  logger?: TelemetryLogger;
}

export class AgentRuntime {
  private tools: Map<string, ToolDefinition<any, any>> = new Map();
  private listeners: Set<RuntimeEventListener> = new Set();
  private memory: Map<string, MemoryItem[]> = new Map();
  private logger: TelemetryLogger;
  private defaultMaxSteps: number;
  private customPlanner?: PlannerFunction;

  constructor(options: AgentRuntimeOptions = {}) {
    this.logger = options.logger || TelemetryLogger.getInstance('agent-runtime');
    this.defaultMaxSteps = options.defaultMaxSteps || 8;
    this.customPlanner = options.customPlanner;

    // Load standard built-in tools
    for (const tool of Object.values(BUILTIN_TOOLS)) {
      this.registerTool(tool);
    }
  }

  /**
   * Registers a tool into the runtime's dynamic dispatch registry.
   */
  public registerTool(tool: ToolDefinition<any, any>): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`Tool registered: ${tool.name}`);
  }

  /**
   * Retrieves all available tool definitions registered in this runtime.
   */
  public getTools(): ToolDefinition<any, any>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Subscribes an event listener for live runtime telemetry and agent steps.
   */
  public on(listener: RuntimeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(eventType: RuntimeEventType, agentId: string, sessionId: string, data: Record<string, unknown>): void {
    const payload: RuntimeEventPayload = {
      agentId,
      sessionId,
      eventType,
      timestamp: Date.now(),
      data,
    };
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (err) {
        this.logger.warn(`Listener error in ${eventType}:`, { error: String(err) });
      }
    }
  }

  /**
   * Primary ReAct execution loop for an Agent.
   */
  public async execute(
    agent: Agent,
    prompt: string,
    initialContext?: Partial<AgentContext>
  ): Promise<AgentExecutionReport> {
    const startTime = Date.now();
    const sessionId = initialContext?.sessionId || `session_${Math.random().toString(36).slice(2, 10)}`;
    const maxSteps = agent.maxSteps || this.defaultMaxSteps;

    const context: AgentContext = {
      sessionId,
      userId: initialContext?.userId,
      variables: { ...(initialContext?.variables || {}) },
      startTime,
    };

    const steps: ExecutionStep[] = [];
    let isFinished = false;
    let finalAnswer: string | undefined;
    let failureError: string | undefined;

    agent.status = 'running';
    this.logger.info(`Agent [${agent.name}] started execution loop (Session: ${sessionId})`);
    this.emit('start', agent.id, sessionId, { prompt, maxSteps });

    // Store user query in session memory
    this.appendMemory(sessionId, {
      id: `mem_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    });

    let stepNumber = 0;

    while (!isFinished && stepNumber < maxSteps) {
      stepNumber++;
      const stepStart = Date.now();

      // Available tools for this agent (filtered by agent.tools if specified)
      const allowedTools = this.getTools().filter(
        (t) => !agent.tools || agent.tools.length === 0 || agent.tools.includes(t.name)
      );

      try {
        // Generate plan step (Reasoning phase)
        const plan = await this.planNextStep(agent, prompt, context, steps, allowedTools);

        this.emit('thought', agent.id, sessionId, {
          stepNumber,
          thought: plan.thought,
        });

        if (plan.isFinal || !plan.action) {
          isFinished = true;
          finalAnswer = plan.finalAnswer || plan.thought;
          const durationMs = Date.now() - stepStart;

          steps.push({
            stepNumber,
            thought: plan.thought,
            observation: finalAnswer,
            timestamp: Date.now(),
            durationMs,
            isFinal: true,
          });

          this.emit('completion', agent.id, sessionId, {
            stepNumber,
            finalAnswer,
          });
          break;
        }

        // Action phase: Tool invocation
        const toolName = plan.action;
        const tool = this.tools.get(toolName);

        if (!tool) {
          throw new Error(`Tool "${toolName}" was called by agent [${agent.name}], but is not registered in runtime.`);
        }

        this.emit('tool_call', agent.id, sessionId, {
          stepNumber,
          tool: toolName,
          input: plan.actionInput,
        });

        const toolContext: ToolExecutionContext = {
          agentId: agent.id,
          sessionId,
          stepNumber,
        };

        const toolStart = Date.now();
        let toolObservation: unknown;

        try {
          toolObservation = await tool.execute(plan.actionInput || {}, toolContext);
        } catch (toolErr) {
          toolObservation = {
            error: toolErr instanceof Error ? toolErr.message : String(toolErr),
            failed: true,
          };
          this.logger.warn(`Tool [${toolName}] encountered execution error:`, { error: toolObservation });
        }

        const toolDurationMs = Date.now() - toolStart;
        this.emit('tool_result', agent.id, sessionId, {
          stepNumber,
          tool: toolName,
          observation: toolObservation,
          durationMs: toolDurationMs,
        });

        const stepDurationMs = Date.now() - stepStart;
        const recordedStep: ExecutionStep = {
          stepNumber,
          thought: plan.thought,
          action: toolName,
          actionInput: plan.actionInput,
          observation: toolObservation,
          timestamp: Date.now(),
          durationMs: stepDurationMs,
        };
        steps.push(recordedStep);

        this.emit('step', agent.id, sessionId, { step: recordedStep });
      } catch (loopErr) {
        failureError = loopErr instanceof Error ? loopErr.message : String(loopErr);
        this.logger.error(`Execution failed at step ${stepNumber}: ${failureError}`);
        this.emit('error', agent.id, sessionId, { stepNumber, error: failureError });
        agent.status = 'failed';
        break;
      }
    }

    if (!isFinished && stepNumber >= maxSteps) {
      failureError = `Agent exceeded maximum safety step limit (${maxSteps} steps).`;
      this.logger.warn(failureError, { agentId: agent.id, sessionId });
      this.emit('max_steps_exceeded', agent.id, sessionId, { maxSteps, totalSteps: stepNumber });
      agent.status = 'failed';
    } else if (!failureError) {
      agent.status = 'completed';
    }

    const totalDurationMs = Date.now() - startTime;
    const report: AgentExecutionReport = {
      agentId: agent.id,
      sessionId,
      success: !failureError,
      finalAnswer,
      steps,
      totalSteps: steps.length,
      durationMs: totalDurationMs,
      error: failureError,
    };

    this.logger.info(`Agent [${agent.name}] execution finished in ${totalDurationMs}ms (Success: ${report.success})`);
    return report;
  }

  /**
   * Internal reasoning & planning engine.
   * If a custom planner is provided, uses it. Otherwise uses deterministic pattern-matching
   * for zero-dependency standalone execution and tool resolution.
   */
  private async planNextStep(
    agent: Agent,
    prompt: string,
    context: AgentContext,
    history: ExecutionStep[],
    availableTools: ToolDefinition[]
  ): Promise<{
    thought: string;
    action?: string;
    actionInput?: Record<string, unknown>;
    finalAnswer?: string;
    isFinal?: boolean;
  }> {
    if (this.customPlanner) {
      return this.customPlanner(agent, prompt, context, history, availableTools);
    }

    const promptLower = prompt.toLowerCase();

    // 1. Math / Calculation evaluation
    if (
      availableTools.some((t) => t.name === 'calculator') &&
      !history.some((s) => s.action === 'calculator') &&
      (promptLower.includes('calculate') || promptLower.includes('compute') || /[\d]+\s*[\+\-\*\/]\s*[\d]+/.test(prompt))
    ) {
      const mathMatch = prompt.match(/([0-9+\-*/().\s%^]+)/g);
      const expression = mathMatch ? mathMatch.sort((a, b) => b.length - a.length)[0].trim() : '1 + 1';
      return {
        thought: `User requested a mathematical computation. Invoking Calculator tool for expression "${expression}".`,
        action: 'calculator',
        actionInput: { expression },
      };
    }

    // 2. Lead Qualification evaluation
    if (
      availableTools.some((t) => t.name === 'lead_qualifier') &&
      !history.some((s) => s.action === 'lead_qualifier') &&
      (promptLower.includes('lead') || promptLower.includes('qualify') || promptLower.includes('prospect'))
    ) {
      // Extract parameters from prompt or context
      const companyMatch = prompt.match(/company[:\s]+(["']?)([\w\s.-]+)\1/i) || prompt.match(/(?:for|company)\s+([A-Z][\w\s.-]+)/);
      const employeeMatch = prompt.match(/(\d+)\s*(?:employees|people|headcount)/i);
      const budgetMatch = prompt.match(/\$?(\d+[\d,]*)\s*(?:budget|revenue|usd)/i);

      const companyName = companyMatch ? companyMatch[companyMatch.length - 1].trim() : 'Acme Global';
      const employeeCount = employeeMatch ? parseInt(employeeMatch[1], 10) : 150;
      const budget = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ''), 10) : 60000;

      return {
        thought: `Evaluating enterprise sales lead criteria for "${companyName}" with ${employeeCount} employees.`,
        action: 'lead_qualifier',
        actionInput: {
          companyName,
          employeeCount,
          annualRevenueOrBudget: budget,
          urgency: 'immediate',
        },
      };
    }

    // 3. Web Search mock evaluation
    if (
      availableTools.some((t) => t.name === 'web_search') &&
      !history.some((s) => s.action === 'web_search') &&
      (promptLower.includes('search') || promptLower.includes('find') || promptLower.includes('lookup') || promptLower.includes('what is'))
    ) {
      return {
        thought: `Searching knowledge base and enterprise indexes for relevant intelligence.`,
        action: 'web_search',
        actionInput: { query: prompt },
      };
    }

    // 4. CRM Lookup
    if (
      availableTools.some((t) => t.name === 'crm_lookup') &&
      !history.some((s) => s.action === 'crm_lookup') &&
      (promptLower.includes('crm') || promptLower.includes('record') || promptLower.includes('lead-'))
    ) {
      const idMatch = prompt.match(/(lead-\d+|deal-\d+|account-\d+)/i);
      const entityId = idMatch ? idMatch[1].toLowerCase() : 'lead-001';
      return {
        thought: `Looking up CRM record "${entityId}" in edge database.`,
        action: 'crm_lookup',
        actionInput: { entityId },
      };
    }

    // Final synthesis: summarize findings from observations
    if (history.length > 0) {
      const summaryParts = history.map((s) => {
        if (s.action === 'calculator') {
          const obs = s.observation as { expression: string; result: number };
          return `Calculation result for "${obs.expression}": ${obs.result}.`;
        }
        if (s.action === 'lead_qualifier') {
          const obs = s.observation as { companyName: string; tier: string; score: number; recommendedAction: string };
          return `Qualification: ${obs.companyName} categorized as ${obs.tier} (Score: ${obs.score}/100). Next action: ${obs.recommendedAction}`;
        }
        if (s.action === 'web_search') {
          const obs = s.observation as { results: Array<{ title: string; snippet: string }> };
          return `Search findings: Found ${obs.results?.length || 0} entries. Top snippet: "${obs.results?.[0]?.snippet || ''}"`;
        }
        if (s.action === 'crm_lookup') {
          const obs = s.observation as { found: boolean; message: string; record?: Record<string, unknown> };
          return obs.message;
        }
        return `Observation: ${JSON.stringify(s.observation)}`;
      });

      return {
        thought: 'Sufficient observations collected. Synthesizing final execution response.',
        finalAnswer: `Plan executed successfully:\n` + summaryParts.map((p) => `- ${p}`).join('\n'),
        isFinal: true,
      };
    }

    // Fallback direct answer
    return {
      thought: 'Direct synthesis requested without external tool requirements.',
      finalAnswer: `Processed instruction: "${prompt}" successfully under agent [${agent.name}].`,
      isFinal: true,
    };
  }

  private appendMemory(sessionId: string, item: MemoryItem): void {
    if (!this.memory.has(sessionId)) {
      this.memory.set(sessionId, []);
    }
    this.memory.get(sessionId)!.push(item);
  }

  public getSessionMemory(sessionId: string): MemoryItem[] {
    return this.memory.get(sessionId) || [];
  }
}
