export const REQUIRED_TOTAL = 40;
export const REQUIRED_ETHICS = 3;
export const REQUIRED_CULTURAL = 3;

export interface CeuLike {
  hours: number | null;
  category: string | null;
  status: string | null;
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
}

export function computeCompliance(records: CeuLike[]): ComplianceResult {
  const approved = records.filter((r) => r.status === "approved");

  const totalApproved = approved.reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const ethics = approved
    .filter((r) => r.category === "Ethics")
    .reduce((s, r) => s + Number(r.hours ?? 0), 0);
  const cultural = approved
    .filter((r) => r.category === "Cultural Diversity")
    .reduce((s, r) => s + Number(r.hours ?? 0), 0);

  const remaining = Math.max(0, REQUIRED_TOTAL - totalApproved);
  const ethicsRemaining = Math.max(0, REQUIRED_ETHICS - ethics);
  const culturalRemaining = Math.max(0, REQUIRED_CULTURAL - cultural);
  const percent = Math.min(100, Math.round((totalApproved / REQUIRED_TOTAL) * 100));
  const compliant =
    totalApproved >= REQUIRED_TOTAL && ethics >= REQUIRED_ETHICS && cultural >= REQUIRED_CULTURAL;

  return {
    totalApproved,
    ethics,
    cultural,
    remaining,
    ethicsRemaining,
    culturalRemaining,
    percent,
    compliant,
  };
}
