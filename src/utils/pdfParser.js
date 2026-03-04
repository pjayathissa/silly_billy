/**
 * PDF Tariff Extractor — extracts current tariff details from an electricity bill.
 *
 * Key parsing strategies:
 * 1. Line-aware text extraction using Y-coordinates to preserve table row structure
 * 2. Per-line scanning: each reconstructed line is checked for keywords + rate values
 * 3. Fallback keyword-proximity search for values the line scanner misses
 * 4. Support for cents and dollar formats common in NZ electricity bills
 */

import * as pdfjsLib from "pdfjs-dist";

// Point pdf.js to its worker bundle
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).href;

// Known NZ retailers for matching (longer names first to prefer e.g. "Flick Electric" over "Flick")
const RETAILERS = [
  "Electric Kiwi", "Flick Electric", "Frank Energy", "Octopus Energy",
  "Nova Energy", "Pulse Energy", "Powershop", "Trustpower",
  "Mercury", "Meridian", "Genesis", "Contact",
  "Flick", "Octopus", "Nova", "Pulse",
];

// ── Keyword sets for line classification ─────────────────────

const DAILY_KEYWORDS = [
  "daily charge", "daily fee", "fixed charge", "fixed daily",
  "service charge", "service fee", "connection charge",
  "low user daily", "standard user daily", "daily fixed",
  "daily supply", "supply charge", "lines charge",
];

const PEAK_KEYWORDS = [
  "anytime", "uncontrolled", "day rate", "unit rate",
  "all day", "24 hour", "general usage", "standard rate",
  "usage rate", "variable rate", "all inclusive",
  "normal rate", "peak",
];

const OFFPEAK_KEYWORDS = [
  "off-peak", "off peak", "offpeak", "night rate",
  "overnight", "controlled", "economy", "shoulder",
  "ev rate", "night",
];

// Lines containing these keywords are skipped (totals, headers, etc.)
const SKIP_KEYWORDS = [
  "total", "subtotal", "sub-total", "gst", "tax",
  "balance", "amount due", "credit", "discount",
  "payment", "reading",
];

// ── Text extraction ──────────────────────────────────────────

/**
 * Extract text from a PDF, reconstructing lines using Y-coordinates.
 * Groups text items that share the same vertical position into a single line,
 * which preserves table row structure critical for parsing rate tables.
 */
async function extractText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const lineMap = new Map();
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      // Round Y to nearest 3 units (~1mm) to group items on the same line
      const y = Math.round(item.transform[5] / 3) * 3;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push({ x: item.transform[4], str: item.str });
    }

    // Sort lines top-to-bottom (higher Y = higher on page), items left-to-right
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    const lines = sortedYs.map((y) => {
      const items = lineMap.get(y).sort((a, b) => a.x - b.x);
      return items.map((it) => it.str).join("  ");
    });

    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

// ── Retailer & plan detection ────────────────────────────────

function findRetailer(text) {
  const lower = text.toLowerCase();
  for (const name of RETAILERS) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  return "";
}

function findPlanName(text) {
  const patterns = [
    /plan\s*(?:name)?[:\s]+([A-Za-z][\w\s]*?)(?:\n|,|\.|$)/im,
    /pricing\s*plan[:\s]+([A-Za-z][\w\s]*?)(?:\n|,|\.|$)/im,
    /tariff[:\s]+([A-Za-z][\w\s]*?)(?:\n|,|\.|$)/im,
    /rate\s*(?:type)?[:\s]+([A-Za-z][\w\s]*?)(?:\n|,|\.|$)/im,
    /product[:\s]+([A-Za-z][\w\s]*?)(?:\n|,|\.|$)/im,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const name = m[1].trim();
      if (name.length >= 2 && name.length <= 40) return name;
    }
  }
  return "";
}

// ── Rate extraction from a single line ───────────────────────

/**
 * Extract a per-kWh rate (in cents) from a line of text.
 * Tries explicit unit patterns first, then heuristic fallback.
 */
