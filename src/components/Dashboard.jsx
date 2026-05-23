import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import {
  dailyProfile, seasonalProfiles, weeklyTrend,
  generateInsights, currentAnnualCost, rankPlans,
} from "../utils/analysis.js";
import { batteryROI, solarROI, solarBreakdown, DISCOUNT_RATE, DEFAULT_LOAN_RATE, GREEN_LOAN_INTRO_RATE, GREEN_LOAN_INTRO_YEARS } from "../utils/solar.js";
import { tariffsLastUpdated } from "../tariffs.js";
import StepIndicator from "./StepIndicator.jsx";

// Palette of semi-transparent colours for TOU background bands
const TOU_COLORS = [
  "rgba(249, 115, 22, 0.13)",  // orange
  "rgba(139, 92, 246, 0.13)",  // purple
  "rgba(20, 184, 166, 0.13)",  // teal
  "rgba(236, 72, 153, 0.13)",  // pink
];

const TOU_STROKE_COLORS = [
  "#f97316",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Convert an hour number (0–23) to the "HH:00" format used as the x-axis dataKey.
 */
function hourToKey(h) {
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * Build <ReferenceArea> elements for the TOU rates.
 * Each TOU band spans from startHour to endHour on the half-hour x-axis.
 * Overnight ranges (e.g. 21–7) are split into two bands: start→23:30 and 00:00→end.
 */
function touReferenceAreas(touRates) {
  if (!touRates || touRates.length === 0) return null;

  const areas = [];
  touRates.forEach((tou, idx) => {
    const color = TOU_COLORS[idx % TOU_COLORS.length];
    const stroke = TOU_STROKE_COLORS[idx % TOU_STROKE_COLORS.length];
    const daysLabel = tou.days.length === 7
      ? "All days"
      : tou.days.map((d) => DAY_NAMES[d]).join(", ");
    const label = `${tou.rate}c — ${daysLabel}`;

    const startKey = hourToKey(tou.startHour);
    const endKey = hourToKey(tou.endHour);

    if (tou.startHour < tou.endHour) {
      // Normal range (e.g. 7–21)
      areas.push(
        <ReferenceArea
          key={`tou-${idx}`}
          x1={startKey}
          x2={endKey}
          fill={color}
          stroke={stroke}
          strokeOpacity={0.3}
          label={{ value: label, position: "insideTop", fontSize: 11, fill: stroke }}
        />
      );
    } else if (tou.startHour > tou.endHour) {
      // Overnight range (e.g. 21–7) → split into two bands
      areas.push(
        <ReferenceArea
          key={`tou-${idx}-a`}
          x1={startKey}
          x2="23:30"
          fill={color}
          stroke={stroke}
          strokeOpacity={0.3}
          label={{ value: label, position: "insideTop", fontSize: 11, fill: stroke }}
        />
      );
      areas.push(
        <ReferenceArea
          key={`tou-${idx}-b`}
          x1="00:00"
          x2={endKey}
          fill={color}
          stroke={stroke}
          strokeOpacity={0.3}
        />
      );
    }
  });
  return areas;
}

/**
 * Main analysis dashboard — charts, insights, and plan comparison table.
 */
export default function Dashboard({ data, currentTariff, onStepClick }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const [nightEv, setNightEv] = useState(false);
  const [nightHotWater, setNightHotWater] = useState(false);
  const [nightBattery, setNightBattery] = useState(false);

  const nightLoadOptions = {
    ev: nightEv,
    hotWater: nightHotWater,
    battery: nightBattery,
  };

  const profile = dailyProfile(data);
  const seasonal = seasonalProfiles(data);
  const weekly = weeklyTrend(data);
  const myCost = currentAnnualCost(data, currentTariff);
  const insights = generateInsights(data, currentTariff, nightLoadOptions);
  const plans = rankPlans(data, myCost);

  // Two-way energy flows: households already exporting solar get a battery
  // assessment (issue #36); everyone else gets a "should I install solar?"
  // assessment (issue #37).
  const totalExportKwh = data.reduce((s, d) => s + (d.exportKwh || 0), 0);
  const hasSolar = totalExportKwh > 1;
  const battery = hasSolar ? batteryROI(data, currentTariff) : null;
  const solar = hasSolar ? null : solarROI(data, currentTariff);

  // Customisable inputs for the detailed breakdown card. Empty string means
  // "use the recommended default" (best scenario size/cost, default loan rate).
  const [sizeInput, setSizeInput] = useState("");
  const [capexInput, setCapexInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [exportInput, setExportInput] = useState("");
  const [greenLoan, setGreenLoan] = useState(false);

  const defaultExportRate = currentTariff.solarExportRate || 0;
  const breakdownSizeKw = sizeInput !== "" ? Number(sizeInput) : solar?.best?.sizeKw;
  const breakdownCapex = capexInput !== "" ? Number(capexInput) : solar?.best?.capex;
  const breakdownRate = rateInput !== "" ? Number(rateInput) / 100 : DEFAULT_LOAN_RATE;
  const breakdownExportRate = exportInput !== "" ? Number(exportInput) : defaultExportRate;
  // A custom row is shown in the comparison table when the system or export
  // assumptions (the things that move the table's columns) have been changed.
  const breakdownCustomised = sizeInput !== "" || capexInput !== "" || exportInput !== "";
  const breakdown = useMemo(() => {
    if (!solar || !solar.applicable) return null;
    return solarBreakdown(data, currentTariff, {
      sizeKw: breakdownSizeKw,
      capex: breakdownCapex,
      interestRate: breakdownRate,
      exportRate: breakdownExportRate,
      greenLoan,
    });
  }, [solar, data, currentTariff, breakdownSizeKw, breakdownCapex, breakdownRate, breakdownExportRate, greenLoan]);

  // Merge seasonal data for the overlay chart
  const seasonalMerged = profile.map((_, i) => ({
    hour: seasonal.summer[i].hour,
    summer: seasonal.summer[i].kwh,
    winter: seasonal.winter[i].kwh,
  }));

  // Only show every 4th x-axis label to avoid crowding
  const tickFilter = (_, i) => i % 4 === 0;

  const touAreas = touReferenceAreas(currentTariff.touRates);

  return (
    <div className="dashboard">
      <div className="dash-header">
        <h2>Analysis Dashboard</h2>
        <p className="dash-subtitle">
          {data.length.toLocaleString()} readings analysed.
          Estimated annual cost: <strong>${myCost.toLocaleString()}</strong>
        </p>
        <StepIndicator currentStep="dashboard" onStepClick={onStepClick} />
      </div>

      <div className="dash-content">
        {/* ── Average Daily Profile ── */}
        <section className="chart-section card-coral">
          <h3>Average Daily Consumption Profile</h3>
          <p className="chart-desc">Average kWh/h across the full dataset.</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={profile}>
              <CartesianGrid strokeDasharray="3 3" />
              {touAreas}
              <XAxis dataKey="hour" tickFormatter={(v, i) => tickFilter(v, i) ? v : ""} />
              <YAxis unit=" kWh/h" />
              <Tooltip />
              <Area type="monotone" dataKey="kwh" stroke="#ff6b5b" fill="#ffc9c2" name="Avg kWh/h" />
            </AreaChart>
          </ResponsiveContainer>
          {currentTariff.touRates && currentTariff.touRates.length > 0 && (
            <div className="tou-legend">
              {currentTariff.touRates.map((tou, idx) => (
                <span key={idx} className="tou-legend-item">
                  <span
                    className="tou-legend-swatch"
                    style={{ background: TOU_STROKE_COLORS[idx % TOU_STROKE_COLORS.length] }}
                  />
                  {tou.rate}c/kWh ({tou.startHour}:00–{tou.endHour}:00,{" "}
                  {tou.days.length === 7
                    ? "all days"
                    : tou.days.map((d) => DAY_NAMES[d]).join(", ")}
                  )
                </span>
              ))}
              <span className="tou-legend-item">
                <span className="tou-legend-swatch" style={{ background: "#94a3b8" }} />
                Base rate: {currentTariff.baseRate}c/kWh
              </span>
            </div>
          )}
        </section>

        {/* ── Seasonal Comparison ── */}
        <section className="chart-section card-coral">
          <h3>Summer vs Winter Profile</h3>
          <p className="chart-desc">Average daily shape by season — highlights heating impact.</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={seasonalMerged}>
              <CartesianGrid strokeDasharray="3 3" />
              {touAreas}
              <XAxis dataKey="hour" tickFormatter={(v, i) => tickFilter(v, i) ? v : ""} />
              <YAxis unit=" kWh/h" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="summer" stroke="#ff8a7a" name="Summer (kWh/h)" dot={false} />
              <Line type="monotone" dataKey="winter" stroke="#3b82f6" name="Winter (kWh/h)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          {currentTariff.touRates && currentTariff.touRates.length > 0 && (
            <div className="tou-legend">
              {currentTariff.touRates.map((tou, idx) => (
                <span key={idx} className="tou-legend-item">
                  <span
                    className="tou-legend-swatch"
                    style={{ background: TOU_STROKE_COLORS[idx % TOU_STROKE_COLORS.length] }}
                  />
                  {tou.rate}c/kWh ({tou.startHour}:00–{tou.endHour}:00,{" "}
                  {tou.days.length === 7
                    ? "all days"
                    : tou.days.map((d) => DAY_NAMES[d]).join(", ")}
                  )
                </span>
              ))}
              <span className="tou-legend-item">
                <span className="tou-legend-swatch" style={{ background: "#94a3b8" }} />
                Base rate: {currentTariff.baseRate}c/kWh
              </span>
            </div>
          )}
        </section>

        {/* ── Weekly Trend ── */}
        <section className="chart-section card-coral">
          <h3>Weekly Consumption Trend</h3>
          <p className="chart-desc">Total kWh per week — shows trends and anomalies over time.</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
                }}
              />
              <YAxis unit=" kWh" />
              <Tooltip />
              <Bar dataKey="kwh" fill="#ff6b5b" name="Weekly kWh" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* ── Insights ── */}
        <section className="insights-section card-coral">
          <h3>Insights</h3>
          <ul className="insights-list">
            {insights.map((ins, i) => (
              <li key={i} className={`insight insight-${ins.type}`}>
                {ins.text}
                {ins.type === "load_shifting" && (
                  <details className="load-shifting-details">
                    <summary>How do I shift my load?</summary>
                    <div className="load-shifting-tips">
                      <p>Focus load shifting on large loads only, examples include:</p>
                      <ul>
                        <li><strong>Hot water load</strong> — Can be done by some retailers, or you can ask your local electrician to install a timer to avoid peak times</li>
                        <li><strong>Electric Vehicles</strong> — Schedule charging for off-peak hours using your EV's built-in timer or a smart charger</li>
                        <li><strong>Dishwashers, Washing Machines, Dryers</strong> — Use the delay start function</li>
                        <li><strong>Heat pumps</strong> — Some heat pumps have timers that you can set to heat the house in off-peak hours before you get home from work. Set the timer before you leave to work to come home to a cozy house.</li>
                      </ul>
                    </div>
                  </details>
                )}
                {ins.type === "baseload" && ins.rawBaseloadW > 500 && (
                  <div className="baseload-options">
                    <p className="baseload-options-title">Do any of these apply to you?</p>

                    <label className="baseload-checkbox">
                      <input type="checkbox" checked={nightEv} onChange={(e) => setNightEv(e.target.checked)} />
                      I have an EV which I charge overnight
                    </label>

                    <label className="baseload-checkbox">
                      <input type="checkbox" checked={nightHotWater} onChange={(e) => setNightHotWater(e.target.checked)} />
                      I have a timer on my hot water cylinder that only heats at night
                    </label>

                    <label className="baseload-checkbox">
                      <input type="checkbox" checked={nightBattery} onChange={(e) => setNightBattery(e.target.checked)} />
                      I have a battery that charges at night
                    </label>

                    {(nightEv || nightHotWater || nightBattery) && !ins.isHighBaseload && (
                      <p className="baseload-resolved">After factoring in these loads, the nighttime baseload looks normal.</p>
                    )}
                    {(nightEv || nightHotWater || nightBattery) && ins.isHighBaseload && (
                      <p className="baseload-still-high">After factoring in these loads, the nighttime baseload still looks higher than usual (~{(ins.adjustedBaseloadW / 1000).toFixed(1)} kW). Common culprits are fridges, freezers, hot water cylinders, pools, spas, and leaking hot water pipes.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Battery Assessment (existing solar exporters — issue #36) ── */}
        {battery && (
          <section className="solar-section card-coral">
            <h3>Battery Storage Assessment</h3>
            {!battery.applicable ? (
              <p className="chart-desc">{battery.reason}</p>
            ) : (
              <>
                <p className="chart-desc">
                  You exported solar across {battery.monthsCovered} month(s) of
                  your data. We modelled an {battery.capacityKwh} kWh battery that
                  stores daytime export and discharges it against your after-sunset
                  load, carrying any unused charge to the next day.
                </p>
                <div className="solar-stats">
                  <div className="solar-stat">
                    <span className="solar-stat-label">Annual solar export</span>
                    <span className="solar-stat-value">{Math.round(battery.annualExportKwh).toLocaleString()} kWh</span>
                  </div>
                  <div className="solar-stat">
                    <span className="solar-stat-label">Energy shifted to evenings</span>
                    <span className="solar-stat-value">{Math.round(battery.annualDischargeKwh).toLocaleString()} kWh/yr</span>
                  </div>
                  <div className="solar-stat">
                    <span className="solar-stat-label">Estimated annual saving</span>
                    <span className="solar-stat-value">${Math.round(battery.annualSaving).toLocaleString()}</span>
                  </div>
                  <div className="solar-stat">
                    <span className="solar-stat-label">Battery cost (assumed)</span>
                    <span className="solar-stat-value">${battery.cost.toLocaleString()}</span>
                  </div>
                  <div className="solar-stat">
                    <span className="solar-stat-label">Discounted payback ({Math.round(DISCOUNT_RATE * 100)}%)</span>
                    <span className="solar-stat-value">
                      {battery.paybackYears != null ? `${battery.paybackYears.toFixed(1)} years` : "> 20 years"}
                    </span>
                  </div>
                </div>
                <p className={`solar-verdict verdict-${battery.recommendation}`}>
                  {battery.recommendation === "recommend" &&
                    "Recommended — the payback is under 15 years, so a battery looks worthwhile for your household."}
                  {battery.recommendation === "consider" &&
                    "Worth considering — the payback is under 20 years, but you may want to wait for battery prices to fall further before committing."}
                  {battery.recommendation === "uneconomic" &&
                    "The economics of a battery don't currently stack up for your household (payback over 20 years). It may still be worth it as a resilience / backup-power measure during outages."}
                </p>
              </>
            )}
          </section>
        )}

        {/* ── Solar Installation Assessment (non-exporters — issue #37) ── */}
        {solar && solar.applicable && (
          <section className="solar-section card-coral">
            <h3>Should You Install Solar?</h3>
            <p className="data-note" style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
              Generation is modelled from average New Zealand sun-hours; installed
              costs are from AI web research as of {solar.dataUpdated} and may
              contain errors. Always get quotes for your specific roof and location.
            </p>
            <p className="chart-desc">
              Modelled against your actual half-hourly usage. Self-consumed solar
              saves your grid rate (~{Math.round(solar.avgGridRate)}c/kWh); surplus
              is exported at {solar.exportRate ? `${solar.exportRate}c/kWh` : "your export rate (not set)"}.
            </p>
            <div className="table-wrapper">
              <table className="plans-table">
                <thead>
                  <tr>
                    <th>System</th>
                    <th>Installed cost</th>
                    <th>Annual generation</th>
                    <th>Annual saving</th>
                    <th>Payback ({Math.round(DISCOUNT_RATE * 100)}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {solar.scenarios.map((s) => (
                    <tr key={s.sizeKw} className={s.sizeKw === solar.best.sizeKw ? "saving" : ""}>
                      <td className="retailer">{s.label}{s.sizeKw === solar.best.sizeKw ? " ★" : ""}</td>
                      <td>${s.capex.toLocaleString()}</td>
                      <td>{Math.round(s.annualGenerationKwh).toLocaleString()} kWh</td>
                      <td>${Math.round(s.annualSaving).toLocaleString()}</td>
                      <td>{s.paybackYears != null ? `${s.paybackYears.toFixed(1)} yrs` : "> 40 yrs"}</td>
                    </tr>
                  ))}
                  {breakdownCustomised && breakdown && (
                    <tr className="custom-row">
                      <td className="retailer">{breakdown.sizeKw} kW (custom)</td>
                      <td>${Math.round(breakdown.capex).toLocaleString()}</td>
                      <td>{Math.round(breakdown.annualGenerationKwh).toLocaleString()} kWh</td>
                      <td>${Math.round(breakdown.annualSaving).toLocaleString()}</td>
                      <td>{breakdown.paybackYears != null ? `${breakdown.paybackYears.toFixed(1)} yrs` : "> 40 yrs"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className={`solar-verdict verdict-${solar.recommendation}`}>
              {solar.recommendation === "recommend" &&
                `Recommended — the best value is the ${solar.best.label} system, paying back in about ${solar.best.paybackYears.toFixed(1)} years (under 10).`}
              {solar.recommendation === "marginal" && (
                <>
                  At your current usage the best option ({solar.best.label}) pays
                  back in about {solar.best.paybackYears.toFixed(1)} years.
                  {solar.loadShift && solar.loadShift.percentOfLoad != null && (
                    <>
                      {" "}If you shifted roughly {Math.round(solar.loadShift.percentOfLoad)}% of
                      your usage into daylight hours, the payback would drop under 10 years
                      {solar.loadShift.achievable ? "." : " (though that may be more than your surplus generation can cover)."}
                    </>
                  )}
                </>
              )}
              {solar.recommendation === "uneconomic" &&
                `Solar doesn't currently stack up economically for your usage — the best option (${solar.best.label}) takes over 15 years to pay back. This can change as power prices rise or panel costs fall.`}
            </p>
            {solar.combined && solar.combined.paybackYears != null && (
              <p className="solar-pairing chart-desc">
                Pairing the {solar.best.label} system with an 8 kWh battery would
                cost about ${solar.combined.capex.toLocaleString()} together and save
                roughly ${Math.round(solar.combined.annualSaving).toLocaleString()}/year
                (≈ {solar.combined.paybackYears.toFixed(1)} year payback)
                {solar.combined.paybackYears < solar.best.paybackYears
                  ? " — slightly better economics than solar alone."
                  : " — but it does not improve on solar alone, so the battery is best treated as a resilience add-on."}
              </p>
            )}
          </section>
        )}

        {/* ── Solar Maths Breakdown ── */}
        {solar && solar.applicable && breakdown && (
          <section className="solar-section card-coral">
            <h3>Solar Maths Breakdown</h3>
            <p className="chart-desc">
              How the numbers above are built up, for a {breakdown.sizeKw} kW system
              costing ${breakdown.capex.toLocaleString()}, modelled against your actual
              half-hourly usage. Adjust the assumptions below to match a real quote.
            </p>

            <div className="solar-customise">
              <label className="solar-field">
                <span>Solar system size (kW)</span>
                <input
                  type="number" min="0" step="0.5" inputMode="decimal"
                  value={sizeInput} placeholder={String(solar.best.sizeKw)}
                  onChange={(e) => setSizeInput(e.target.value)}
                />
              </label>
              <label className="solar-field">
                <span>System cost ($)</span>
                <input
                  type="number" min="0" step="500" inputMode="numeric"
                  value={capexInput} placeholder={String(solar.best.capex)}
                  onChange={(e) => setCapexInput(e.target.value)}
                />
              </label>
              <label className="solar-field">
                <span>Solar export rate (c/kWh)</span>
                <input
                  type="number" min="0" step="0.5" inputMode="decimal"
                  value={exportInput} placeholder={String(defaultExportRate)}
                  onChange={(e) => setExportInput(e.target.value)}
                />
              </label>
              <label className="solar-field">
                <span>Loan interest rate (%)</span>
                <input
                  type="number" min="0" step="0.1" inputMode="decimal"
                  value={rateInput} placeholder={String(Math.round(DEFAULT_LOAN_RATE * 100))}
                  onChange={(e) => setRateInput(e.target.value)}
                />
              </label>
              <label className="solar-field solar-field-checkbox">
                <input
                  type="checkbox" checked={greenLoan}
                  onChange={(e) => setGreenLoan(e.target.checked)}
                />
                <span>Green loan ({Math.round(GREEN_LOAN_INTRO_RATE * 100)}% for the
                  first {GREEN_LOAN_INTRO_YEARS} years, then floating)</span>
              </label>
            </div>

            <div className="solar-stats">
              <div className="solar-stat">
                <span className="solar-stat-label">Saving from self-consumption</span>
                <span className="solar-stat-value">${Math.round(breakdown.selfConsumptionSaving).toLocaleString()}/yr</span>
              </div>
              <div className="solar-stat">
                <span className="solar-stat-label">Earnings from export</span>
                <span className="solar-stat-value">${Math.round(breakdown.exportEarning).toLocaleString()}/yr</span>
              </div>
              <div className="solar-stat">
                <span className="solar-stat-label">Total annual saving</span>
                <span className="solar-stat-value">${Math.round(breakdown.annualSaving).toLocaleString()}/yr</span>
              </div>
              <div className="solar-stat">
                <span className="solar-stat-label">Modelled annual generation</span>
                <span className="solar-stat-value">{Math.round(breakdown.annualGenerationKwh).toLocaleString()} kWh</span>
              </div>
              <div className="solar-stat">
                <span className="solar-stat-label">Payback period</span>
                <span className="solar-stat-value">
                  {breakdown.loan.repaid ? `${breakdown.loan.years.toFixed(1)} years` : "> 60 years"}
                </span>
              </div>
            </div>

            <h4 style={{ margin: "1rem 0 0.25rem" }}>Financing with a bank loan</h4>
            <p className="chart-desc" style={{ marginTop: 0 }}>
              {breakdown.loan.repaid ? (
                <>
                  Borrowing the ${breakdown.capex.toLocaleString()} on top of your mortgage
                  {breakdown.loan.greenLoan
                    ? ` at ${Math.round(GREEN_LOAN_INTRO_RATE * 100)}% for ${GREEN_LOAN_INTRO_YEARS} years then ${(breakdown.loan.floatingRate * 100).toFixed(1)}% floating`
                    : ` at ${(breakdown.loan.floatingRate * 100).toFixed(1)}%`}
                  , your ${Math.round(breakdown.annualSaving).toLocaleString()}/yr of savings
                  pay it off in about {breakdown.loan.years.toFixed(1)} years.
                  Total interest paid: ${Math.round(breakdown.loan.totalInterest).toLocaleString()}.
                </>
              ) : (
                <>
                  At {breakdown.loan.greenLoan
                    ? `${Math.round(GREEN_LOAN_INTRO_RATE * 100)}% then ${(breakdown.loan.floatingRate * 100).toFixed(1)}% floating`
                    : `${(breakdown.loan.floatingRate * 100).toFixed(1)}%`}
                  , the ${Math.round(breakdown.annualSaving).toLocaleString()}/yr of savings don't
                  cover the interest on a ${breakdown.capex.toLocaleString()} loan, so it never
                  pays itself off — a lower rate or cheaper system is needed.
                </>
              )}
            </p>

            <h4 style={{ margin: "1rem 0 0.25rem" }}>Average day by month</h4>
            <p className="chart-desc" style={{ marginTop: 0 }}>
              Per-day averages for each month, so you can see how much generation is
              actually used at home versus exported. Self-consumption plus export equals
              generation.
            </p>
            <div className="table-wrapper">
              <table className="plans-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Generation/day</th>
                    <th>Consumption/day</th>
                    <th>Self-consumed/day</th>
                    <th>Exported/day</th>
                    <th>Savings/day</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.months.map((m) => (
                    <tr key={m.month}>
                      <td className="retailer">{m.month}</td>
                      <td>{m.avgDailyGenerationKwh.toFixed(1)} kWh</td>
                      <td>{m.avgDailyConsumptionKwh.toFixed(1)} kWh</td>
                      <td>{m.avgDailySelfKwh.toFixed(1)} kWh</td>
                      <td>{m.avgDailyExportKwh.toFixed(1)} kWh</td>
                      <td>${m.avgDailySavingsDollars.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Plan Comparison Table ── */}
        <section className="plans-section card-coral">
          <h3>Plan Recommendations</h3>
          <p className="data-note" style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
            Data based on AI web search on {tariffsLastUpdated}. The data does not
            take into account regional price differences, and may contain errors.
            Please check the actual data on the retailer's website.
          </p>
          <p className="chart-desc">
            Ranked by estimated annual cost using your actual consumption data.
          </p>
          {plans.length > 0 && !plans.some(p => p.saving > 0) && (
            <p className="no-savings-note" style={{ color: "#b45309", fontWeight: 500, marginBottom: "0.5rem" }}>
              There is no known plan that would save you money from your current plan.
            </p>
          )}
          <div className="table-wrapper">
            <table className="plans-table">
              <thead>
                <tr>
                  <th>Retailer</th>
                  <th>Plan</th>
                  <th>Type</th>
                  <th>Est. Annual Cost</th>
                  <th>Saving</th>
                  <th>Features</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p, i) => {
                  const isExpanded = expandedRow === i;
                  return (
                    <>
                      <tr
                        key={i}
                        className={`${p.saving > 0 ? "saving" : "no-saving"} expandable-row`}
                        onClick={() => setExpandedRow(isExpanded ? null : i)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="retailer">{p.retailer}</td>
                        <td>{p.plan}</td>
                        <td>{p.type}</td>
                        <td>${p.estimatedCost.toLocaleString()}</td>
                        <td>
                          {p.saving > 0 ? (
                            <span className="saving-badge save">${p.saving.toLocaleString()}</span>
                          ) : (
                            <span className="saving-badge no-save">-${Math.abs(p.saving).toLocaleString()}</span>
                          )}
                        </td>
                        <td>{p.features}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${i}-detail`} className="plan-detail-row">
                          <td colSpan={6}>
                            <div className="plan-detail">
                              <p className="plan-detail-disclaimer">
                                These are estimated prices from automated web searches and may not
                                reflect current rates. Please verify with {p.retailer}'s website
                                before making any decisions.
                              </p>
                              <div className="plan-detail-grid">
                                <div className="plan-detail-item">
                                  <span className="plan-detail-label">Daily charge</span>
                                  <span className="plan-detail-value">{(p.dailyCharge / 100).toFixed(2)} $/day</span>
                                </div>
                                {p.rates.map((r, ri) => (
                                  <div key={ri} className="plan-detail-item">
                                    <span className="plan-detail-label">{r.name}</span>
                                    <span className="plan-detail-value">
                                      {r.centsPerKwh} c/kWh
                                      {r.startHour != null && r.endHour != null && (
                                        <> &middot; {String(r.startHour).padStart(2, "0")}:00–{String(r.endHour).padStart(2, "0")}:00</>
                                      )}
                                      {r.daysOfWeek && (
                                        <> &middot; {r.daysOfWeek.map(d => DAY_NAMES[d]).join(", ")}</>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
