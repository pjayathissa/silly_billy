/**
 * Solar & Battery Economics — ROI models for two-way energy flows.
 *
 * Two analyses live here:
 *   1. batteryROI()  — for households ALREADY exporting solar (issue #36):
 *      models an 8 kWh battery that stores daytime export and discharges it
 *      against after-sunset load, then computes a discounted payback period.
 *   2. solarROI()    — for households WITHOUT solar (issue #37): models the
 *      generation of 5 / 8.5 / 10 kW systems against the user's actual load
 *      and computes a discounted payback period per scenario.
 *
 * All readings are { timestamp: Date, kwh: number, exportKwh: number }.
 * Monetary maths is done in cents and converted to dollars at the boundary.
 *
 * Generation and cost constants (researched May 2026) are NZ market averages
 * for modelling only — verify against quotes for a specific site. Sources:
 *   - Peak sun hours / daily curve: GridFree (NIWA SolarView-derived)
 *   - Yield per kW: Solar Scout (PVGIS), My Solar Quotes
 *   - Solar capex: My Solar Quotes, EECA, Solar Republic
 *   - Battery capex: Solar Scout, Electrify the Hutt, Tesla NZ
 */

import { matchesTou } from "./analysis.js";

// ─── Shared financial assumptions ───────────────────────────
// Real discount rate used for the time-value-of-money payback.
export const DISCOUNT_RATE = 0.05;

// ─── Loan assumptions (breakdown card) ──────────────────────
// Default bank-loan interest rate offered when financing a system, and the
// "green loan" intro deal common in NZ: 1% for the first three years, then the
// floating rate afterwards.
export const DEFAULT_LOAN_RATE = 0.05;
export const GREEN_LOAN_INTRO_RATE = 0.01;
export const GREEN_LOAN_INTRO_YEARS = 3;
// Horizon (years) over which we look for a discounted payback before giving up.
const PAYBACK_HORIZON_YEARS = 40;

// ─── Battery assumptions (issue #36) ────────────────────────
export const BATTERY_CAPACITY_KWH = 8;
export const BATTERY_COST_NZD = 10000;

// Minimum distinct calendar months of export data required to run the battery
// analysis. Fewer than this is treated as "only one season" and skipped.
const MIN_SOLAR_MONTHS = 5;
// A day counts as a "solar day" once its total export exceeds this (kWh).
const SOLAR_DAY_EXPORT_THRESHOLD = 0.1;

/**
 * Approximate sunset hour in NZ local clock time (includes daylight saving),
 * indexed by month 0–11 (Jan–Dec). Used to define "after sunset" load.
 * NZ latitude ~ -41°; midsummer sunset ~20:50 (NZDT), midwinter ~17:00 (NZST).
 */
const NZ_SUNSET_HOUR = [
  20.8, // Jan
  20.2, // Feb
  19.3, // Mar
  17.9, // Apr
  17.2, // May
  17.0, // Jun
  17.2, // Jul
  17.7, // Aug
  18.3, // Sep
  19.7, // Oct
  20.3, // Nov
  20.7, // Dec
];

// ─── Helpers ────────────────────────────────────────────────

/** Local-date key "YYYY-MM-DD". */
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Grid buy rate (cents/kWh) that applies to a reading, mirroring the
 * current-tariff cost model: the base rate unless a TOU window matches.
 */
export function gridRateForReading(timestamp, tariff) {
  const h = timestamp.getHours();
  const dow = timestamp.getDay();
  let rate = tariff.baseRate || 0;
  for (const tou of tariff.touRates || []) {
    if (matchesTou(h, dow, tou)) {
      rate = tou.rate;
      break;
    }
  }
  return rate;
}

/** Is this reading after sunset for its month? */
function isAfterSunset(timestamp) {
  const hourFloat = timestamp.getHours() + timestamp.getMinutes() / 60;
  return hourFloat >= NZ_SUNSET_HOUR[timestamp.getMonth()];
}

/** Span of a dataset in days (>= 1). */
function spanDays(data) {
  const first = data[0].timestamp.getTime();
  const last = data[data.length - 1].timestamp.getTime();
  return Math.max(1, (last - first) / 86400000);
}

/**
 * Discounted payback period in years for a one-off capex paid up front and a
 * level annual saving, using DISCOUNT_RATE. Returns a fractional year, or null
 * if the discounted savings never recover the capex within the horizon.
 */
