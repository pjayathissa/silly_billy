import { describe, it, expect } from "vitest";
import {
  matchesTou,
  annualCost,
  currentAnnualCost,
  dailyProfile,
  rankPlans,
} from "../src/utils/analysis.js";

// ─── Helpers ─────────────────────────────────────────────────

/** Generate half-hourly consumption data for a given number of days. */
function generateData(days, kwhPerSlot = 0.5) {
  const data = [];
  const start = new Date("2025-03-03T00:00:00"); // Monday
  for (let d = 0; d < days; d++) {
    for (let slot = 0; slot < 48; slot++) {
      const ts = new Date(start.getTime() + d * 86400000 + slot * 1800000);
      data.push({ timestamp: ts, kwh: kwhPerSlot });
    }
  }
  return data;
}

/** Generate data with different kWh for specific hours. */
function generateDataWithProfile(days, hourlyKwh) {
  const data = [];
  const start = new Date("2025-03-03T00:00:00"); // Monday
  for (let d = 0; d < days; d++) {
    for (let slot = 0; slot < 48; slot++) {
      const ts = new Date(start.getTime() + d * 86400000 + slot * 1800000);
      const h = ts.getHours();
      data.push({ timestamp: ts, kwh: hourlyKwh[h] !== undefined ? hourlyKwh[h] : 0.5 });
    }
  }
  return data;
}

// ─── matchesTou ──────────────────────────────────────────────

describe("matchesTou", () => {
  it("matches a simple daytime range", () => {
    const tou = { startHour: 7, endHour: 21, days: [0, 1, 2, 3, 4, 5, 6] };
    expect(matchesTou(10, 1, tou)).toBe(true); // 10am Monday
    expect(matchesTou(7, 3, tou)).toBe(true);  // 7am Wednesday (inclusive)
    expect(matchesTou(21, 3, tou)).toBe(false); // 9pm (exclusive end)
    expect(matchesTou(3, 5, tou)).toBe(false);  // 3am Friday
  });

  it("handles overnight ranges (e.g. 21–7)", () => {
    const tou = { startHour: 21, endHour: 7, days: [0, 1, 2, 3, 4, 5, 6] };
    expect(matchesTou(22, 1, tou)).toBe(true);  // 10pm
    expect(matchesTou(0, 1, tou)).toBe(true);   // midnight
    expect(matchesTou(3, 1, tou)).toBe(true);   // 3am
    expect(matchesTou(6, 1, tou)).toBe(true);   // 6am
    expect(matchesTou(7, 1, tou)).toBe(false);  // 7am (exclusive end)
    expect(matchesTou(12, 1, tou)).toBe(false); // noon
  });

  it("handles short overnight ranges (e.g. 21–0 for 9pm–midnight)", () => {
    const tou = { startHour: 21, endHour: 0, days: [1, 2, 3, 4, 5] };
    expect(matchesTou(21, 1, tou)).toBe(true);  // 9pm Monday
    expect(matchesTou(22, 3, tou)).toBe(true);  // 10pm Wednesday
    expect(matchesTou(23, 5, tou)).toBe(true);  // 11pm Friday
    expect(matchesTou(0, 1, tou)).toBe(false);  // midnight (exclusive end)
    expect(matchesTou(20, 1, tou)).toBe(false); // 8pm
  });

  it("respects day-of-week restrictions", () => {
    const weekdayOnly = { startHour: 9, endHour: 17, days: [1, 2, 3, 4, 5] };
    expect(matchesTou(10, 1, weekdayOnly)).toBe(true);  // Monday
    expect(matchesTou(10, 0, weekdayOnly)).toBe(false);  // Sunday
    expect(matchesTou(10, 6, weekdayOnly)).toBe(false);  // Saturday
  });

  it("respects weekend-only restriction", () => {
    const weekendOnly = { startHour: 9, endHour: 17, days: [0, 6] };
    expect(matchesTou(10, 0, weekendOnly)).toBe(true);   // Sunday
    expect(matchesTou(10, 6, weekendOnly)).toBe(true);   // Saturday
    expect(matchesTou(10, 1, weekendOnly)).toBe(false);  // Monday
    expect(matchesTou(10, 5, weekendOnly)).toBe(false);  // Friday
  });

  it("returns false when startHour === endHour (zero-width window)", () => {
    const tou = { startHour: 12, endHour: 12, days: [0, 1, 2, 3, 4, 5, 6] };
    expect(matchesTou(12, 1, tou)).toBe(false);
    expect(matchesTou(0, 1, tou)).toBe(false);
  });
});

