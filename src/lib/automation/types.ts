// ABCAC — automation decision engine: shared types.
//
// The engine sits in FRONT of the existing action handlers. It never writes to
// tables on a model's say-so: an auto/propose action is always a `StagedAction`
// whose `handler` must be a key in the registry whitelist (see registry.ts), so
// only pre-approved, audited write paths can ever run.

export type AutomationTier = "auto" | "propose" | "escalate";
export type ActorType = "human" | "system" | "agent";

/** A whitelisted write to perform now (auto) or on approval (propose). */
export interface StagedAction {
  handler: string; // MUST be a key in REGISTRY
  args: Record<string, unknown>;
}

/** Outcome of the deterministic rule pass (Postgres/TS — no model). */
export interface RuleResult {
  decisive: boolean; // true → the rule reached a clear outcome
  tier?: AutomationTier; // usually "auto"; set "escalate" to force a human
  action?: StagedAction;
  anomalies?: string[];
  ruleVersion: string;
  summary?: string;
}

/** Outcome of the agent (Claude) evaluation pass. */
export interface AgentEval {
  confidence: number; // 0..1
  action?: StagedAction;
  anomalies?: string[];
  modelVersion: string;
  summary?: string;
}

export interface DispatchInput {
  workflow: string;
  entityType: string;
  entityId?: string | null;
  memberId?: string | null;
}

export interface DispatchOutcome {
  status:
    | "skipped_disabled"
    | "skipped_paused"
    | "auto_executed"
    | "pending_approval"
    | "escalated"
    | "failed";
  runId?: string;
  tier?: AutomationTier;
  error?: string;
}

export interface WorkflowConfig {
  enabled: boolean;
  auto: number | null;
  propose: number | null;
}