export function discountedPayback(capex, annualSaving, rate = DISCOUNT_RATE) {
  if (annualSaving <= 0) return null;
  let cumulative = 0;
  for (let year = 1; year <= PAYBACK_HORIZON_YEARS; year++) {
    const pv = annualSaving / Math.pow(1 + rate, year);
    if (cumulative + pv >= capex) {
      // Linear interpolation within the year for a smoother figure.
      const remaining = capex - cumulative;
      return year - 1 + remaining / pv;
    }
    cumulative += pv;
  }
  return null;
}

// ─── Battery ROI (issue #36) ────────────────────────────────

/**
 * Model an 8 kWh battery for a household that already exports solar.
 *
 * For each day the battery charges from that day's export (up to remaining
 * capacity) and discharges against after-sunset load. Leftover charge carries
 * over to the next day. The saving on each discharged kWh is the difference
 * between the grid buy rate at the time of use and the export rate forgone.
 *
 * Returns:
 *   { applicable: false, reason }                       — not enough solar data
 *   { applicable: true, annualSaving, paybackYears,     — full result
 *     recommendation, ... }
 */
export function batteryROI(data, tariff, opts = {}) {
  const capacity = opts.capacityKwh ?? BATTERY_CAPACITY_KWH;
  const cost = opts.costNzd ?? BATTERY_COST_NZD;
  const exportRate = tariff.solarExportRate || 0;

  if (!data || data.length === 0) {
    return { applicable: false, reason: "No consumption data available." };
  }

  // Group readings by local date.
  const days = new Map();
  for (const d of data) {
    const k = dateKey(d.timestamp);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(d);
  }

  // Identify solar days (days with visible export) and their months.
  const solarMonths = new Set();
  let totalAnnualExport = 0;
  for (const [, readings] of days) {
    const dayExport = readings.reduce((s, r) => s + (r.exportKwh || 0), 0);
    if (dayExport > SOLAR_DAY_EXPORT_THRESHOLD) {
      const m = readings[0].timestamp.getMonth();
      solarMonths.add(m);
    }
  }

  if (solarMonths.size === 0) {
    return {
      applicable: false,
      reason: "No solar export was detected in your data, so a battery cannot time-shift exported energy.",
    };
  }

  if (solarMonths.size < MIN_SOLAR_MONTHS) {
    return {
      applicable: false,
      reason: `Your export data only covers ${solarMonths.size} month(s) — roughly one season. A full battery assessment needs export data spanning more of the year, so this analysis was skipped.`,
      monthsCovered: solarMonths.size,
    };
  }

  // Simulate chronologically, carrying battery charge across days.
  const sortedKeys = [...days.keys()].sort();
  let charge = 0;
  let savingCents = 0;
  let totalDischargeKwh = 0;

  for (const k of sortedKeys) {
    const readings = days.get(k).slice().sort((a, b) => a.timestamp - b.timestamp);

    // Charge from today's export, limited by remaining capacity.
    const dayExport = readings.reduce((s, r) => s + (r.exportKwh || 0), 0);
    totalAnnualExport += dayExport;
    charge = Math.min(capacity, charge + dayExport);

    // Discharge against after-sunset load, in time order.
    for (const r of readings) {
      if (charge <= 0) break;
      if (!isAfterSunset(r.timestamp)) continue;
      const load = r.kwh || 0;
      if (load <= 0) continue;
      const discharge = Math.min(charge, load);
      const gridRate = gridRateForReading(r.timestamp, tariff);
      savingCents += discharge * Math.max(0, gridRate - exportRate);
      charge -= discharge;
      totalDischargeKwh += discharge;
    }
  }

  // Annualise: scale the simulated saving to a single year. This averages
  // multiple years down to one and extrapolates a partial (but multi-season)
  // year up to a full year.
  const span = spanDays(data);
  const annualScale = 365 / span;
  const annualSaving = (savingCents / 100) * annualScale;
  const annualDischargeKwh = totalDischargeKwh * annualScale;

  const paybackYears = discountedPayback(cost, annualSaving);

  let recommendation;
  if (paybackYears != null && paybackYears < 15) {
    recommendation = "recommend";
  } else if (paybackYears != null && paybackYears < 20) {
    recommendation = "consider";
  } else {
    recommendation = "uneconomic";
  }

  return {
    applicable: true,
    capacityKwh: capacity,
    cost,
    exportRate,
    monthsCovered: solarMonths.size,
    annualExportKwh: totalAnnualExport * annualScale,
    annualDischargeKwh,
    annualSaving,
    paybackYears,
    recommendation,
  };
}