// ─── annualCost — flat rate plans ────────────────────────────

describe("annualCost — flat rate plans", () => {
  const flatPlan = {
    retailer: "Test",
    plan: "Flat",
    dailyCharge: 200, // 200 cents/day = $2/day
    rates: [{ name: "Anytime", centsPerKwh: 30 }],
  };

  it("calculates annual cost for flat rate plan", () => {
    const data = generateData(7); // 7 days, 0.5 kWh per slot
    const cost = annualCost(data, flatPlan);
    // Fixed: (200/100) * 365 = $730
    // Energy per reading: 0.5 * 30 / 100 = $0.15
    // Total energy: 7 * 48 * $0.15 = $50.40
    // Scale: 365 / ((last - first) in days) ≈ 365 / 6.979 ≈ 52.30
    // Annual energy ≈ $50.40 * 52.30 ≈ $2635.84
    // Total ≈ $3365.84
    expect(cost).toBeCloseTo(3365.84, 0);
  });

  it("returns 0 for less than 1 day of data", () => {
    const data = [
      { timestamp: new Date("2025-03-03T00:00:00"), kwh: 0.5 },
      { timestamp: new Date("2025-03-03T12:00:00"), kwh: 0.5 },
    ];
    expect(annualCost(data, flatPlan)).toBe(0);
  });
});

// ─── annualCost — time-of-use plans ─────────────────────────

describe("annualCost — time-of-use plans", () => {
  const touPlan = {
    retailer: "Test",
    plan: "TOU",
    dailyCharge: 200,
    rates: [
      { name: "Peak", centsPerKwh: 40, startHour: 7, endHour: 21 },
      { name: "Off-peak", centsPerKwh: 15, startHour: 21, endHour: 7 },
    ],
  };

  it("applies different rates for peak vs off-peak hours", () => {
    const data = generateData(7);
    const cost = annualCost(data, touPlan);

    // First rate (Peak 40c) is base since neither has undefined startHour.
    // Peak (7–21): 28 slots/day × 0.5 × 40c = 560c/day
    // Off-peak (21–7): 20 slots/day × 0.5 × 15c = 150c/day
    // Total energy 7 days: 7 * (560+150)/100 = $49.70
    // scaleFactor ≈ 365/6.979 ≈ 52.30, annual energy ≈ $49.70 * 52.30 ≈ $2599.24
    // Fixed: $730. Total ≈ $3329.24
    expect(cost).toBeCloseTo(3329.24, 0);
  });

  it("TOU plan is cheaper than flat when off-peak usage is high", () => {
    // Heavy night usage, light day usage
    const hourlyKwh = {};
    for (let h = 0; h < 24; h++) {
      hourlyKwh[h] = (h >= 21 || h < 7) ? 1.0 : 0.2;
    }
    const data = generateDataWithProfile(14, hourlyKwh);

    const flatPlan = {
      retailer: "Test",
      plan: "Flat",
      dailyCharge: 200,
      rates: [{ name: "Anytime", centsPerKwh: 30 }],
    };

    const flatCost = annualCost(data, flatPlan);
    const touCost = annualCost(data, touPlan);
    expect(touCost).toBeLessThan(flatCost);
  });
});

// ─── annualCost — Contact Good Weekends (day-of-week TOU) ───

