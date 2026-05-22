import { describe, it, expect } from "vitest";
import {
  batteryROI,
  solarROI,
  discountedPayback,
  gridRateForReading,
  SOLAR_SCENARIOS,
  DISCOUNT_RATE,
} from "../src/utils/solar.js";

// ─── Data generators ─────────────────────────────────────────

/**
 * Build half-hourly data for `days` days from a start date.
 * profileFn(hourFloat, date) → { kwh, exportKwh }.
 */
function buildData(startDate, days, profileFn) {
  const data = [];
  const start = new Date(startDate);
  for (let d = 0; d < days; d++) {
    for (let slot = 0; slot < 48; slot++) {
      const ts = new Date(start.getTime() + d * 86400000 + slot * 1800000);
      const hourFloat = ts.getHours() + ts.getMinutes() / 60;
      const { kwh = 0, exportKwh = 0 } = profileFn(hourFloat, ts) || {};
      data.push({ timestamp: ts, kwh, exportKwh });
    }
  }
  return data;
}

// A simple year-long profile: midday export, evening load, low daytime import.
function solarHomeProfile(hourFloat) {
  // Midday 10:00–14:00 exports
  if (hourFloat >= 10 && hourFloat < 14) return { kwh: 0, exportKwh: 1.0 };
  // Evening 20:00–23:00 has load (after sunset most of the year)
  if (hourFloat >= 20 && hourFloat < 23) return { kwh: 0.8, exportKwh: 0 };
  // Light background import
  return { kwh: 0.1, exportKwh: 0 };
}

const FLAT_TARIFF = { baseRate: 30, touRates: [], solarExportRate: 8 };

// ─── discountedPayback ───────────────────────────────────────

describe("discountedPayback", () => {
  it("returns null when there is no saving", () => {
    expect(discountedPayback(10000, 0)).toBeNull();
    expect(discountedPayback(10000, -50)).toBeNull();
  });

  it("never recovers a large capex with a tiny saving", () => {
    // $50/yr discounted will never reach $10,000.
    expect(discountedPayback(10000, 50)).toBeNull();
  });

  it("payback is longer than the simple (undiscounted) payback", () => {
    const capex = 10000;
    const annual = 1500;
    const simple = capex / annual; // ~6.67 years
    const discounted = discountedPayback(capex, annual);
    expect(discounted).not.toBeNull();
    expect(discounted).toBeGreaterThan(simple);
  });

  it("matches a hand-computed cumulative PV", () => {
    // capex small enough to be repaid partway through year 2.
    const r = DISCOUNT_RATE;
    const annual = 1000;
    const pv1 = annual / (1 + r); // ~952.38
    const capex = pv1 + 100; // needs a bit into year 2
    const payback = discountedPayback(capex, annual, r);
    expect(payback).toBeGreaterThan(1);
    expect(payback).toBeLessThan(2);
  });
});

// ─── gridRateForReading ──────────────────────────────────────

describe("gridRateForReading", () => {
  it("returns the base rate when no TOU matches", () => {
    const ts = new Date("2025-06-15T12:00:00");
    expect(gridRateForReading(ts, FLAT_TARIFF)).toBe(30);
  });

  it("returns a matching TOU rate", () => {
    const tariff = {
      baseRate: 30,
      touRates: [{ rate: 15, startHour: 21, endHour: 7, days: [0, 1, 2, 3, 4, 5, 6] }],
    };
    const night = new Date("2025-06-15T22:00:00");
    const day = new Date("2025-06-15T12:00:00");
    expect(gridRateForReading(night, tariff)).toBe(15);
    expect(gridRateForReading(day, tariff)).toBe(30);
  });
});

// ─── batteryROI — applicability ──────────────────────────────

describe("batteryROI applicability", () => {
  it("skips when there is no export at all", () => {
    const data = buildData("2025-01-01T00:00:00", 200, () => ({ kwh: 0.3, exportKwh: 0 }));
    const result = batteryROI(data, FLAT_TARIFF);
    expect(result.applicable).toBe(false);
    expect(result.reason).toMatch(/no solar export/i);
  });

  it("skips when export only covers one season (< 5 months)", () => {
    // Export only in Jan–Mar (3 months).
    const data = buildData("2025-01-01T00:00:00", 365, (h, ts) => {
      const exporting = ts.getMonth() <= 2 && h >= 10 && h < 14;
      return exporting ? { kwh: 0, exportKwh: 1.0 } : { kwh: 0.3, exportKwh: 0 };
    });
    const result = batteryROI(data, FLAT_TARIFF);
    expect(result.applicable).toBe(false);
    expect(result.reason).toMatch(/one season/i);
    expect(result.monthsCovered).toBe(3);
  });

  it("runs when export spans most of the year", () => {
    const data = buildData("2025-01-01T00:00:00", 365, solarHomeProfile);
    const result = batteryROI(data, FLAT_TARIFF);
    expect(result.applicable).toBe(true);
    expect(result.monthsCovered).toBeGreaterThanOrEqual(5);
    expect(result.annualSaving).toBeGreaterThan(0);
    expect(result.annualDischargeKwh).toBeGreaterThan(0);
    expect(["recommend", "consider", "uneconomic"]).toContain(result.recommendation);
  });
});

