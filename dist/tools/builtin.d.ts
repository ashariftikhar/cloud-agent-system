/**
 * @file builtin.ts
 * @description Standard production-ready built-in tools for Cloud Agent System.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */
import { ToolDefinition } from '../types/index.js';
/**
 * CalculatorTool: Safely parses and evaluates basic arithmetic operations.
 */
export declare const CalculatorTool: ToolDefinition<{
    expression: string;
}, {
    result: number;
    expression: string;
}>;
/**
 * WebSearchMockTool: High-fidelity deterministic mock search engine for agent intelligence tests and offline runtime.
 */
export declare const WebSearchMockTool: ToolDefinition<{
    query: string;
    limit?: number;
}, {
    query: string;
    results: Array<{
        title: string;
        url: string;
        snippet: string;
        score: number;
    }>;
}>;
/**
 * LeadQualifierTool: Evaluates B2B prospects and outputs ICP tier and score.
 */
export interface LeadQualifierInput {
    companyName: string;
    employeeCount: number;
    annualRevenueOrBudget?: number;
    techStack?: string[];
    urgency?: 'immediate' | 'quarter' | 'exploring';
}
export interface LeadQualificationResult {
    companyName: string;
    qualified: boolean;
    score: number;
    tier: 'Tier 1 Enterprise' | 'Tier 2 Mid-Market' | 'Tier 3 SMB' | 'Disqualified';
    summary: string;
    recommendedAction: string;
}
export declare const LeadQualifierTool: ToolDefinition<LeadQualifierInput, LeadQualificationResult>;
/**
 * CrmLookupTool: Inquires current state of records within edge or cloud CRM repositories.
 */
export declare const CrmLookupTool: ToolDefinition<{
    entityId: string;
    entityType?: string;
}, {
    found: boolean;
    record: Record<string, unknown> | null;
    message: string;
}>;
export declare const BUILTIN_TOOLS: Record<string, ToolDefinition<any, any>>;
export declare function getBuiltinTool(name: string): ToolDefinition<any, any> | undefined;
//# sourceMappingURL=builtin.d.ts.map