describe("annualCost — Contact Good Weekends", () => {
  const goodWeekends = {
    retailer: "Contact",
    plan: "Good Weekends",
    type: "standard",
    dailyCharge: 240,
    rates: [
      {
        name: "Free (Sat–Sun 9am–5pm)",
        centsPerKwh: 0,
        startHour: 9,
        endHour: 17,
        daysOfWeek: [0, 6],
      },
      { name: "All other times", centsPerKwh: 34.0 },
    ],
  };

  it("charges $0 for weekend daytime usage", () => {
    // Generate 14 days starting Monday March 3, 2025
    // Sat = March 8, Sun = March 9, Sat = March 15, Sun = March 16
    const data = generateData(14);
    const cost = annualCost(data, goodWeekends);

    // Compare to same plan but without the free weekend period
    const noFreeWeekend = {
      ...goodWeekends,
      rates: [{ name: "All other times", centsPerKwh: 34.0 }],
    };
    const costNoFree = annualCost(data, noFreeWeekend);

    // Good Weekends should be cheaper because weekend 9am–5pm is free
    expect(cost).toBeLessThan(costNoFree);
  });

  it("weekend free period only applies Sat/Sun, not weekdays", () => {
    // Only weekday data (Mon-Fri), all at 10am (within 9-17 window)
    const data = [];
    const monday = new Date("2025-03-03T10:00:00");
    for (let d = 0; d < 5; d++) {
      // Mon through Fri
      const ts = new Date(monday.getTime() + d * 86400000);
      data.push({ timestamp: ts, kwh: 1.0 });
    }
    // Add enough span for annualCost to work (>1 day)
    const lastDay = new Date("2025-03-07T10:30:00");
    data.push({ timestamp: lastDay, kwh: 1.0 });

    const cost = annualCost(data, goodWeekends);

    // All readings are weekdays at 10am — should NOT get the free rate.
    // Base rate is 34c, so energy cost should be based on 34c, not 0.
    // If daysOfWeek is being ignored, weekday 10am would incorrectly get 0c.
    const fixedAnnual = (240 / 100) * 365; // $876
    expect(cost).toBeGreaterThan(fixedAnnual); // Must have energy cost > 0
  });

  it("calculates correct savings from free weekend period", () => {
    // All usage on Saturdays within the free window (9am–4:30pm, all hours < 17)
    const data = [];
    for (let w = 0; w < 4; w++) {
      // 4 Saturdays: March 8, 15, 22, 29
      const sat = new Date(2025, 2, 8 + w * 7, 9, 0, 0);
      for (let slot = 0; slot < 16; slot++) {
        // 9:00, 9:30, ..., 16:30 — all have hour < 17, inside free window
        const ts = new Date(sat.getTime() + slot * 1800000);
        data.push({ timestamp: ts, kwh: 1.0 });
      }
    }
    data.sort((a, b) => a.timestamp - b.timestamp);

    const cost = annualCost(data, goodWeekends);

    // All readings fall within the free period (Sat 9am–5pm, hour < 17)
    // Energy cost = 0. Only fixed cost remains: (240/100) * 365 = $876
    const expectedFixed = (240 / 100) * 365;
    expect(cost).toBeCloseTo(expectedFixed, 0);
  });
});

// ─── annualCost — Contact Good Nights (weekday-only TOU) ────

