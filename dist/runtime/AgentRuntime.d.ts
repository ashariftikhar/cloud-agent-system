/**
 * @file AgentRuntime.ts
 * @description Enterprise TypeScript ReAct agent execution engine with dynamic tool dispatch, safety step limiting, and event streaming.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */
import { Agent, AgentContext, AgentExecutionReport, ExecutionStep, MemoryItem, RuntimeEventListener, ToolDefinition } from '../types/index.js';
import { TelemetryLogger } from '../telemetry/TelemetryLogger.js';
export type PlannerFunction = (agent: Agent, prompt: string, context: AgentContext, history: ExecutionStep[], availableTools: ToolDefinition[]) => Promise<{
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
export declare class AgentRuntime {
    private tools;
    private listeners;
    private memory;
    private logger;
    private defaultMaxSteps;
    private customPlanner?;
    constructor(options?: AgentRuntimeOptions);
    /**
     * Registers a tool into the runtime's dynamic dispatch registry.
     */
    registerTool(tool: ToolDefinition<any, any>): void;
    /**
     * Retrieves all available tool definitions registered in this runtime.
     */
    getTools(): ToolDefinition<any, any>[];
    /**
     * Subscribes an event listener for live runtime telemetry and agent steps.
     */
    on(listener: RuntimeEventListener): () => void;
    private emit;
    /**
     * Primary ReAct execution loop for an Agent.
     */
    execute(agent: Agent, prompt: string, initialContext?: Partial<AgentContext>): Promise<AgentExecutionReport>;
    /**
     * Internal reasoning & planning engine.
     * If a custom planner is provided, uses it. Otherwise uses deterministic pattern-matching
     * for zero-dependency standalone execution and tool resolution.
     */
    private planNextStep;
    private appendMemory;
    getSessionMemory(sessionId: string): MemoryItem[];
}
//# sourceMappingURL=AgentRuntime.d.ts.map