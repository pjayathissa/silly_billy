import { useState } from "react";

/**
 * Tariff review screen — shows extracted tariff values and lets the user edit them.
 * extractedTariff: { retailer, plan, dailyCharge, peakRate, offPeakRate }
 * onConfirm(tariff): called with the confirmed/edited tariff.
 */
export default function TariffReview({ extractedTariff, onConfirm, csvWarnings, csvPreview, onConfirmCsv }) {
  const [tariff, setTariff] = useState({
    retailer: extractedTariff.retailer || "",
    plan: extractedTariff.plan || "",
    dailyCharge: extractedTariff.dailyCharge ?? "",
    peakRate: extractedTariff.peakRate ?? "",
    offPeakRate: extractedTariff.offPeakRate ?? "",
    peakStart: 7,
    peakEnd: 21,
  });

  const update = (field) => (e) =>
    setTariff((t) => ({ ...t, [field]: e.target.value }));

  const handleConfirm = () => {
    onConfirm({
      retailer: tariff.retailer,
      plan: tariff.plan,
      dailyCharge: parseFloat(tariff.dailyCharge) || 0,
      peakRate: parseFloat(tariff.peakRate) || 0,
      offPeakRate: parseFloat(tariff.offPeakRate) || 0,
      peakStart: parseInt(tariff.peakStart) || 7,
      peakEnd: parseInt(tariff.peakEnd) || 21,
    });
  };

  return (
    <div className="tariff-review">
      <h2>Review Your Current Tariff</h2>
      <p className="subtitle">
        We extracted these values from your bill. Please review and correct any
        that look wrong. Leave off-peak rate blank if your plan doesn't have one.
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
          <label>Retailer</label>
          <input value={tariff.retailer} onChange={update("retailer")} placeholder="e.g. Mercury" />
        </div>
        <div className="form-row">
          <label>Plan name</label>
          <input value={tariff.plan} onChange={update("plan")} placeholder="e.g. Everyday" />
        </div>
        <div className="form-row">
          <label>Daily fixed charge (cents/day)</label>
          <input type="number" value={tariff.dailyCharge} onChange={update("dailyCharge")} placeholder="e.g. 230" />
        </div>
        <div className="form-row">
          <label>Peak / anytime rate (cents/kWh)</label>
          <input type="number" value={tariff.peakRate} onChange={update("peakRate")} placeholder="e.g. 28.5" />
        </div>
        <div className="form-row">
          <label>Off-peak rate (cents/kWh, leave blank if N/A)</label>
          <input type="number" value={tariff.offPeakRate} onChange={update("offPeakRate")} placeholder="e.g. 15" />
        </div>
        {tariff.offPeakRate && (
          <div className="form-row-inline">
            <div>
              <label>Peak starts (hour, 0–23)</label>
              <input type="number" min="0" max="23" value={tariff.peakStart} onChange={update("peakStart")} />
            </div>
            <div>
              <label>Peak ends (hour, 0–23)</label>
              <input type="number" min="0" max="23" value={tariff.peakEnd} onChange={update("peakEnd")} />
            </div>
          </div>
        )}
      </div>

      <button className="primary-btn" onClick={handleConfirm}>
        Run Analysis
      </button>
    </div>
  );
}