describe("annualCost — Contact Good Nights", () => {
  const goodNights = {
    retailer: "Contact",
    plan: "Good Nights",
    type: "standard",
    dailyCharge: 240,
    rates: [
      {
        name: "Free (Mon–Fri nights)",
        centsPerKwh: 0,
        startHour: 21,
        endHour: 0,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      { name: "All other times", centsPerKwh: 36.0 },
    ],
  };

  it("free period applies weekday evenings only", () => {
    // Wednesday at 10pm — should be free
    expect(
      matchesTou(22, 3, { startHour: 21, endHour: 0, days: [1, 2, 3, 4, 5] })
    ).toBe(true);

    // Saturday at 10pm — should NOT be free
    expect(
      matchesTou(22, 6, { startHour: 21, endHour: 0, days: [1, 2, 3, 4, 5] })
    ).toBe(false);

    // Sunday at 10pm — should NOT be free
    expect(
      matchesTou(22, 0, { startHour: 21, endHour: 0, days: [1, 2, 3, 4, 5] })
    ).toBe(false);
  });

  it("weekday night usage reduces cost compared to flat plan", () => {
    // Heavy evening usage pattern
    const hourlyKwh = {};
    for (let h = 0; h < 24; h++) {
      hourlyKwh[h] = (h >= 21) ? 2.0 : 0.3;
    }
    const data = generateDataWithProfile(14, hourlyKwh);

    const flatPlan = {
      retailer: "Test",
      plan: "Flat",
      dailyCharge: 240,
      rates: [{ name: "Anytime", centsPerKwh: 36.0 }],
    };

    const goodNightsCost = annualCost(data, goodNights);
    const flatCost = annualCost(data, flatPlan);

    // Good Nights should be cheaper because weekday 9pm-midnight is free
    expect(goodNightsCost).toBeLessThan(flatCost);
  });
});

// ─── annualCost — plan from tariffs.js ──────────────────────

describe("annualCost — Mercury TOU from tariffs database", () => {
  const mercuryTou = {
    retailer: "Mercury",
    plan: "Time of Use",
    type: "standard",
    dailyCharge: 269,
    rates: [
      { name: "Peak", centsPerKwh: 43.0, startHour: 7, endHour: 21 },
      { name: "Off-peak", centsPerKwh: 19.0, startHour: 21, endHour: 7 },
    ],
  };

  it("all hours are covered by either peak or off-peak", () => {
    for (let h = 0; h < 24; h++) {
      const isPeak = matchesTou(h, 1, { startHour: 7, endHour: 21, days: [0, 1, 2, 3, 4, 5, 6] });
      const isOffPeak = matchesTou(h, 1, { startHour: 21, endHour: 7, days: [0, 1, 2, 3, 4, 5, 6] });
      expect(isPeak || isOffPeak).toBe(true);
    }
  });

  it("returns a positive annual cost", () => {
    const data = generateData(7);
    const cost = annualCost(data, mercuryTou);
    expect(cost).toBeGreaterThan(0);
  });
});

// ─── currentAnnualCost ──────────────────────────────────────

describe("currentAnnualCost", () => {
  it("calculates flat rate cost correctly", () => {
    const data = generateData(7);
    const ct = { dailyCharge: 200, baseRate: 30, touRates: [] };
    const cost = currentAnnualCost(data, ct);
    // Same scaling as annualCost: scaleFactor ≈ 365/6.979 ≈ 52.30
    // Fixed: $730, energy ≈ $2635.84, total ≈ $3365.84
    expect(cost).toBeCloseTo(3365.84, 0);
  });

  it("applies TOU override rates", () => {
    const data = generateData(7);
    const ct = {
      dailyCharge: 200,
      baseRate: 30,
      touRates: [
        { rate: 15, startHour: 21, endHour: 7, days: [0, 1, 2, 3, 4, 5, 6] },
      ],
    };
    const flatCt = { dailyCharge: 200, baseRate: 30, touRates: [] };

    const touCost = currentAnnualCost(data, ct);
    const flatCost = currentAnnualCost(data, flatCt);

    // Off-peak rate (15c) < base rate (30c), so TOU should be cheaper
    expect(touCost).toBeLessThan(flatCost);
  });
});

// ─── dailyProfile ───────────────────────────────────────────

describe("dailyProfile", () => {
  it("returns 48 half-hour slots", () => {
    const data = generateData(7);
    const profile = dailyProfile(data);
    expect(profile).toHaveLength(48);
  });

  it("slot labels are correct", () => {
    const data = generateData(1);
    const profile = dailyProfile(data);
    expect(profile[0].hour).toBe("00:00");
    expect(profile[1].hour).toBe("00:30");
    expect(profile[24].hour).toBe("12:00");
    expect(profile[47].hour).toBe("23:30");
  });

  it("averages kWh correctly across days", () => {
    const data = generateData(7, 0.5);
    const profile = dailyProfile(data);
    // Every slot has 0.5 kWh across all 7 days, average = 0.5
    // dailyProfile multiplies by 2 to convert half-hourly kWh to hourly kWh rate
    for (const slot of profile) {
      expect(slot.kwh).toBeCloseTo(1.0, 3);
    }
  });
});

// ─── rankPlans ──────────────────────────────────────────────

describe("rankPlans", () => {
  it("returns plans sorted by estimated cost (ascending)", () => {
    const data = generateData(14);
    const currentCost = 5000;
    const ranked = rankPlans(data, currentCost);

    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].estimatedCost).toBeGreaterThanOrEqual(
        ranked[i - 1].estimatedCost
      );
    }
  });

  it("saving is currentCost minus estimatedCost", () => {
    const data = generateData(14);
    const currentCost = 5000;
    const ranked = rankPlans(data, currentCost);

    for (const plan of ranked) {
      expect(plan.saving).toBeCloseTo(currentCost - plan.estimatedCost, 2);
    }
  });

  it("includes all tariff plans", () => {
    const data = generateData(14);
    const ranked = rankPlans(data, 5000);
    // Should have all plans from tariffs.js
    expect(ranked.length).toBeGreaterThanOrEqual(10);
  });
});
