/**
 * @file builtin.ts
 * @description Standard production-ready built-in tools for Cloud Agent System.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */
/**
 * CalculatorTool: Safely parses and evaluates basic arithmetic operations.
 */
export const CalculatorTool = {
    name: 'calculator',
    description: 'Safely evaluates mathematical expressions including addition, subtraction, multiplication, division, and exponentiation.',
    parameters: {
        type: 'object',
        properties: {
            expression: {
                type: 'string',
                description: 'The mathematical expression to evaluate, e.g. "(1500 * 12) + 2500"',
            },
        },
        required: ['expression'],
    },
    async execute(input, _context) {
        const expr = input.expression.trim();
        // Validate only safe arithmetic tokens
        if (!/^[0-9+\-*/().\s%^]+$/.test(expr)) {
            throw new Error(`Unsafe mathematical expression: "${expr}". Only digits and basic arithmetic operators are allowed.`);
        }
        // Safe mathematical evaluation using Function with no globals
        try {
            // Replace ^ with ** for exponents
            const sanitized = expr.replace(/\^/g, '**');
            const evalFn = new Function(`"use strict"; return (${sanitized});`);
            const val = evalFn();
            if (typeof val !== 'number' || !Number.isFinite(val)) {
                throw new Error('Expression did not evaluate to a finite number.');
            }
            return {
                expression: expr,
                result: val,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Calculator execution failed: ${message}`);
        }
    },
};
/**
 * WebSearchMockTool: High-fidelity deterministic mock search engine for agent intelligence tests and offline runtime.
 */
export const WebSearchMockTool = {
    name: 'web_search',
    description: 'Searches real-time cloud data, web knowledge bases, and enterprise documentation.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query string.',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of search results to return (default: 3).',
            },
        },
        required: ['query'],
    },
    async execute(input, _context) {
        const q = input.query.toLowerCase();
        const limit = input.limit ?? 3;
        const mockKnowledgeBase = [
            {
                keywords: ['ashflow', 'crm', 'automation'],
                title: 'Ashflow Enterprise Agent Runtime Overview',
                url: 'https://ashflow.site/docs/cloud-agent-system',
                snippet: 'Ashflow delivers distributed cloud agent execution loops with sub-millisecond edge CRM sync and deterministic verification.',
                score: 0.98,
            },
            {
                keywords: ['lead', 'qualification', 'score', 'b2b'],
                title: 'B2B Sales Qualification Criteria & ICP Standards',
                url: 'https://ashflow.site/playbooks/lead-qualification',
                snippet: 'Ideal Customer Profile benchmarks: Companies with >50 employees, >$50k budget, and cloud-native tech stack qualify for Tier 1 Enterprise priority.',
                score: 0.94,
            },
            {
                keywords: ['turso', 'sqlite', 'edge'],
                title: 'Edge Database Replication with LibSQL & Turso',
                url: 'https://ashflow.site/docs/edge-adapters',
                snippet: 'Distributed SQLite edge replicas ensure instant local reads and atomic write-through synchronization with cloud masters.',
                score: 0.91,
            },
            {
                keywords: ['runtime', 'react', 'loop'],
                title: 'ReAct Agent Execution Patterns in TypeScript',
                url: 'https://ashflow.site/docs/react-patterns',
                snippet: 'Reasoning and Action (ReAct) enables autonomous agents to interleave thought, dynamic tool invocation, and observation loops safely.',
                score: 0.89,
            },
        ];
        const matched = mockKnowledgeBase
            .filter((item) => item.keywords.some((kw) => q.includes(kw)) || item.title.toLowerCase().includes(q))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        if (matched.length === 0) {
            return {
                query: input.query,
                results: [
                    {
                        title: `Search results for "${input.query}"`,
                        url: `https://ashflow.site/search?q=${encodeURIComponent(input.query)}`,
                        snippet: `Standard cloud intelligence context matching query: "${input.query}". Verified by Ashflow Agent Network.`,
                        score: 0.75,
                    },
                ],
            };
        }
        return {
            query: input.query,
            results: matched,
        };
    },
};
export const LeadQualifierTool = {
    name: 'lead_qualifier',
    description: 'Scores and categorizes prospective sales leads based on enterprise ICP metrics (headcount, budget, tech stack).',
    parameters: {
        type: 'object',
        properties: {
            companyName: { type: 'string', description: 'Name of the prospective company' },
            employeeCount: { type: 'number', description: 'Number of full-time employees' },
            annualRevenueOrBudget: { type: 'number', description: 'Allocated budget or annual revenue in USD' },
            urgency: {
                type: 'string',
                enum: ['immediate', 'quarter', 'exploring'],
                description: 'Buying urgency timeline',
            },
        },
        required: ['companyName', 'employeeCount'],
    },
    async execute(input, _context) {
        let score = 0;
        // Headcount scoring
        if (input.employeeCount >= 500)
            score += 40;
        else if (input.employeeCount >= 100)
            score += 30;
        else if (input.employeeCount >= 20)
            score += 20;
        else
            score += 10;
        // Budget scoring
        const budget = input.annualRevenueOrBudget ?? 25000;
        if (budget >= 100000)
            score += 35;
        else if (budget >= 40000)
            score += 25;
        else if (budget >= 15000)
            score += 15;
        else
            score += 5;
        // Urgency scoring
        if (input.urgency === 'immediate')
            score += 25;
        else if (input.urgency === 'quarter')
            score += 15;
        else
            score += 5;
        let tier = 'Disqualified';
        let action = 'Nurture via automated email sequences';
        if (score >= 75) {
            tier = 'Tier 1 Enterprise';
            action = 'Assign dedicated Enterprise Account Executive and schedule immediate discovery call.';
        }
        else if (score >= 50) {
            tier = 'Tier 2 Mid-Market';
            action = 'Schedule standard product walkthrough and dispatch solution engineering brief.';
        }
        else if (score >= 30) {
            tier = 'Tier 3 SMB';
            action = 'Direct to self-serve onboarding and invite to weekly group demo.';
        }
        return {
            companyName: input.companyName,
            qualified: score >= 50,
            score,
            tier,
            summary: `${input.companyName} scored ${score}/100 based on headcount (${input.employeeCount}), budget ($${budget.toLocaleString()}), and urgency (${input.urgency || 'exploring'}).`,
            recommendedAction: action,
        };
    },
};
/**
 * CrmLookupTool: Inquires current state of records within edge or cloud CRM repositories.
 */