// ─── Solar installation ROI (issue #37) ─────────────────────
//
// Generation is modelled from an effective-sun-hours figure (kWh generated per
// kW of panels per day, already net of typical system losses) shaped across the
// daylight window with a half-sine curve peaking at solar noon. Figures are NZ
// averages; see SOLAR_DATA_LAST_UPDATED and the disclaimer surfaced in the UI.

// Sourced figures — see PR description for citations (researched May 2026
// from GridFree/NIWA SolarView, Solar Scout/PVGIS, My Solar Quotes, EECA).
export const SOLAR_DATA_LAST_UPDATED = "May 2026";

// Effective kWh generated per kW of installed panels per day, by month (Jan–Dec).
// Derived from Auckland-representative peak-sun-hours (NIWA-based) scaled by a
// ~0.87 performance ratio for system losses. Annual sum ≈ 1,350 kWh/kW/yr,
// in line with NZ regional figures (Auckland 1,391 / Wellington 1,431 /
// Christchurch 1,340 kWh/kW/yr). Intermediate months are interpolated.
const NZ_KWH_PER_KW_DAY = [
  4.87, // Jan (high summer)
  4.61, // Feb
  3.92, // Mar
  3.13, // Apr
  2.52, // May
  2.26, // Jun (low winter)
  2.44, // Jul
  2.96, // Aug
  3.65, // Sep
  4.26, // Oct
  4.70, // Nov
  5.13, // Dec
];

// Daylight generation window in local clock time [startHour, endHour] by month.
// NZ: summer ~06:00–20:30, winter ~08:00–17:00 (interpolated between).
const NZ_DAYLIGHT = [
  [6.0, 20.5], // Jan
  [6.4, 20.0], // Feb
  [7.0, 19.2], // Mar
  [7.3, 18.0], // Apr
  [7.6, 17.3], // May
  [8.0, 17.0], // Jun
  [7.9, 17.1], // Jul
  [7.4, 17.6], // Aug
  [6.8, 18.4], // Sep
  [6.3, 19.6], // Oct
  [5.9, 20.2], // Nov
  [5.8, 20.5], // Dec
];

// Installed (turn-key, incl. GST) capex in NZD by system size, 2025/26 NZ
// market midpoints (~$1,700–2,300/kW; larger systems cost less per kW).
export const SOLAR_SCENARIOS = [
  { sizeKw: 5, capex: 11000, label: "5 kW" },
  { sizeKw: 8.5, capex: 16500, label: "8.5 kW" },
  { sizeKw: 10, capex: 17500, label: "10 kW" },
];

/**
 * Per-month array of 48 half-hour generation weights that sum to 1, shaping the
 * daily generation across the daylight window with a half-sine curve.
 */
const MONTH_WEIGHTS = NZ_DAYLIGHT.map(([start, end]) => {
  const raw = [];
  let sum = 0;
  for (let slot = 0; slot < 48; slot++) {
    const h = slot / 2;
    let v = 0;
    if (h >= start && h < end) {
      v = Math.sin((Math.PI * (h - start)) / (end - start));
    }
    raw.push(v);
    sum += v;
  }
  return sum > 0 ? raw.map((v) => v / sum) : raw;
});