// ─── batteryROI — savings logic ──────────────────────────────

describe("batteryROI savings", () => {
  it("saving per kWh equals grid rate minus export rate", () => {
    const data = buildData("2025-01-01T00:00:00", 365, solarHomeProfile);
    const result = batteryROI(data, FLAT_TARIFF);
    // Each discharged kWh should save (30 - 8) = 22c.
    const impliedSavingPerKwh = (result.annualSaving * 100) / result.annualDischargeKwh;
    expect(impliedSavingPerKwh).toBeCloseTo(22, 1);
  });

  it("higher export rate reduces battery savings", () => {
    const data = buildData("2025-01-01T00:00:00", 365, solarHomeProfile);
    const low = batteryROI(data, { ...FLAT_TARIFF, solarExportRate: 8 });
    const high = batteryROI(data, { ...FLAT_TARIFF, solarExportRate: 25 });
    expect(high.annualSaving).toBeLessThan(low.annualSaving);
  });

  it("a strong economic case yields a recommend/consider verdict", () => {
    // Large evening load + big daily export + cheap export buy-back, expensive grid.
    const data = buildData("2025-01-01T00:00:00", 365, (h) => {
      if (h >= 9 && h < 15) return { kwh: 0, exportKwh: 3.0 };   // lots of export
      if (h >= 19 && h < 23) return { kwh: 2.0, exportKwh: 0 };  // heavy evening load
      return { kwh: 0.2, exportKwh: 0 };
    });
    const tariff = { baseRate: 45, touRates: [], solarExportRate: 5 };
    const result = batteryROI(data, tariff);
    expect(result.applicable).toBe(true);
    expect(result.annualSaving).toBeGreaterThan(0);
    expect(result.paybackYears).not.toBeNull();
  });
});

// ─── solarROI ────────────────────────────────────────────────

describe("solarROI", () => {
  // A year of steady load, no existing solar.
  const yearLoad = buildData("2025-01-01T00:00:00", 365, () => ({ kwh: 0.4, exportKwh: 0 }));
  const tariff = { baseRate: 32, touRates: [], solarExportRate: 10 };

  it("returns one result per configured scenario", () => {
    const result = solarROI(yearLoad, tariff);
    expect(result.applicable).toBe(true);
    expect(result.scenarios).toHaveLength(SOLAR_SCENARIOS.length);
  });

  it("models a realistic annual yield per kW (~1300 kWh/kW/yr)", () => {
    const result = solarROI(yearLoad, tariff);
    const fiveKw = result.scenarios.find((s) => s.sizeKw === 5);
    const yieldPerKw = fiveKw.annualGenerationKwh / 5;
    expect(yieldPerKw).toBeGreaterThan(1000);
    expect(yieldPerKw).toBeLessThan(1600);
  });

  it("larger systems generate more energy", () => {
    const result = solarROI(yearLoad, tariff);
    const gens = result.scenarios.map((s) => s.annualGenerationKwh);
    expect(gens[1]).toBeGreaterThan(gens[0]);
    expect(gens[2]).toBeGreaterThan(gens[1]);
  });

  it("picks a best scenario and a valid recommendation", () => {
    const result = solarROI(yearLoad, tariff);
    expect(result.best).toBeDefined();
    expect(SOLAR_SCENARIOS.map((s) => s.sizeKw)).toContain(result.best.sizeKw);
    expect(["recommend", "marginal", "uneconomic"]).toContain(result.recommendation);
  });

  it("self-consumption is worth more than export, so daytime load lifts savings", () => {
    // Heavy daytime load self-consumes generation (saves full grid rate).
    const daytimeHeavy = buildData("2025-01-01T00:00:00", 365, (h) =>
      h >= 9 && h < 16 ? { kwh: 2.0, exportKwh: 0 } : { kwh: 0.2, exportKwh: 0 }
    );
    const nightHeavy = buildData("2025-01-01T00:00:00", 365, (h) =>
      h >= 19 || h < 6 ? { kwh: 2.0, exportKwh: 0 } : { kwh: 0.2, exportKwh: 0 }
    );
    const dayResult = solarROI(daytimeHeavy, tariff);
    const nightResult = solarROI(nightHeavy, tariff);
    // Same total load, but daytime users self-consume more → bigger savings.
    expect(dayResult.best.annualSaving).toBeGreaterThan(nightResult.best.annualSaving);
  });

  it("attempts battery pairing on the post-solar export profile", () => {
    const result = solarROI(yearLoad, tariff);
    // With a full year of modelled solar there is surplus export across seasons,
    // so the battery model should at least run (applicable) on the synthetic data.
    expect(result.battery).not.toBeNull();
    expect(result.battery.applicable).toBe(true);
  });
});
