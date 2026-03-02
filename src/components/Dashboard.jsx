import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  dailyProfile, seasonalProfiles, weeklyTrend,
  generateInsights, currentAnnualCost, rankPlans,
} from "../utils/analysis.js";

/**
 * Main analysis dashboard — charts, insights, and plan comparison table.
 */
export default function Dashboard({ data, currentTariff }) {
  const profile = dailyProfile(data);
  const seasonal = seasonalProfiles(data);
  const weekly = weeklyTrend(data);
  const myCost = currentAnnualCost(data, currentTariff);
  const insights = generateInsights(data, currentTariff);
  const plans = rankPlans(data, myCost);

  // Merge seasonal data for the overlay chart
  const seasonalMerged = profile.map((_, i) => ({
    hour: seasonal.summer[i].hour,
    summer: seasonal.summer[i].kwh,
    winter: seasonal.winter[i].kwh,
  }));

  // Only show every 4th x-axis label to avoid crowding
  const tickFilter = (_, i) => i % 4 === 0;

  return (
    <div className="dashboard">
      <h2>Analysis Dashboard</h2>

      <p className="summary">
        Data covers {data.length.toLocaleString()} readings.
        Your estimated annual cost on your current plan:{" "}
        <strong>${myCost.toLocaleString()}</strong>
      </p>

      {/* ── Average Daily Profile ── */}
      <section className="chart-section">
        <h3>Average Daily Consumption Profile</h3>
        <p className="chart-desc">Average kWh per half-hour interval across the full dataset.</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={profile}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tickFormatter={(v, i) => tickFilter(v, i) ? v : ""} />
            <YAxis unit=" kWh" />
            <Tooltip />
            <Area type="monotone" dataKey="kwh" stroke="#3b82f6" fill="#93c5fd" name="Avg kWh" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      {/* ── Seasonal Comparison ── */}
      <section className="chart-section">
        <h3>Summer vs Winter Profile</h3>
        <p className="chart-desc">Average daily shape by season — highlights heating impact.</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={seasonalMerged}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tickFormatter={(v, i) => tickFilter(v, i) ? v : ""} />
            <YAxis unit=" kWh" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="summer" stroke="#f59e0b" name="Summer" dot={false} />
            <Line type="monotone" dataKey="winter" stroke="#3b82f6" name="Winter" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ── Weekly Trend ── */}
      <section className="chart-section">
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
            <Bar dataKey="kwh" fill="#6366f1" name="Weekly kWh" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ── Insights ── */}
      <section className="insights-section">
        <h3>Insights</h3>
        <ul className="insights-list">
          {insights.map((ins, i) => (
            <li key={i} className={`insight insight-${ins.type}`}>
              {ins.text}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Plan Comparison Table ── */}
      <section className="plans-section">
        <h3>Plan Recommendations</h3>
        <p className="chart-desc">
          Ranked by estimated annual cost using your actual consumption data.
          Assumes no change in usage behaviour.
        </p>
        <div className="table-wrapper">
          <table className="plans-table">
            <thead>
              <tr>
                <th>Retailer</th>
                <th>Plan</th>
                <th>Type</th>
                <th>Est. Annual Cost</th>
                <th>Annual Saving</th>
                <th>Features</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={i} className={p.saving > 0 ? "saving" : "no-saving"}>
                  <td>{p.retailer}</td>
                  <td>{p.plan}</td>
                  <td>{p.type}</td>
                  <td>${p.estimatedCost.toLocaleString()}</td>
                  <td className={p.saving > 0 ? "positive" : "negative"}>
                    {p.saving > 0 ? `$${p.saving.toLocaleString()}` : `−$${Math.abs(p.saving).toLocaleString()}`}
                  </td>
                  <td>{p.features}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
