/**
 * CSV Parser — auto-detects column layout for half-hourly electricity data.
 *
 * Supports two formats:
 *   A. "Wide" format — one row per day, 48 columns for half-hourly slots
 *      (e.g. ID12_00AM, ID12_30AM, …, ID11_30PM or HH:MM headers)
 *   B. "Long" format — one row per reading with a timestamp and kWh column
 *
 * Strategy:
 *   1. Parse CSV with PapaParse
 *   2. Detect wide format by matching time-slot column headers
 *   3. If wide: find the date column, expand rows into 48 readings each
 *   4. If long: find the timestamp column and kWh column by header names + data patterns
 *   5. Validate values are reasonable for residential half-hourly data (0–5 kWh)
 *   6. Return normalised array of { timestamp: Date, kwh: number }
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

// ─── Wide-format time-slot header patterns ──────────────────

/**
 * Match headers like ID12_00AM, ID01_30PM (NZ retailer format).
 * Returns { hour24, minute } or null.
 */
function parseIdTimeHeader(header) {
  const m = header.match(/^ID(\d{2})_(\d{2})(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1]);
  const minute = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  // 12-hour to 24-hour conversion
  if (ampm === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }
  return { hour24: hour, minute };
}

/**
 * Match headers like "00:00", "00:30", "23:30" (HH:MM format).
 * Returns { hour24, minute } or null.
 */
function parseHhMmHeader(header) {
  const m = header.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = parseInt(m[1]);
  const minute = parseInt(m[2]);
  if (hour < 0 || hour > 23 || (minute !== 0 && minute !== 30)) return null;
  return { hour24: hour, minute };
}

/**
 * Match headers like "12:00 AM", "1:30 PM" (12-hour with space).
 * Returns { hour24, minute } or null.
 */
function parse12hHeader(header) {
  const m = header.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1]);
  const minute = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }
  return { hour24: hour, minute };
}

/**
 * Try all known time-slot header formats. Returns { hour24, minute } or null.
 */
function parseTimeSlotHeader(header) {
  return parseIdTimeHeader(header) || parseHhMmHeader(header) || parse12hHeader(header);
}

/**
 * Detect wide format and return time-slot column mappings.
 * Returns { isWide: true, timeColumns: [{ colIndex, hour24, minute }...], dateColIndex }
 * or { isWide: false }.
 */
function detectWideFormat(headers, dataRows) {
  if (!headers) return { isWide: false };

  const timeColumns = [];
  for (let i = 0; i < headers.length; i++) {
    const parsed = parseTimeSlotHeader(headers[i]);
    if (parsed) {
      timeColumns.push({ colIndex: i, ...parsed });
    }
  }

  // Need at least 24 time-slot columns to consider it wide format
  if (timeColumns.length < 24) return { isWide: false };

  // Sort by time of day
  timeColumns.sort((a, b) => a.hour24 * 60 + a.minute - (b.hour24 * 60 + b.minute));

  // Find the date column — look for a column with date-like values
  let dateColIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    // Skip columns already identified as time slots
    if (timeColumns.some((tc) => tc.colIndex === i)) continue;

    const headerName = headers[i];
    const isDateHeader = /date/i.test(headerName);
    if (isDateHeader) {
      dateColIndex = i;
      break;
    }
  }

  // If no header match, score columns by date-parsing success
  if (dateColIndex === -1) {
    let bestScore = 0;
    for (let i = 0; i < headers.length; i++) {
      if (timeColumns.some((tc) => tc.colIndex === i)) continue;
      const values = dataRows.slice(0, 20).map((r) => r[i]);
      const score = values.filter((v) => tryParseDate(String(v ?? "")) !== null).length;
      if (score > bestScore) {
        bestScore = score;
        dateColIndex = i;
      }
    }
  }

  return { isWide: true, timeColumns, dateColIndex };
}

/**
 * Parse wide-format CSV rows into normalised readings.
 * Each input row becomes up to 48 output readings.
 */
