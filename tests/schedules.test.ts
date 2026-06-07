import { describe, it, expect } from "vitest";
import {
  addMonths,
  addDays,
  daysBetween,
  tierForDays,
  isExactReminderDay,
  computeDueFromExpiration,
  computeDueFromLastRenewal,
  REMINDER_TIER_DAYS,
} from "@/lib/schedules";
import type { CertSchedule } from "@/lib/schedules";

const schedule: CertSchedule = {
  credential_type: "CAC",
  renewal_cycle_months: 24,
  ceu_total_required: 40,
  ceu_ethics_required: 3,
  ceu_cultural_required: 3,
  grace_period_days: 30,
};

describe("date math", () => {
  it("addMonths advances by whole months", () => {
    expect(addMonths("2024-01-15", 24)).toBe("2026-01-15");
  });

  it("addMonths clamps day-of-month for short months", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // leap year
    expect(addMonths("2023-01-31", 1)).toBe("2023-02-28");
  });

  it("addDays advances by whole days across month boundaries", () => {
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01"); // leap year
  });

  it("daysBetween is positive for future, negative for past", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-01-31", "2026-01-01")).toBe(-30);
  });
});

describe("tierForDays", () => {
  it("maps thresholds to the right buckets", () => {
    expect(tierForDays(120)).toBe("ok");
    expect(tierForDays(90)).toBe("90-day");
    expect(tierForDays(61)).toBe("90-day");
    expect(tierForDays(60)).toBe("60-day");
    expect(tierForDays(31)).toBe("60-day");
    expect(tierForDays(30)).toBe("30-day");
    expect(tierForDays(8)).toBe("30-day");
    expect(tierForDays(7)).toBe("7-day");
    expect(tierForDays(1)).toBe("7-day");
    expect(tierForDays(0)).toBe("due");
    expect(tierForDays(-1)).toBe("overdue");
  });
});

describe("isExactReminderDay", () => {
  it("matches the configured reminder days", () => {
    for (const d of REMINDER_TIER_DAYS) {
      expect(isExactReminderDay(d)).toBe(true);
    }
    expect(isExactReminderDay(45)).toBe(false);
    expect(isExactReminderDay(0)).toBe(false);
  });
});

describe("computeDueFromExpiration", () => {
  it("uses expiration as the due date and computes days/tier", () => {
    const res = computeDueFromExpiration(schedule, "2026-09-05", "2026-06-07");
    expect(res.nextDueDate).toBe("2026-09-05");
    expect(res.daysUntilDue).toBe(daysBetween("2026-06-07", "2026-09-05"));
    expect(res.tier).toBe("90-day");
    expect(res.lapsed).toBe(false);
    expect(res.inGracePeriod).toBe(false);
  });

  it("flags grace period when past due but within grace window", () => {
    // due 2026-06-01, grace 30 days → grace end 2026-07-01; asOf 2026-06-15
    const res = computeDueFromExpiration(schedule, "2026-06-01", "2026-06-15");
    expect(res.daysUntilDue).toBeLessThan(0);
    expect(res.inGracePeriod).toBe(true);
    expect(res.lapsed).toBe(false);
    expect(res.tier).toBe("overdue");
  });

  it("flags lapsed once past the grace window", () => {
    const res = computeDueFromExpiration(schedule, "2026-06-01", "2026-08-01");
    expect(res.inGracePeriod).toBe(false);
    expect(res.lapsed).toBe(true);
  });
});

describe("computeDueFromLastRenewal", () => {
  it("projects forward by the renewal cycle", () => {
    const res = computeDueFromLastRenewal(schedule, "2024-06-07", "2026-06-07");
    expect(res.nextDueDate).toBe("2026-06-07");
    expect(res.daysUntilDue).toBe(0);
    expect(res.tier).toBe("due");
  });
});