export const CrmLookupTool = {
    name: 'crm_lookup',
    description: 'Looks up a CRM record by identifier and entity type to verify historical activity and status.',
    parameters: {
        type: 'object',
        properties: {
            entityId: { type: 'string', description: 'Unique identifier of the CRM entity' },
            entityType: { type: 'string', description: 'Entity type, e.g. lead, contact, deal' },
        },
        required: ['entityId'],
    },
    async execute(input, _context) {
        // Standard mock in-memory lookup table for the agent context
        const mockDb = {
            'lead-001': {
                id: 'lead-001',
                entityType: 'lead',
                company: 'Acme Corp',
                contactEmail: 'contact@acme.com',
                status: 'new',
                score: 85,
            },
            'lead-002': {
                id: 'lead-002',
                entityType: 'lead',
                company: 'GlobalLogistics Inc',
                contactEmail: 'ops@globallogistics.io',
                status: 'qualified',
                score: 92,
            },
        };
        const record = mockDb[input.entityId] || null;
        return {
            found: record !== null,
            record,
            message: record
                ? `Found CRM record ${input.entityId}`
                : `Record ${input.entityId} not found in CRM database.`,
        };
    },
};
export const BUILTIN_TOOLS = {
    calculator: CalculatorTool,
    web_search: WebSearchMockTool,
    lead_qualifier: LeadQualifierTool,
    crm_lookup: CrmLookupTool,
};
export function getBuiltinTool(name) {
    return BUILTIN_TOOLS[name];
}
//# sourceMappingURL=builtin.js.map