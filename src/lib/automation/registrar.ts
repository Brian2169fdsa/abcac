// ABCAC — automation rule/agent REGISTRAR.
//
// Holds the workflow → evaluator maps and the register/get accessors. Extracted
// from dispatch.ts so workflow modules can register themselves (registerRule)
// WITHOUT importing dispatch.ts, which would create an import cycle
// (dispatch → workflows/index → dispatch). The registrar imports nothing from
// dispatch, so the graph stays acyclic: dispatch → registrar, workflows → registrar.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentEval, DispatchInput, RuleResult } from "./types";

export type RuleFn = (admin: SupabaseClient, input: DispatchInput) => Promise<RuleResult | null>;
export type AgentFn = (admin: SupabaseClient, input: DispatchInput) => Promise<AgentEval | null>;

const RULES: Record<string, RuleFn> = {};
const AGENTS: Record<string, AgentFn> = {};

export function registerRule(workflow: string, fn: RuleFn): void {
  RULES[workflow] = fn;
}
export function registerAgent(workflow: string, fn: AgentFn): void {
  AGENTS[workflow] = fn;
}
export function getRule(workflow: string): RuleFn | undefined {
  return RULES[workflow];
}
export function getAgent(workflow: string): AgentFn | undefined {
  return AGENTS[workflow];
}
