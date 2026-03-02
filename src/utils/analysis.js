/**
 * Analysis Engine — computes consumption profiles, insights, and plan comparisons.
 *
 * All data is an array of { timestamp: Date, kwh: number } sorted by time.
 */

import tariffs from "../tariffs.js";

// ─── Helpers ────────────────────────────────────────────────

/** Get hour (0–23) from a Date. */
const hour = (d) => d.getHours();

/** Get month (0–11) from a Date. */
const month = (d) => d.getMonth();

/** Summer months in NZ: November through March (months 10,11,0,1,2). */
const isSummer = (d) => [10, 11, 0, 1, 2].includes(month(d));

/** Is it a weekend? */
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

/** Get ISO week string for grouping. */
function weekKey(d) {
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

/** Format a date as "DD Mon YYYY". */
function formatDate(d) {
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Average Daily Profile ──────────────────────────────────

/**
 * Compute average kWh per half-hour slot (0–47) across the full dataset.
 * Returns array of { slot, hour: "HH:MM", kwh }.
 */
export function dailyProfile(data) {
  const buckets = Array.from({ length: 48 }, () => ({ total: 0, count: 0 }));

  for (const d of data) {
    const slot = d.timestamp.getHours() * 2 + (d.timestamp.getMinutes() >= 30 ? 1 : 0);
    buckets[slot].total += d.kwh;
    buckets[slot].count++;
  }

  return buckets.map((b, i) => ({
    slot: i,
    hour: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
    kwh: b.count > 0 ? Math.round((b.total / b.count) * 1000) / 1000 : 0,
  }));
}

// ─── Seasonal Profiles ──────────────────────────────────────

/**
 * Compute average daily profiles for summer and winter separately.
 * Returns { summer: [...], winter: [...] } with same shape as dailyProfile.
 */
export function seasonalProfiles(data) {
  const summer = Array.from({ length: 48 }, () => ({ total: 0, count: 0 }));
  const winter = Array.from({ length: 48 }, () => ({ total: 0, count: 0 }));

  for (const d of data) {
    const slot = d.timestamp.getHours() * 2 + (d.timestamp.getMinutes() >= 30 ? 1 : 0);
    const bucket = isSummer(d.timestamp) ? summer : winter;
    bucket[slot].total += d.kwh;
    bucket[slot].count++;
  }

  const format = (buckets) =>
    buckets.map((b, i) => ({
      slot: i,
      hour: `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
      kwh: b.count > 0 ? Math.round((b.total / b.count) * 1000) / 1000 : 0,
    }));

  return { summer: format(summer), winter: format(winter) };
}

// ─── Weekly Trend ───────────────────────────────────────────

/**
 * Compute total kWh per week. Returns array of { week, kwh }.
 */
export function weeklyTrend(data) {
  const weeks = {};
  for (const d of data) {
    const key = weekKey(d.timestamp);
    weeks[key] = (weeks[key] || 0) + d.kwh;
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, kwh]) => ({ week, kwh: Math.round(kwh * 10) / 10 }));
}

// ─── Insights ───────────────────────────────────────────────

/**
 * Generate bullet-point insights from the data and the user's current tariff.
 * currentTariff: { dailyCharge, peakRate, offPeakRate } in cents.
 */
export function generateInsights(data, currentTariff) {
  const insights = [];

  // 1. Nighttime baseload (midnight to 5am = slots 0–9)
  const nightReadings = data.filter((d) => hour(d.timestamp) >= 0 && hour(d.timestamp) < 5);
  const avgNightKwh = nightReadings.length > 0
    ? nightReadings.reduce((s, d) => s + d.kwh, 0) / nightReadings.length
    : 0;
  const nightBaseloadW = Math.round(avgNightKwh * 2 * 1000); // Convert half-hourly kWh to watts

  insights.push({
    type: "baseload",
    text: `Nighttime baseload (12am–5am): ${avgNightKwh.toFixed(3)} kWh per half hour (~${nightBaseloadW}W continuous).${nightBaseloadW > 500 ? " This is higher than typical — check for appliances left running overnight." : " This looks normal for a residential property."}`,
  });

  // 2. Seasonal variation
  const summerDays = {};
  const winterDays = {};
  for (const d of data) {
    const dayKey = d.timestamp.toISOString().slice(0, 10);
    const bucket = isSummer(d.timestamp) ? summerDays : winterDays;
    bucket[dayKey] = (bucket[dayKey] || 0) + d.kwh;
  }
  const avgSummerDay = Object.values(summerDays).length > 0
    ? Object.values(summerDays).reduce((a, b) => a + b, 0) / Object.values(summerDays).length
    : 0;
  const avgWinterDay = Object.values(winterDays).length > 0
    ? Object.values(winterDays).reduce((a, b) => a + b, 0) / Object.values(winterDays).length
    : 0;

  if (Object.keys(summerDays).length > 7 && Object.keys(winterDays).length > 7) {
    const diff = avgWinterDay - avgSummerDay;
    const pct = avgSummerDay > 0 ? Math.round((diff / avgSummerDay) * 100) : 0;
    insights.push({
      type: "seasonal",
      text: `Average daily consumption: ${avgSummerDay.toFixed(1)} kWh (summer) vs ${avgWinterDay.toFixed(1)} kWh (winter). Winter is ${diff > 0 ? `${diff.toFixed(1)} kWh higher (+${pct}%)` : `${Math.abs(diff).toFixed(1)} kWh lower`}, suggesting ${diff > 3 ? "significant heating costs — consider insulation or a heat pump if you don't already have one." : diff > 0 ? "moderate heating-related usage." : "minimal heating impact."}`,
    });

    if (diff > 0 && currentTariff.peakRate) {
      const heatingCostPerYear = (diff * 182 * currentTariff.peakRate) / 100; // 182 winter days
      insights.push({
        type: "seasonal_cost",
        text: `Estimated winter heating spend: ~$${heatingCostPerYear.toFixed(0)}/year based on the seasonal difference.`,
      });
    }
  }

  // 3. Spike detection — find days with consumption > 2× the average
  const dailyTotals = {};
  for (const d of data) {
    const dayKey = d.timestamp.toISOString().slice(0, 10);
    dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + d.kwh;
  }
  const allDays = Object.values(dailyTotals);
  const avgDaily = allDays.reduce((a, b) => a + b, 0) / allDays.length;
  const spikeDays = Object.entries(dailyTotals).filter(([, kwh]) => kwh > avgDaily * 2);

  if (spikeDays.length > 0) {
    const top3 = spikeDays.sort((a, b) => b[1] - a[1]).slice(0, 3);
    insights.push({
      type: "spikes",
      text: `${spikeDays.length} day(s) with unusually high consumption (>2× average). Highest: ${top3.map(([day, kwh]) => `${day} (${kwh.toFixed(1)} kWh)`).join(", ")}.`,
    });
  }

  // 4. Load-shifting savings opportunity
  if (currentTariff.peakRate && currentTariff.offPeakRate) {
    // Calculate how much daytime (7am–9pm) consumption could be shifted
    const peakData = data.filter((d) => hour(d.timestamp) >= 7 && hour(d.timestamp) < 21);
    const totalPeakKwh = peakData.reduce((s, d) => s + d.kwh, 0);

    // Assume 20% could be realistically shifted
    const shiftableKwh = totalPeakKwh * 0.2;
    const rateDiff = currentTariff.peakRate - currentTariff.offPeakRate;
    const daysInData = allDays.length;
    const annualSaving = (shiftableKwh / daysInData) * 365 * rateDiff / 100;

    if (annualSaving > 10) {
      insights.push({
        type: "load_shifting",
        text: `If you shifted ~20% of your daytime usage to off-peak hours (${Math.round(shiftableKwh / daysInData * 365)} kWh/year), you could save approximately $${annualSaving.toFixed(0)}/year at current rates.`,
      });
    }
  }

  // 5. EV charging detection — look for consistent high-draw periods at night
  const nightHigh = data.filter(
    (d) => hour(d.timestamp) >= 22 || hour(d.timestamp) < 5
  );
  const highNightReadings = nightHigh.filter((d) => d.kwh > 2.5);
  if (highNightReadings.length > nightHigh.length * 0.05) {
    insights.push({
      type: "ev",
      text: `Detected periodic high overnight consumption (>2.5 kWh/half-hour) — this pattern is consistent with EV charging. If you have an EV, a time-of-use plan could reduce charging costs significantly.`,
    });
  }

  // 6. Solar pattern detection — look for near-zero or negative midday readings
  const middayData = data.filter((d) => hour(d.timestamp) >= 10 && hour(d.timestamp) < 14);
  const lowMidday = middayData.filter((d) => d.kwh < 0.05);
  if (lowMidday.length > middayData.length * 0.3) {
    insights.push({
      type: "solar",
      text: `Your midday consumption is frequently near zero, suggesting solar generation is offsetting daytime usage. A plan with good export/buy-back rates could maximise your solar value.`,
    });
  }

  return insights;
}

// ─── Plan Comparison ────────────────────────────────────────

/**
 * Compute estimated annual cost for a given tariff plan using the actual consumption data.
 */
export function annualCost(data, plan) {
  // Calculate the date range to annualise
  const first = data[0].timestamp;
  const last = data[data.length - 1].timestamp;
  const days = (last - first) / (1000 * 60 * 60 * 24);
  if (days < 1) return 0;

  const scaleFactor = 365 / days;

  // Daily fixed charge
  const fixedCost = (plan.dailyCharge / 100) * 365;

  // Energy cost
  let energyCost = 0;

  // Check if this is the Contact "Good Weekends" plan (special handling)
  const isGoodWeekends = plan.retailer === "Contact" && plan.plan === "Good Weekends";

  for (const d of data) {
    let rate;

    if (isGoodWeekends) {
      rate = isWeekend(d.timestamp) ? 0 : plan.rates[0].centsPerKwh;
    } else if (plan.rates.length === 1) {
      // Flat rate
      rate = plan.rates[0].centsPerKwh;
    } else {
      // Time-of-use: find applicable rate
      const h = hour(d.timestamp);
      rate = plan.rates[0].centsPerKwh; // default to first rate
      for (const r of plan.rates) {
        if (r.startHour !== undefined && r.endHour !== undefined) {
          // Handle overnight ranges (e.g. 21–7)
          if (r.startHour > r.endHour) {
            if (h >= r.startHour || h < r.endHour) { rate = r.centsPerKwh; break; }
          } else {
            if (h >= r.startHour && h < r.endHour) { rate = r.centsPerKwh; break; }
          }
        }
      }
    }

    energyCost += (d.kwh * rate) / 100;
  }

  return Math.round((fixedCost + energyCost * scaleFactor) * 100) / 100;
}

/**
 * Compute estimated annual cost for the user's current tariff.
 * currentTariff: { dailyCharge, peakRate, offPeakRate, peakStart, peakEnd } in cents.
 */
export function currentAnnualCost(data, ct) {
  const first = data[0].timestamp;
  const last = data[data.length - 1].timestamp;
  const days = (last - first) / (1000 * 60 * 60 * 24);
  if (days < 1) return 0;

  const scaleFactor = 365 / days;
  const fixedCost = ((ct.dailyCharge || 0) / 100) * 365;

  let energyCost = 0;
  for (const d of data) {
    const h = hour(d.timestamp);
    let rate = ct.peakRate || 0;

    // If off-peak rate is set and we have peak hours, use TOU logic
    if (ct.offPeakRate && ct.peakStart !== undefined && ct.peakEnd !== undefined) {
      const start = ct.peakStart;
      const end = ct.peakEnd;
      if (start > end) {
        rate = (h >= start || h < end) ? ct.peakRate : ct.offPeakRate;
      } else {
        rate = (h >= start && h < end) ? ct.peakRate : ct.offPeakRate;
      }
    }

    energyCost += (d.kwh * rate) / 100;
  }

  return Math.round((fixedCost + energyCost * scaleFactor) * 100) / 100;
}

/**
 * Rank all tariff plans by estimated annual cost.
 * Returns array of { ...plan, estimatedCost, saving } sorted by saving (desc).
 */
export function rankPlans(data, currentCost) {
  return tariffs
    .map((plan) => {
      const cost = annualCost(data, plan);
      return { ...plan, estimatedCost: cost, saving: Math.round((currentCost - cost) * 100) / 100 };
    })
    .sort((a, b) => a.estimatedCost - b.estimatedCost);
}
