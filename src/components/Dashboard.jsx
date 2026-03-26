import { useState } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import {
  dailyProfile, seasonalProfiles, weeklyTrend,
  generateInsights, currentAnnualCost, rankPlans,
} from "../utils/analysis.js";
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
export default function Dashboard({ data, currentTariff }) {
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
        <StepIndicator currentStep="dashboard" />
      </div>

      <div className="dash-content">
        {/* ── Average Daily Profile ── */}
        <section className="chart-section card-coral">
          <h3>Average Daily Consumption Profile</h3>
          <p className="chart-desc">Average kWh per half-hour interval across the full dataset.</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={profile}>
              <CartesianGrid strokeDasharray="3 3" />
              {touAreas}
              <XAxis dataKey="hour" tickFormatter={(v, i) => tickFilter(v, i) ? v : ""} />
              <YAxis unit=" kWh" />
              <Tooltip />
              <Area type="monotone" dataKey="kwh" stroke="#ff6b5b" fill="#ffc9c2" name="Avg kWh" />
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
              <YAxis unit=" kWh" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="summer" stroke="#ff8a7a" name="Summer" dot={false} />
              <Line type="monotone" dataKey="winter" stroke="#3b82f6" name="Winter" dot={false} />
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
