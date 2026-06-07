export const REQUIRED_TOTAL = 40;
export const REQUIRED_ETHICS = 3;
export const REQUIRED_CULTURAL = 3;

export interface CeuLike {
  hours: number | null;
  category: string | null;
  status: string | null;
}

/**
 * Per-credential CEU requirements. Shape is a subset of a cert_schedules row
 * (see migration 016 / src/lib/schedules.ts CertSchedule). When omitted, the
 * ABCAC defaults of 40 total / 3 ethics / 3 cultural apply so existing callers
 * and tests keep their behavior.
 */
export interface CeuRequirements {
  total: number;
  ethics: number;
  cultural: number;
}

export const DEFAULT_REQUIREMENTS: CeuRequirements = {
  total: REQUIRED_TOTAL,
  ethics: REQUIRED_ETHICS,
  cultural: REQUIRED_CULTURAL,
};

/**
 * Build a CeuRequirements from a cert_schedules-like row (the column names used
 * by migration 016). Falls back to the ABCAC defaults for any missing field.
 */
export function requirementsFromSchedule(
  schedule:
    | {
        ceu_total_required?: number | null;
        ceu_ethics_required?: number | null;
        ceu_cultural_required?: number | null;
      }
    | null
    | undefined,
): CeuRequirements {
  if (!schedule) return DEFAULT_REQUIREMENTS;
  return {
    total: schedule.ceu_total_required ?? REQUIRED_TOTAL,
    ethics: schedule.ceu_ethics_required ?? REQUIRED_ETHICS,
    cultural: schedule.ceu_cultural_required ?? REQUIRED_CULTURAL,
  };
}

export interface ComplianceResult {
  totalApproved: number;
  ethics: number;
  cultural: number;
  remaining: number;
  ethicsRemaining: number;
  culturalRemaining: number;
  percent: number;
  compliant: boolean;
  /** The requirements this result was computed against (echoed for the UI). */
  requiredTotal: number;
  requiredEthics: number;
  requiredCultural: number;
}

/**
 * Compute CEU renewal compliance.
 *
 * @param records   the member's CEU records (only `status === "approved"` count).
 * @param requirements optional per-credential requirements (from cert_schedules).
 *                  Defaults to 40 / 3 / 3 when omitted — keeps existing callers
 *                  and tests passing.
 */
export function computeCompliance(
  records: CeuLike[],
  requirements: CeuRequirements = DEFAULT_REQUIREMENTS,
): ComplianceResult {
  const reqTotal = requirements.total;
  const reqEthics = requirements.ethics;
  const reqCultural = requirements.cultural;

  const approved = records.filter((r) => r.status === "approved");

  const totalApproved = approved.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const ethics = approved
    .filter((r) => r.category === "Ethics")
    .reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const cultural = approved
    .filter((r) => r.category === "Cultural Diversity")
    .reduce((s, r) => s + Number(r.hours ?? 0), 0);

  const remaining = Math.max(0, reqTotal - totalApproved);
  const ethicsRemaining = Math.max(0, reqEthics - ethics);
  const culturalRemaining = Math.max(0, reqCultural - cultural);
  const percent =
    reqTotal > 0 ? Math.min(100, Math.round((totalApproved / reqTotal) * 100)) : 100;
  const compliant =
    totalApproved >= reqTotal && ethics >= reqEthics && cultural >= reqCultural;

  return {
    totalApproved,
    ethics,
    cultural,
    remaining,
    ethicsRemaining,
    culturalRemaining,
    percent,
    compliant,
    requiredTotal: reqTotal,
    requiredEthics: reqEthics,
    requiredCultural: reqCultural,
  };
}