function parseWideFormat(dataRows, timeColumns, dateColIndex, warnings) {
  const data = [];
  let parseErrors = 0;

  for (const row of dataRows) {
    const dateRaw = dateColIndex >= 0 && dateColIndex < row.length ? row[dateColIndex] : null;
    const baseDate = tryParseDate(String(dateRaw ?? ""));
    if (!baseDate) {
      parseErrors++;
      continue;
    }

    for (const tc of timeColumns) {
      const val = tc.colIndex < row.length ? row[tc.colIndex] : null;
      const kwh = parseFloat(val);
      if (isNaN(kwh) || val === null || val === "") continue;
      if (kwh < 0) continue;

      const timestamp = new Date(baseDate);
      timestamp.setHours(tc.hour24, tc.minute, 0, 0);
      data.push({ timestamp, kwh });
    }
  }

  if (parseErrors > 0) {
    warnings.push(`${parseErrors} row(s) had unparseable dates and were skipped.`);
  }

  return data;
}

// ─── Date parsing ───────────────────────────────────────────

/**
 * Try to parse a string as a date. Returns Date or null.
 */
function tryParseDate(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (s.length < 6) return null;

  // Try DD/MM/YYYY or D/MM/YYYY (common in NZ) — date only, no time
  const dateOnly = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dateOnly) {
    const year = dateOnly[3].length === 2 ? 2000 + parseInt(dateOnly[3]) : parseInt(dateOnly[3]);
    const day = parseInt(dateOnly[1]);
    const month = parseInt(dateOnly[2]);
    // NZ uses DD/MM/YYYY — try that first
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime()) && d.getDate() === day) return d;
    // Fallback: MM/DD/YYYY
    const d2 = new Date(year, day - 1, month);
    if (!isNaN(d2.getTime()) && d2.getDate() === month) return d2;
  }

  // Try DD/MM/YYYY HH:mm:ss format (common in NZ) — must run before native
  // parse to avoid US-style MM/DD misinterpretation of slash-separated dates
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    const date = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6] || 0));
    if (!isNaN(date.getTime())) return date;
    // Try MM/DD instead of DD/MM
    const date2 = new Date(year, parseInt(m[1]) - 1, parseInt(m[2]), parseInt(m[4]), parseInt(m[5]));
    if (!isNaN(date2.getTime())) return date2;
  }

  // Try native parse (handles ISO formats like "2025-03-03 00:00:00")
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

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
 * Returns fraction of rows with reasonable kWh values,
 * penalised if all values are identical (e.g. a column of all zeros).
 */
function scoreKwhColumn(values) {
  const sample = values.slice(0, 50);
  const hits = sample.filter((v) => isReasonableKwh(v)).length;
  let score = hits / sample.length;

  // Penalise columns where every sampled value is the same — real consumption
  // data always has some variance.
  const nums = sample.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
  if (nums.length > 1) {
    const allSame = nums.every((n) => n === nums[0]);
    if (allSame) score *= 0.1;
  }

  return score;
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

  // ── Check for wide format (one row per day, 48 time-slot columns) ──
  const wideResult = detectWideFormat(headers, dataRows);
  if (wideResult.isWide) {
    const data = parseWideFormat(dataRows, wideResult.timeColumns, wideResult.dateColIndex, warnings);

    if (data.length === 0) {
      warnings.push("Wide format detected but no readings could be parsed.");
      return { data: [], warnings, needsConfirmation: true, preview: rows.slice(0, 6) };
    }

    data.sort((a, b) => a.timestamp - b.timestamp);

    const highValues = data.filter((d) => d.kwh > 5);
    if (highValues.length > data.length * 0.05) {
      warnings.push("Some readings exceed 5 kWh per half hour — this may indicate non-residential data or a different interval.");
    }

    return {
      data,
      warnings,
      needsConfirmation: false,
      preview: rows.slice(0, 6),
    };
  }

  // ── Long format: one row per reading ───────────────────────────────

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