function extractKwhRateFromLine(line) {
  let m;

  // 1. Explicit: XX.XX c/kWh or cents/kWh or cents per kWh
  m = line.match(/(\d+\.?\d*)\s*(?:c|cents?)[\s/]*(?:per\s*)?kWh/i);
  if (m) return parseFloat(m[1]);

  // 2. Explicit: $X.XXXX/kWh or $X.XXXX per kWh
  m = line.match(/\$\s*(\d+\.\d+)\s*(?:\/|\s*per\s*)kWh/i);
  if (m) return parseFloat(m[1]) * 100;

  // 3. Explicit: per kWh $X.XXXX (unit before amount)
  m = line.match(/per\s*kWh\s*\$\s*(\d+\.\d+)/i);
  if (m) return parseFloat(m[1]) * 100;

  // 4. Heuristic: dollar amount on a line that mentions kWh
  if (/kWh/i.test(line)) {
    const dollarMatches = [...line.matchAll(/\$\s*(\d+\.\d{2,4})/g)];
    for (const dm of dollarMatches) {
      const val = parseFloat(dm[1]);
      if (val > 0 && val < 1) return val * 100; // $0.2442 → 24.42c
    }
  }

  // 5. Heuristic: standalone number that looks like a rate (no $ on the line)
  if (!line.includes("$")) {
    const nums = [...line.matchAll(/(\d{1,2}\.\d{1,4})/g)];
    for (const nm of nums) {
      const val = parseFloat(nm[1]);
      if (val >= 5 && val <= 60) return val;          // Looks like cents/kWh
      if (val > 0.05 && val < 0.60) return val * 100; // Looks like $/kWh
    }
  }

  return null;
}

/**
 * Extract a daily charge (in cents) from a line of text.
 */
function extractDailyRateFromLine(line) {
  let m;

  // 1. Explicit: XX.XX c/day or cents/day or cents per day
  m = line.match(/(\d+\.?\d*)\s*(?:c|cents?)[\s/]*(?:per\s*)?day/i);
  if (m) return parseFloat(m[1]);

  // 2. Explicit: $X.XX/day or $X.XX per day
  m = line.match(/\$\s*(\d+\.\d+)\s*(?:\/|\s*per\s*)day/i);
  if (m) return parseFloat(m[1]) * 100;

  // 3. Explicit: per day $X.XX (unit before amount)
  m = line.match(/per\s*day\s*\$\s*(\d+\.\d+)/i);
  if (m) return parseFloat(m[1]) * 100;

  // 4. Heuristic: dollar amount that looks like a daily rate ($0.30–$5.00)
  const dollarMatches = [...line.matchAll(/\$\s*(\d+\.\d{2,4})/g)];
  for (const dm of dollarMatches) {
    const val = parseFloat(dm[1]);
    if (val > 0 && val < 5) return val * 100; // $2.30 → 230c
  }

  // 5. Heuristic: standalone number in daily-charge range (no $ on the line)
  if (!line.includes("$")) {
    const nums = [...line.matchAll(/(\d{1,3}\.\d{1,4})/g)];
    for (const nm of nums) {
      const val = parseFloat(nm[1]);
      if (val >= 30 && val <= 400) return val;     // Looks like cents/day
      if (val > 0 && val < 5) return val * 100;    // Looks like $/day
    }
  }

  return null;
}

// ── Line-based rate scanner ──────────────────────────────────

/**
 * Scan all reconstructed lines for rate data. Each line is classified by
 * keywords (daily / peak / off-peak) and the rate value is extracted from
 * that same line, ensuring the keyword and value come from the same table row.
 */