/** Modelled generation (kWh) for a reading and a system size. */
function generationForReading(timestamp, sizeKw) {
  const m = timestamp.getMonth();
  const slot = timestamp.getHours() * 2 + (timestamp.getMinutes() >= 30 ? 1 : 0);
  const dailyPerKw = NZ_KWH_PER_KW_DAY[m];
  return sizeKw * dailyPerKw * MONTH_WEIGHTS[m][slot];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Annuity factor: present value of $1/year for `years` years at `rate`. */
function annuityFactor(years, rate = DISCOUNT_RATE) {
  let f = 0;
  for (let t = 1; t <= years; t++) f += 1 / Math.pow(1 + rate, t);
  return f;
}

/**
 * Evaluate a single solar scenario against the user's load.
 * Returns per-scenario economics plus the modelled per-reading surplus export
 * (used for battery pairing).
 */
function evaluateScenario(data, tariff, scenario, annualScale) {
  const exportRate = tariff.solarExportRate || 0;
  let selfCents = 0;
  let exportCents = 0;
  let genKwh = 0;
  let surplusKwh = 0;
  // Synthetic post-solar profile for battery pairing.
  const synthetic = [];

  for (const r of data) {
    const load = r.kwh || 0;
    const gen = generationForReading(r.timestamp, scenario.sizeKw);
    genKwh += gen;

    const selfConsumed = Math.min(gen, load);
    const exported = Math.max(0, gen - load);
    const residualLoad = Math.max(0, load - gen);
    surplusKwh += exported;

    const gridRate = gridRateForReading(r.timestamp, tariff);
    selfCents += selfConsumed * gridRate;
    exportCents += exported * exportRate;

    synthetic.push({ timestamp: r.timestamp, kwh: residualLoad, exportKwh: exported });
  }

  const annualSaving = ((selfCents + exportCents) / 100) * annualScale;
  const paybackYears = discountedPayback(scenario.capex, annualSaving);

  return {
    ...scenario,
    annualSaving,
    annualGenerationKwh: genKwh * annualScale,
    annualSurplusKwh: surplusKwh * annualScale,
    paybackYears,
    synthetic,
  };
}

/**
 * Model 5 / 8.5 / 10 kW solar installations against the user's actual load,
 * pick the best scenario, and (per issue #37) test whether adding a battery
 * improves the economics further.
 */
export function solarROI(data, tariff) {
  if (!data || data.length === 0) {
    return { applicable: false, reason: "No consumption data available." };
  }

  const span = spanDays(data);
  const annualScale = 365 / span;

  // Load-weighted average grid rate, used for the load-shifting estimate.
  let loadKwh = 0;
  let loadRateCents = 0;
  for (const r of data) {
    const load = r.kwh || 0;
    loadKwh += load;
    loadRateCents += load * gridRateForReading(r.timestamp, tariff);
  }
  const annualLoadKwh = loadKwh * annualScale;
  const avgGridRate = loadKwh > 0 ? loadRateCents / loadKwh : tariff.baseRate || 0;
  const exportRate = tariff.solarExportRate || 0;

  const scenarios = SOLAR_SCENARIOS.map((s) =>
    evaluateScenario(data, tariff, s, annualScale)
  );

  // Best scenario: shortest discounted payback; fall back to highest saving.
  const withPayback = scenarios.filter((s) => s.paybackYears != null);
  const best = withPayback.length > 0
    ? withPayback.reduce((a, b) => (b.paybackYears < a.paybackYears ? b : a))
    : scenarios.reduce((a, b) => (b.annualSaving > a.annualSaving ? b : a));

  // Recommendation tiers from the best scenario's payback.
  let recommendation;
  let loadShift = null;
  const payback = best.paybackYears;

  if (payback != null && payback < 10) {
    recommendation = "recommend";
  } else if (payback != null && payback < 15) {
    recommendation = "marginal";
    // Extra annual saving needed to reach a 10-year discounted payback.
    const requiredAnnual = best.capex / annuityFactor(10);
    const deltaAnnual = requiredAnnual - best.annualSaving;
    const rateGap = Math.max(0, avgGridRate - exportRate); // cents/kWh gained per shifted kWh
    if (deltaAnnual > 0 && rateGap > 0) {
      const shiftKwh = (deltaAnnual * 100) / rateGap;
      // Cannot self-consume more than the surplus currently exported.
      const achievable = shiftKwh <= best.annualSurplusKwh;
      const pct = annualLoadKwh > 0 ? (shiftKwh / annualLoadKwh) * 100 : null;
      loadShift = {
        kwhPerYear: shiftKwh,
        percentOfLoad: pct,
        achievable,
      };
    }
  } else {
    recommendation = "uneconomic";
  }

  // Battery pairing: run the battery model on the best scenario's post-solar
  // export profile to see if it improves the economics further.
  let battery = batteryROI(best.synthetic, tariff);
  let combined = null;
  if (battery.applicable && battery.annualSaving > 0) {
    const combinedCapex = best.capex + battery.cost;
    const combinedAnnual = best.annualSaving + battery.annualSaving;
    combined = {
      capex: combinedCapex,
      annualSaving: combinedAnnual,
      paybackYears: discountedPayback(combinedCapex, combinedAnnual),
    };
  }
  // Strip the bulky synthetic arrays before returning.
  const cleanScenarios = scenarios.map((s) => {
    const copy = { ...s };
    delete copy.synthetic;
    return copy;
  });
  const { synthetic: _omit, ...cleanBest } = best;

  return {
    applicable: true,
    dataUpdated: SOLAR_DATA_LAST_UPDATED,
    annualLoadKwh,
    avgGridRate,
    exportRate,
    scenarios: cleanScenarios,
    best: cleanBest,
    recommendation,
    loadShift,
    battery: battery.applicable ? battery : null,
    combined,
  };
}

// ─── Detailed breakdown (UI "Solar Maths Breakdown" card) ───
//
// Models a single, user-customisable system size/cost against the actual load,
// broken down per calendar month, and presents the financing as a tangible
// bank loan rather than an abstract discount rate.

/**
 * Years to fully repay `principal` when serviced by a fixed `annualRepayment`,
 * with the outstanding balance accruing interest at `rateForYear(year)`.
 * The accounting identity (total repaid − principal = total interest) holds for
 * any rate schedule, so total interest is derived from the fractional term.
 * Returns { repaid: false } if the repayment never clears the balance.
 */
function loanTerm(principal, annualRepayment, rateForYear, maxYears = 60) {
  if (annualRepayment <= 0) {
    return { repaid: false, years: null, totalInterest: null };
  }
  let balance = principal;
  for (let y = 1; y <= maxYears; y++) {
    const accrued = balance * (1 + rateForYear(y));
    if (accrued <= annualRepayment) {
      const years = y - 1 + accrued / annualRepayment;
      return { repaid: true, years, totalInterest: annualRepayment * years - principal };
    }
    balance = accrued - annualRepayment;
  }
  return { repaid: false, years: null, totalInterest: null };
}

/**
 * Per-month, per-average-day breakdown of generation, consumption, solar self-
 * consumption and export for a given system size against the user's actual
 * load, plus a bank-loan view of the economics.
 *
 * opts: { sizeKw, capex, interestRate (decimal), greenLoan (bool) }.
 * Note that for every reading self-consumption + export equals generation, so
 * the per-day self and export columns always sum to the generation column.
 */
export function solarBreakdown(data, tariff, opts = {}) {
  if (!data || data.length === 0) return null;

  const sizeKw = opts.sizeKw;
  const capex = opts.capex;
  const floatingRate = opts.interestRate ?? DEFAULT_LOAN_RATE;
  const greenLoan = !!opts.greenLoan;
  const exportRate = opts.exportRate ?? (tariff.solarExportRate || 0);

  const span = spanDays(data);
  const annualScale = 365 / span;

  const genSum = new Array(12).fill(0);
  const loadSum = new Array(12).fill(0);
  const selfSum = new Array(12).fill(0);
  const exportSum = new Array(12).fill(0);
  const saveCents = new Array(12).fill(0);
  const dayKeys = Array.from({ length: 12 }, () => new Set());

  let selfCents = 0;
  let exportCents = 0;

  for (const r of data) {
    const m = r.timestamp.getMonth();
    const load = r.kwh || 0;
    const gen = generationForReading(r.timestamp, sizeKw);
    const selfConsumed = Math.min(gen, load);
    const exported = Math.max(0, gen - load);

    genSum[m] += gen;
    loadSum[m] += load;
    selfSum[m] += selfConsumed;
    exportSum[m] += exported;
    dayKeys[m].add(dateKey(r.timestamp));

    const selfValue = selfConsumed * gridRateForReading(r.timestamp, tariff);
    const exportValue = exported * exportRate;
    selfCents += selfValue;
    exportCents += exportValue;
    saveCents[m] += selfValue + exportValue;
  }

  const months = MONTH_NAMES.map((name, m) => {
    const days = dayKeys[m].size;
    const div = days > 0 ? days : 1;
    return {
      month: name,
      daysObserved: days,
      avgDailyGenerationKwh: genSum[m] / div,
      avgDailyConsumptionKwh: loadSum[m] / div,
      avgDailySelfKwh: selfSum[m] / div,
      avgDailyExportKwh: exportSum[m] / div,
      avgDailySavingsDollars: saveCents[m] / 100 / div,
    };
  });

  const selfConsumptionSaving = (selfCents / 100) * annualScale;
  const exportEarning = (exportCents / 100) * annualScale;
  const annualSaving = selfConsumptionSaving + exportEarning;
  const annualGenerationKwh = genSum.reduce((a, b) => a + b, 0) * annualScale;

  const rateForYear = greenLoan
    ? (y) => (y <= GREEN_LOAN_INTRO_YEARS ? GREEN_LOAN_INTRO_RATE : floatingRate)
    : () => floatingRate;
  const loan = {
    ...loanTerm(capex, annualSaving, rateForYear),
    floatingRate,
    greenLoan,
    annualRepayment: annualSaving,
  };

  return {
    sizeKw,
    capex,
    exportRate,
    selfConsumptionSaving,
    exportEarning,
    annualSaving,
    annualGenerationKwh,
    paybackYears: discountedPayback(capex, annualSaving),
    months,
    loan,
  };
}
