import { describe, it, expect } from "vitest";
import {
  niceCeil,
  axisTicks,
  formatCompact,
  formatMoneyCompact,
  donutSegments,
  seriesColor,
  SERIES_COLORS,
} from "@/components/agent/charts";

// ── niceCeil ─────────────────────────────────────────────────────────────────

describe("niceCeil", () => {
  it("returns 1 for zero", () => {
    expect(niceCeil(0)).toBe(1);
  });

  it("returns 1 for negative numbers", () => {
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(-1000)).toBe(1);
  });

  it("returns 1 for NaN", () => {
    expect(niceCeil(NaN)).toBe(1);
  });

  it("returns 1 for Infinity", () => {
    // Infinity is not finite
    expect(niceCeil(Infinity)).toBe(1);
  });

  it("rounds 44 up to 50", () => {
    expect(niceCeil(44)).toBe(50);
  });

  it("rounds 96 up to 100", () => {
    expect(niceCeil(96)).toBe(100);
  });

  it("niceCeil(58) is >= 58 and is a round number", () => {
    const result = niceCeil(58);
    expect(result).toBeGreaterThanOrEqual(58);
    // Should be 100 (norm=5.8 → nice=10 → 10*10=100)
    expect(result).toBe(100);
  });

  it("rounds 234000 up to 250000", () => {
    expect(niceCeil(234000)).toBe(250000);
  });

  it("returns 1 for input 1", () => {
    expect(niceCeil(1)).toBe(1);
  });

  it("result is always >= input for positive values", () => {
    const samples = [1, 2, 3, 5, 7, 9, 10, 11, 15, 21, 44, 50, 58, 96, 100, 101, 234000, 999999, 1_000_000];
    for (const n of samples) {
      expect(niceCeil(n)).toBeGreaterThanOrEqual(n);
    }
  });

  it("handles small decimals close to a boundary", () => {
    // 2.5 → norm=2.5, nice=2.5, mag=1 → 2.5
    expect(niceCeil(2.5)).toBe(2.5);
    // 2.6 → norm=2.6, nice=5, mag=1 → 5
    expect(niceCeil(2.6)).toBe(5);
  });

  it("handles exact power-of-10 inputs", () => {
    expect(niceCeil(10)).toBe(10);
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(1000)).toBe(1000);
  });
});

// ── axisTicks ─────────────────────────────────────────────────────────────────

describe("axisTicks", () => {
  it("returns steps+1 elements (default 6 ticks for steps=5)", () => {
    const ticks = axisTicks(100);
    expect(ticks).toHaveLength(6); // 0,20,40,60,80,100
  });

  it("first element is always 0", () => {
    expect(axisTicks(100)[0]).toBe(0);
    expect(axisTicks(500)[0]).toBe(0);
    expect(axisTicks(1)[0]).toBe(0);
  });

  it("last element equals niceCeil(max)", () => {
    expect(axisTicks(100).at(-1)).toBe(niceCeil(100));
    expect(axisTicks(44).at(-1)).toBe(niceCeil(44)); // 50
    expect(axisTicks(96).at(-1)).toBe(niceCeil(96)); // 100
  });

  it("ticks are strictly increasing", () => {
    const ticks = axisTicks(234000);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
    }
  });

  it("ticks are evenly spaced", () => {
    const ticks = axisTicks(100, 4); // 0, 25, 50, 75, 100
    const step = ticks[1] - ticks[0];
    for (let i = 2; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 10);
    }
  });

  it("respects custom steps parameter (steps=4 → 5 ticks)", () => {
    const ticks = axisTicks(100, 4);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBe(0);
    expect(ticks[4]).toBe(100);
  });

  it("works with steps=10 giving 11 ticks", () => {
    const ticks = axisTicks(50, 10);
    expect(ticks).toHaveLength(11);
    expect(ticks[0]).toBe(0);
    expect(ticks[10]).toBe(niceCeil(50));
  });

  it("produces sensible ticks for a large value", () => {
    const ticks = axisTicks(234000);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBe(250000);
    expect(ticks).toHaveLength(6);
  });
});

// ── formatCompact ─────────────────────────────────────────────────────────────

describe("formatCompact", () => {
  it("passes small numbers through as locale strings", () => {
    expect(formatCompact(318)).toBe("318");
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999)).toBe("999");
  });

  it("formats thousands below 10k with one decimal K suffix", () => {
    // 1247 < 10_000 → (1247/1000).toFixed(1) = "1.2" → "1.2K"
    expect(formatCompact(1247)).toBe("1.2K");
    // exact 1000 → "1.0".replace /\.0$/ → "1" → "1K"
    expect(formatCompact(1000)).toBe("1K");
    // 5500 → "5.5K"
    expect(formatCompact(5500)).toBe("5.5K");
  });

  it("formatCompact(214600) ends with K", () => {
    const result = formatCompact(214600);
    expect(result.endsWith("K")).toBe(true);
  });

  it("formats 10k and above as rounded K", () => {
    // 10000 → Math.round(10000/1000) = 10 → "10K"
    expect(formatCompact(10_000)).toBe("10K");
    // 214600 → Math.round(214600/1000) = 215 → "215K"
    expect(formatCompact(214_600)).toBe("215K");
    // 999499 → Math.round(999499/1000) = 999 → "999K"
    expect(formatCompact(999_499)).toBe("999K");
  });

  it("formatCompact(1_200_000) ends with M", () => {
    const result = formatCompact(1_200_000);
    expect(result.endsWith("M")).toBe(true);
  });

  it("formats millions with M suffix", () => {
    // 1_200_000 → (1.2M).toFixed(1) = "1.2" → "1.2M"
    expect(formatCompact(1_200_000)).toBe("1.2M");
    // 2_000_000 → "2.0".replace /\.0$/ → "2" → "2M"
    expect(formatCompact(2_000_000)).toBe("2M");
    // 5_500_000 → "5.5M"
    expect(formatCompact(5_500_000)).toBe("5.5M");
  });

  it("returns '0' for non-finite inputs", () => {
    expect(formatCompact(NaN)).toBe("0");
    expect(formatCompact(Infinity)).toBe("0");
    expect(formatCompact(-Infinity)).toBe("0");
  });
});