function scanLinesForRates(text) {
  const lines = text.split("\n");
  const results = { dailyCharge: null, peakRate: null, offPeakRate: null };

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Skip lines without any digits
    if (!/\d/.test(line)) continue;

    // Skip total / GST / balance lines
    if (SKIP_KEYWORDS.some((kw) => lower.includes(kw))) continue;

    // Classify the line
    const isDaily =
      DAILY_KEYWORDS.some((kw) => lower.includes(kw)) ||
      (lower.includes("daily") && !/kWh/i.test(line));

    // Guard: "uncontrolled" contains "controlled" — don't let it trigger off-peak
    const hasUncontrolled = lower.includes("uncontrolled");
    const isOffPeak =
      !hasUncontrolled &&
      OFFPEAK_KEYWORDS.some((kw) => lower.includes(kw));

    const isPeak =
      !isOffPeak && !isDaily &&
      PEAK_KEYWORDS.some((kw) => lower.includes(kw));

    // Extract the appropriate rate from this line
    if (isDaily && results.dailyCharge === null) {
      const val = extractDailyRateFromLine(line);
      if (val !== null) results.dailyCharge = val;
    } else if (isOffPeak && results.offPeakRate === null) {
      const val = extractKwhRateFromLine(line);
      if (val !== null) results.offPeakRate = val;
    } else if (isPeak && results.peakRate === null) {
      const val = extractKwhRateFromLine(line);
      if (val !== null) results.peakRate = val;
    }
  }

  return results;
}

// ── Fallback keyword-proximity search ────────────────────────

/**
 * Fallback: search for a rate near keywords in the full text blob.
 * Used when line-based scanning misses a value.
 */
function findRateNearKeyword(text, keywords) {
  for (const keyword of keywords) {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) continue;
    const nearby = text.substring(idx, idx + 300);

    // cents/kWh
    const centsMatch = nearby.match(
      /(\d+\.?\d*)\s*(?:c|cents?)[\s/]*(?:per\s*)?kWh/i,
    );
    if (centsMatch) return parseFloat(centsMatch[1]);

    // $/kWh
    const dollarMatch = nearby.match(
      /\$\s*(\d+\.\d+)\s*(?:[/\s]*(?:per\s*)?)?kWh/i,
    );
    if (dollarMatch) return parseFloat(dollarMatch[1]) * 100;

    // Numeric heuristic
    const numMatch = nearby.match(/(\d{1,3}\.\d{1,4})/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      if (val >= 5 && val <= 60) return val;
      if (val > 0 && val < 1) return val * 100;
    }
  }
  return null;
}

function findDailyChargeNearKeyword(text) {
  const keywords = [
    "daily charge", "daily fee", "fixed charge", "daily fixed",
    "service charge", "low user daily", "standard user daily",
    "supply charge", "daily supply", "connection charge",
  ];
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx === -1) continue;
    const nearby = text.substring(idx, idx + 200);

    const centsMatch = nearby.match(
      /(\d+\.?\d*)\s*(?:c|cents?)[\s/]*(?:per\s*)?day/i,
    );
    if (centsMatch) return parseFloat(centsMatch[1]);

    const dollarMatch = nearby.match(
      /\$\s*(\d+\.\d+)\s*(?:[/\s]*(?:per\s*)?)?day/i,
    );
    if (dollarMatch) return parseFloat(dollarMatch[1]) * 100;

    const numMatch = nearby.match(/(\d{1,3}\.\d{1,2})/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      if (val > 0 && val < 5) return val * 100;
      if (val >= 30 && val <= 400) return val;
    }
  }
  return null;
}

// ── Main export ──────────────────────────────────────────────

/**
 * Main extraction function. Returns an object with extracted tariff details.
 * Fields may be null/empty if not found.
 */
export async function extractTariffFromPDF(arrayBuffer) {
  try {
    const text = await extractText(arrayBuffer);

    // Primary: line-based scanning (preserves table row context)
    const lineRates = scanLinesForRates(text);

    // Fallback keyword-proximity search for any values the line scanner missed
    return {
      retailer: findRetailer(text),
      plan: findPlanName(text),
      dailyCharge:
        lineRates.dailyCharge ?? findDailyChargeNearKeyword(text),
      peakRate:
        lineRates.peakRate ??
        findRateNearKeyword(text, [
          "anytime", "uncontrolled", "peak", "day rate", "unit rate",
          "all day", "variable rate", "usage rate", "energy rate",
        ]),
      offPeakRate:
        lineRates.offPeakRate ??
        findRateNearKeyword(text, [
          "off-peak", "off peak", "night rate", "overnight",
          "controlled", "economy", "shoulder",
        ]),
    };
  } catch (err) {
    console.error("PDF parsing error:", err);
    return {
      retailer: "",
      plan: "",
      dailyCharge: null,
      peakRate: null,
      offPeakRate: null,
    };
  }
}
