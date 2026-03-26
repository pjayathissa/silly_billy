import { useState } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// JS getDay(): 0=Sun,1=Mon,...,6=Sat  →  our checkbox index: 0=Mon,...,6=Sun
const DAY_INDEX_TO_JS = [1, 2, 3, 4, 5, 6, 0];

function emptyTouRate() {
  return { rate: "", startHour: 7, endHour: 21, days: [1, 2, 3, 4, 5, 6, 0] };
}

/**
 * Tariff review screen — shows extracted tariff values and lets the user edit them.
 * extractedTariff: { retailer, plan, dailyCharge, peakRate, offPeakRate }
 * onConfirm(tariff): called with the confirmed/edited tariff.
 */
export default function TariffReview({ extractedTariff, confirmedTariff, onConfirm, csvWarnings, csvPreview, onConfirmCsv }) {
  // If user previously confirmed a tariff, use that; otherwise fall back to extracted values
  const source = confirmedTariff || extractedTariff;

  const initialTouRates = confirmedTariff
    ? (confirmedTariff.touRates || []).map((t) => ({
        rate: t.rate ?? "",
        startHour: t.startHour ?? 7,
        endHour: t.endHour ?? 21,
        days: t.days || [1, 2, 3, 4, 5, 6, 0],
      }))
    : extractedTariff.offPeakRate
      ? [{ rate: extractedTariff.offPeakRate, startHour: 21, endHour: 7, days: [1, 2, 3, 4, 5, 6, 0] }]
      : [];

  const [tariff, setTariff] = useState({
    dailyCharge: source.dailyCharge ?? "",
    baseRate: source.baseRate ?? (extractedTariff.peakRate ?? ""),
  });

  const [touRates, setTouRates] = useState(initialTouRates);

  const update = (field) => (e) =>
    setTariff((t) => ({ ...t, [field]: e.target.value }));

  const updateTou = (index, field) => (e) => {
    setTouRates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: e.target.value };
      return next;
    });
  };

  const toggleTouDay = (index, dayJs) => {
    setTouRates((prev) => {
      const next = [...prev];
      const entry = { ...next[index] };
      const days = [...entry.days];
      if (days.includes(dayJs)) {
        entry.days = days.filter((d) => d !== dayJs);
      } else {
        entry.days = [...days, dayJs];
      }
      next[index] = entry;
      return next;
    });
  };

  const addTouRate = () => setTouRates((prev) => [...prev, emptyTouRate()]);

  const removeTouRate = (index) =>
    setTouRates((prev) => prev.filter((_, i) => i !== index));

  const handleConfirm = () => {
    onConfirm({
      dailyCharge: parseFloat(tariff.dailyCharge) || 0,
      baseRate: parseFloat(tariff.baseRate) || 0,
      touRates: touRates
        .filter((t) => t.rate !== "" && t.rate != null)
        .map((t) => ({
          rate: parseFloat(t.rate) || 0,
          startHour: parseInt(t.startHour) || 0,
          endHour: parseInt(t.endHour) || 0,
          days: t.days,
        })),
    });
  };

  return (
    <div className="tariff-review">
      <h2>Review Your Current Tariff</h2>
      <p className="subtitle">
        We extracted these values from your bill. Please review and correct any
        that look wrong.
      </p>

      {/* Show CSV warnings if confirmation needed */}
      {csvWarnings && csvWarnings.length > 0 && (
        <div className="warning-box">
          <strong>CSV notices:</strong>
          <ul>
            {csvWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          {csvPreview && (
            <div className="csv-preview">
              <strong>Data preview:</strong>
              <table>
                <tbody>
                  {csvPreview.map((row, i) => (
                    <tr key={i}>
                      {(Array.isArray(row) ? row : [row]).map((cell, j) => (
                        <td key={j}>{String(cell ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {onConfirmCsv && (
            <button className="secondary-btn" onClick={onConfirmCsv}>
              CSV data looks correct, continue
            </button>
          )}
        </div>
      )}

      <div className="tariff-form">
        <div className="form-row">
          <label>Daily fixed charge (cents/day)</label>
          <input type="number" value={tariff.dailyCharge} onChange={update("dailyCharge")} placeholder="e.g. 230" />
        </div>
        <div className="form-row">
          <label>Base rate (cents/kWh)</label>
          <input type="number" value={tariff.baseRate} onChange={update("baseRate")} placeholder="e.g. 28.5" />
        </div>

        {/* ── Time-of-Use Rates ── */}
        <div className="tou-section">
          <h3>Time of Use Rates</h3>
          <p className="tou-hint">
            Add rates that apply during specific hours and days. The base rate
            applies to any time not covered below.
          </p>

          {touRates.map((tou, idx) => (
            <div className="tou-entry" key={idx}>
              <div className="tou-header">
                <span className="tou-label">Rate {idx + 1}</span>
                <button
                  className="tou-remove-btn"
                  type="button"
                  onClick={() => removeTouRate(idx)}
                >
                  Remove
                </button>
              </div>

              <div className="form-row">
                <label>Rate (cents/kWh)</label>
                <input
                  type="number"
                  value={tou.rate}
                  onChange={updateTou(idx, "rate")}
                  placeholder="e.g. 15"
                />
              </div>

              <div className="form-row-inline">
                <div>
                  <label>Start hour (0–23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={tou.startHour}
                    onChange={updateTou(idx, "startHour")}
                  />
                </div>
                <div>
                  <label>End hour (0–23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={tou.endHour}
                    onChange={updateTou(idx, "endHour")}
                  />
                </div>
              </div>

              <div className="tou-days">
                <label>Applies on:</label>
                <div className="day-checkboxes">
                  {DAY_LABELS.map((label, di) => {
                    const jsDay = DAY_INDEX_TO_JS[di];
                    return (
                      <label key={di} className="day-checkbox">
                        <input
                          type="checkbox"
                          checked={tou.days.includes(jsDay)}
                          onChange={() => toggleTouDay(idx, jsDay)}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          <button className="secondary-btn" type="button" onClick={addTouRate}>
            + Add Time of Use Rate
          </button>
        </div>
      </div>

      <button className="primary-btn" onClick={handleConfirm}>
        Run Analysis
      </button>
    </div>
  );
}