// ── formatMoneyCompact ────────────────────────────────────────────────────────

describe("formatMoneyCompact", () => {
  it("starts with $", () => {
    expect(formatMoneyCompact(0).startsWith("$")).toBe(true);
    expect(formatMoneyCompact(318).startsWith("$")).toBe(true);
    expect(formatMoneyCompact(1_200_000).startsWith("$")).toBe(true);
  });

  it("wraps formatCompact — result equals '$' + formatCompact(n)", () => {
    const samples = [0, 318, 1247, 214_600, 1_200_000];
    for (const n of samples) {
      expect(formatMoneyCompact(n)).toBe("$" + formatCompact(n));
    }
  });

  it("formatMoneyCompact(214600) === '$' + formatCompact(214600)", () => {
    expect(formatMoneyCompact(214_600)).toBe("$" + formatCompact(214_600));
  });
});

// ── seriesColor / SERIES_COLORS ───────────────────────────────────────────────

describe("seriesColor / SERIES_COLORS", () => {
  it("seriesColor(0) returns SERIES_COLORS[0]", () => {
    expect(seriesColor(0)).toBe(SERIES_COLORS[0]);
  });

  it("each index maps to the corresponding SERIES_COLORS entry", () => {
    for (let i = 0; i < SERIES_COLORS.length; i++) {
      expect(seriesColor(i)).toBe(SERIES_COLORS[i]);
    }
  });

  it("cycles modulo the palette length (wraps around)", () => {
    expect(seriesColor(SERIES_COLORS.length)).toBe(SERIES_COLORS[0]);
    expect(seriesColor(SERIES_COLORS.length + 1)).toBe(SERIES_COLORS[1]);
    expect(seriesColor(SERIES_COLORS.length * 2)).toBe(SERIES_COLORS[0]);
  });

  it("SERIES_COLORS is non-empty and contains hex-looking strings", () => {
    expect(SERIES_COLORS.length).toBeGreaterThan(0);
    for (const color of SERIES_COLORS) {
      expect(color.startsWith("#")).toBe(true);
    }
  });
});

// ── donutSegments ─────────────────────────────────────────────────────────────

describe("donutSegments", () => {
  const sampleData = [
    { label: "a", value: 50 },
    { label: "b", value: 30 },
    { label: "c", value: 20 },
  ];

  it("returns the same number of segments as input items", () => {
    const segs = donutSegments(sampleData);
    expect(segs).toHaveLength(3);
  });

  it("percent values sum to ~100", () => {
    const segs = donutSegments(sampleData);
    const total = segs.reduce((s, seg) => s + seg.percent, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("percent values are correct (50/30/20 split)", () => {
    const segs = donutSegments(sampleData);
    expect(segs[0].percent).toBeCloseTo(50, 5);
    expect(segs[1].percent).toBeCloseTo(30, 5);
    expect(segs[2].percent).toBeCloseTo(20, 5);
  });

  it("each segment color matches seriesColor(index)", () => {
    const segs = donutSegments(sampleData);
    segs.forEach((seg, i) => {
      expect(seg.color).toBe(seriesColor(i));
    });
  });

  it("dashArray is '<pct> <100-pct>'", () => {
    const segs = donutSegments(sampleData);
    segs.forEach((seg) => {
      const pct = seg.percent;
      expect(seg.dashArray).toBe(`${pct} ${100 - pct}`);
    });
  });

  it("dashOffset is a number", () => {
    const segs = donutSegments(sampleData);
    segs.forEach((seg) => {
      expect(typeof seg.dashOffset).toBe("number");
    });
  });

  it("first segment dashOffset is 25 (starts at 12 o'clock)", () => {
    const segs = donutSegments(sampleData);
    expect(segs[0].dashOffset).toBeCloseTo(25, 5);
  });

  it("label and value pass through correctly", () => {
    const segs = donutSegments(sampleData);
    expect(segs[0].label).toBe("a");
    expect(segs[0].value).toBe(50);
    expect(segs[1].label).toBe("b");
    expect(segs[2].label).toBe("c");
  });

  it("does not throw on empty array (returns [])", () => {
    expect(() => donutSegments([])).not.toThrow();
    expect(donutSegments([])).toEqual([]);
  });

  it("handles negative values by treating them as 0", () => {
    const data = [
      { label: "x", value: -10 },
      { label: "y", value: 100 },
    ];
    const segs = donutSegments(data);
    expect(segs[0].percent).toBeCloseTo(0, 5);
    expect(segs[1].percent).toBeCloseTo(100, 5);
  });

  it("handles single-element data (100%)", () => {
    const segs = donutSegments([{ label: "only", value: 42 }]);
    expect(segs[0].percent).toBeCloseTo(100, 5);
    expect(segs[0].dashArray).toBe(`100 0`);
  });

  it("cycles colors when more segments than SERIES_COLORS length", () => {
    const manyData = Array.from({ length: SERIES_COLORS.length + 2 }, (_, i) => ({
      label: `item${i}`,
      value: 1,
    }));
    const segs = donutSegments(manyData);
    expect(segs[SERIES_COLORS.length].color).toBe(SERIES_COLORS[0]);
    expect(segs[SERIES_COLORS.length + 1].color).toBe(SERIES_COLORS[1]);
  });
});
