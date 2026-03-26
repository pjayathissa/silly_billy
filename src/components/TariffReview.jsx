import { useState } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// JS getDay(): 0=Sun,1=Mon,...,6=Sat  →  our checkbox index: 0=Mon,...,6=Sun
const DAY_INDEX_TO_JS = [1, 2, 3, 4, 5, 6, 0];

function emptyTouRate() {
  return { rate: "", startHour: 7, endHour: 21, days: [1, 2, 3, 4, 5, 6, 0] };
}

// Thresholds for "looks like dollars instead of cents" warnings
const DAILY_CHARGE_DOLLAR_THRESHOLD = 5;   // ≤5 likely dollars, expected ~100-300 cents
const RATE_DOLLAR_THRESHOLD = 1;           // ≤1 likely dollars, expected ~15-45 cents

/**
 * Tariff review screen — shows extracted tariff values and lets the user edit them.
 * extractedTariff: { retailer, plan, dailyCharge, peakRate, offPeakRate, parseFailures }
 * onConfirm(tariff): called with the confirmed/edited tariff.
 */
export default function TariffReview({ extractedTariff, confirmedTariff, pdfUploaded, onConfirm, csvWarnings, csvPreview, onConfirmCsv }) {
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
  const [validationErrors, setValidationErrors] = useState({});

  // Parse failures from PDF extraction
  const parseFailures = (pdfUploaded && extractedTariff.parseFailures) || {};

  const update = (field) => (e) => {
    setTariff((t) => ({ ...t, [field]: e.target.value }));
    // Clear validation error when user types
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const updateTou = (index, field) => (e) => {
    setTouRates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: e.target.value };
      return next;
    });
    if (field === "rate" && validationErrors[`touRate_${index}`]) {
      setValidationErrors((prev) => ({ ...prev, [`touRate_${index}`]: null }));
    }
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

  /** Check if a value looks like it was entered in dollars instead of cents */
  function getUnitWarning(field, value) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return null;
    if (field === "dailyCharge" && num > 0 && num <= DAILY_CHARGE_DOLLAR_THRESHOLD) {
      return "Looks like you've entered the value in dollars instead of cents. Please review.";
    }
    if ((field === "baseRate" || field === "touRate") && num > 0 && num <= RATE_DOLLAR_THRESHOLD) {
      return "Looks like you've entered the value in dollars instead of cents. Please review.";
    }
    return null;
  }

  const handleConfirm = () => {
    const errors = {};

    // Validate required fields are not blank
    if (tariff.dailyCharge === "" || tariff.dailyCharge == null) {
      errors.dailyCharge = "Data cannot be left blank.";
    }
    if (tariff.baseRate === "" || tariff.baseRate == null) {
      errors.baseRate = "Data cannot be left blank.";
    }

    // Validate TOU rates that have been added
    touRates.forEach((tou, idx) => {
      if (tou.rate === "" || tou.rate == null) {
        errors[`touRate_${idx}`] = "Data cannot be left blank.";
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

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

  const dailyUnitWarn = getUnitWarning("dailyCharge", tariff.dailyCharge);
  const baseRateUnitWarn = getUnitWarning("baseRate", tariff.baseRate);

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
          {parseFailures.dailyCharge && (tariff.dailyCharge === "" || tariff.dailyCharge == null) && (
            <span className="field-parse-error">* Could not extract data from the PDF. Please manually enter the daily charge.</span>
          )}
          {validationErrors.dailyCharge && (
            <span className="field-validation-error">* {validationErrors.dailyCharge}</span>
          )}
          {dailyUnitWarn && (
            <span className="field-unit-warning">* {dailyUnitWarn}</span>
          )}
        </div>
        <div className="form-row">
          <label>Base rate (cents/kWh)</label>
          <input type="number" value={tariff.baseRate} onChange={update("baseRate")} placeholder="e.g. 28.5" />
          {parseFailures.baseRate && (tariff.baseRate === "" || tariff.baseRate == null) && (
            <span className="field-parse-error">* Could not extract data from the PDF. Please manually enter the base rate.</span>
          )}
          {validationErrors.baseRate && (
            <span className="field-validation-error">* {validationErrors.baseRate}</span>
          )}
          {baseRateUnitWarn && (
            <span className="field-unit-warning">* {baseRateUnitWarn}</span>
          )}
        </div>

        {/* ── Time-of-Use Rates ── */}
        <div className="tou-section">
          <h3>Time of Use Rates</h3>
          <p className="tou-hint">
            Add rates that apply during specific hours and days. The base rate
            applies to any time not covered below.
          </p>

          {touRates.map((tou, idx) => {
            const touUnitWarn = getUnitWarning("touRate", tou.rate);
            return (
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
                  {validationErrors[`touRate_${idx}`] && (
                    <span className="field-validation-error">* {validationErrors[`touRate_${idx}`]}</span>
                  )}
                  {touUnitWarn && (
                    <span className="field-unit-warning">* {touUnitWarn}</span>
                  )}
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
            );
          })}

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
