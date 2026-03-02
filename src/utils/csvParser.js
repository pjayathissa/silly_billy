/**
 * CSV Parser — auto-detects column layout for half-hourly electricity data.
 *
 * Strategy:
 *   1. Parse CSV with PapaParse
 *   2. Check if data looks transposed (timestamps across columns)
 *   3. Find the timestamp column and kWh column by header names + data patterns
 *   4. Validate values are reasonable for residential half-hourly data (0–5 kWh)
 *   5. Return normalised array of { timestamp: Date, kwh: number }
 */

import Papa from "papaparse";

// Common header names for timestamp and consumption columns
const TIMESTAMP_PATTERNS = [
  /date/i, /time/i, /timestamp/i, /period/i, /interval/i, /datetime/i,
];
const KWH_PATTERNS = [
  /kwh/i, /consumption/i, /usage/i, /energy/i, /demand/i, /reading/i,
  /value/i, /amount/i, /units/i,
];

/**
 * Try to parse a string as a date. Returns Date or null.
 */
function tryParseDate(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (s.length < 6) return null;

  // Try native parse
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

  // Try DD/MM/YYYY HH:mm format (common in NZ)
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    const date = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6] || 0));
    if (!isNaN(date.getTime())) return date;
    // Try MM/DD instead of DD/MM
    const date2 = new Date(year, parseInt(m[1]) - 1, parseInt(m[2]), parseInt(m[4]), parseInt(m[5]));
    if (!isNaN(date2.getTime())) return date2;
  }

  return null;
}

/**
 * Check if a value looks like a reasonable half-hourly kWh reading.
 */
function isReasonableKwh(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n >= 0 && n <= 10;
}

/**
 * Score a column as a potential timestamp column.
 * Returns fraction of rows that parse as dates.
 */
function scoreTimestampColumn(values) {
  const sample = values.slice(0, 50);
  const hits = sample.filter((v) => tryParseDate(String(v)) !== null).length;
  return hits / sample.length;
}

/**
 * Score a column as a potential kWh column.
 * Returns fraction of rows with reasonable kWh values.
 */
function scoreKwhColumn(values) {
  const sample = values.slice(0, 50);
  const hits = sample.filter((v) => isReasonableKwh(v)).length;
  return hits / sample.length;
}

/**
 * Detect if the data is transposed (timestamps running across columns).
 * Heuristic: if the first row has many date-like values, it's transposed.
 */
function isTransposed(rows) {
  if (rows.length < 2) return false;
  const firstRow = rows[0];
  if (!Array.isArray(firstRow)) return false;
  const dateCount = firstRow.filter((v) => tryParseDate(String(v)) !== null).length;
  return dateCount > firstRow.length * 0.5 && dateCount > 5;
}

/**
 * Transpose a 2D array (swap rows and columns).
 */
function transpose(rows) {
  if (rows.length === 0) return [];
  const maxCols = Math.max(...rows.map((r) => r.length));
  const result = [];
  for (let col = 0; col < maxCols; col++) {
    result.push(rows.map((r) => (col < r.length ? r[col] : "")));
  }
  return result;
}

/**
 * Main parse function. Returns { data, warnings, preview }.
 * - data: array of { timestamp: Date, kwh: number }, sorted by time
 * - warnings: string[] of any issues detected
 * - preview: first 5 rows of raw data for user confirmation if needed
 * - needsConfirmation: true if the user should verify column mapping
 */
export function parseCSV(fileContent) {
  const warnings = [];

  // Parse with PapaParse — try with and without headers
  let parsed = Papa.parse(fileContent.trim(), {
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  let rows = parsed.data;
  if (rows.length < 10) {
    return { data: [], warnings: ["File has too few rows."], needsConfirmation: true, preview: rows.slice(0, 5) };
  }

  // Detect transposed data and fix it
  if (isTransposed(rows)) {
    rows = transpose(rows);
    warnings.push("Data appeared transposed — automatically corrected.");
  }

  // Try to identify header row (first row that has text, not numbers/dates)
  let headers = null;
  let dataStart = 0;
  const firstRow = rows[0];
  const isHeaderRow = firstRow.some(
    (v) => typeof v === "string" && v.length > 0 && isNaN(parseFloat(v)) && tryParseDate(v) === null
  );
  if (isHeaderRow) {
    headers = firstRow.map((h) => String(h).trim());
    dataStart = 1;
  }

  const dataRows = rows.slice(dataStart);
  if (dataRows.length < 5) {
    return { data: [], warnings: ["Not enough data rows."], needsConfirmation: true, preview: rows.slice(0, 5) };
  }

  // Determine number of columns
  const numCols = Math.max(...dataRows.slice(0, 20).map((r) => r.length));

  // Score each column
  let bestTimestampCol = -1;
  let bestTimestampScore = 0;
  let bestKwhCol = -1;
  let bestKwhScore = 0;

  for (let col = 0; col < numCols; col++) {
    const values = dataRows.map((r) => (col < r.length ? r[col] : ""));

    // Check header name first
    const headerName = headers ? headers[col] || "" : "";

    const tsHeaderMatch = TIMESTAMP_PATTERNS.some((p) => p.test(headerName));
    const kwhHeaderMatch = KWH_PATTERNS.some((p) => p.test(headerName));

    const tsScore = scoreTimestampColumn(values) + (tsHeaderMatch ? 0.3 : 0);
    const kwhScore = scoreKwhColumn(values) + (kwhHeaderMatch ? 0.3 : 0);

    if (tsScore > bestTimestampScore) {
      bestTimestampScore = tsScore;
      bestTimestampCol = col;
    }
    if (kwhScore > bestKwhScore) {
      bestKwhScore = kwhScore;
      bestKwhCol = col;
    }
  }

  // If timestamp and kwh detected the same column, resolve conflict
  if (bestTimestampCol === bestKwhCol) {
    // Re-pick kwh from remaining columns
    bestKwhScore = 0;
    for (let col = 0; col < numCols; col++) {
      if (col === bestTimestampCol) continue;
      const values = dataRows.map((r) => (col < r.length ? r[col] : ""));
      const headerName = headers ? headers[col] || "" : "";
      const kwhHeaderMatch = KWH_PATTERNS.some((p) => p.test(headerName));
      const score = scoreKwhColumn(values) + (kwhHeaderMatch ? 0.3 : 0);
      if (score > bestKwhScore) {
        bestKwhScore = score;
        bestKwhCol = col;
      }
    }
  }

  const needsConfirmation = bestTimestampScore < 0.5 || bestKwhScore < 0.5;

  if (needsConfirmation) {
    warnings.push("Could not confidently detect columns. Please verify.");
  }

  // Parse the data
  const data = [];
  let parseErrors = 0;

  for (const row of dataRows) {
    const tsRaw = bestTimestampCol >= 0 && bestTimestampCol < row.length ? row[bestTimestampCol] : null;
    const kwhRaw = bestKwhCol >= 0 && bestKwhCol < row.length ? row[bestKwhCol] : null;

    const ts = tryParseDate(String(tsRaw || ""));
    const kwh = parseFloat(kwhRaw);

    if (ts && !isNaN(kwh) && kwh >= 0) {
      data.push({ timestamp: ts, kwh });
    } else {
      parseErrors++;
    }
  }

  if (parseErrors > dataRows.length * 0.1) {
    warnings.push(`${parseErrors} rows could not be parsed (${Math.round(100 * parseErrors / dataRows.length)}%).`);
  }

  // Sort by timestamp
  data.sort((a, b) => a.timestamp - b.timestamp);

  // Validate: check for implausibly large values
  const highValues = data.filter((d) => d.kwh > 5);
  if (highValues.length > data.length * 0.05) {
    warnings.push("Some readings exceed 5 kWh per half hour — this may indicate non-residential data or a different interval.");
  }

  const preview = rows.slice(0, 6);

  return { data, warnings, needsConfirmation, preview };
}
