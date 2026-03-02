/**
 * PDF Tariff Extractor — extracts current tariff details from an electricity bill.
 *
 * Uses pdf.js to extract text, then pattern-matches for:
 *   - Retailer name
 *   - Plan name
 *   - Daily fixed charge (cents/day)
 *   - Peak rate (cents/kWh)
 *   - Off-peak rate (cents/kWh)
 */

import * as pdfjsLib from "pdfjs-dist";

// Point pdf.js to its worker bundle
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).href;

// Known NZ retailers for matching
const RETAILERS = [
  "Mercury", "Meridian", "Genesis", "Contact", "Electric Kiwi",
  "Flick Electric", "Flick", "Frank Energy", "Octopus Energy",
  "Octopus", "Nova Energy", "Nova", "Pulse Energy", "Pulse",
  "Powershop", "Trustpower",
];

/**
 * Extract all text from a PDF file (as ArrayBuffer).
 */
async function extractText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push(text);
  }
  return pages.join("\n");
}

/**
 * Try to find a retailer name in the text.
 */
function findRetailer(text) {
  for (const name of RETAILERS) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      // Return the canonical form
      return name;
    }
  }
  return "";
}

/**
 * Extract a rate in cents/kWh from text near a keyword.
 * Looks for patterns like "28.50c/kWh", "28.50 cents per kWh", "$0.285/kWh", etc.
 */
function findRate(text, keywords) {
  for (const keyword of keywords) {
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) continue;

    // Search nearby text (200 chars after keyword)
    const nearby = text.substring(idx, idx + 200);

    // Pattern: number followed by c/kWh or cents/kWh
    const centsMatch = nearby.match(/(\d+\.?\d*)\s*(?:c|cents?)[\s/]*(?:per\s*)?kWh/i);
    if (centsMatch) return parseFloat(centsMatch[1]);

    // Pattern: $X.XXX/kWh (dollar amount per kWh)
    const dollarMatch = nearby.match(/\$\s*(\d+\.?\d*)\s*[/\s]*(?:per\s*)?kWh/i);
    if (dollarMatch) return parseFloat(dollarMatch[1]) * 100;

    // Pattern: just a number near the keyword that looks like a rate
    const numMatch = nearby.match(/(\d{1,3}\.\d{1,4})/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      // If it looks like cents (10–60), use directly; if looks like dollars (0.1–0.6), convert
      if (val >= 10 && val <= 60) return val;
      if (val > 0 && val < 1) return val * 100;
    }
  }
  return null;
}

/**
 * Extract daily charge in cents/day.
 */
function findDailyCharge(text) {
  const keywords = ["daily", "fixed charge", "daily charge", "daily fee", "service charge"];
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx === -1) continue;
    const nearby = text.substring(idx, idx + 150);

    // cents/day pattern
    const centsMatch = nearby.match(/(\d+\.?\d*)\s*(?:c|cents?)[\s/]*(?:per\s*)?day/i);
    if (centsMatch) return parseFloat(centsMatch[1]);

    // dollar/day pattern
    const dollarMatch = nearby.match(/\$\s*(\d+\.?\d*)\s*[/\s]*(?:per\s*)?day/i);
    if (dollarMatch) return parseFloat(dollarMatch[1]) * 100;

    // Just a number near "daily"
    const numMatch = nearby.match(/(\d{1,3}\.\d{1,2})/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      if (val > 0 && val < 5) return val * 100; // Likely dollars
      if (val >= 30 && val <= 400) return val;   // Likely cents
    }
  }
  return null;
}

/**
 * Try to find a plan name in the text.
 */
function findPlanName(text) {
  const patterns = [
    /plan[:\s]+([A-Za-z\s]+?)(?:\n|,|\.|$)/i,
    /tariff[:\s]+([A-Za-z\s]+?)(?:\n|,|\.|$)/i,
    /rate[:\s]+([A-Za-z\s]+?)(?:\n|,|\.|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().substring(0, 40);
  }
  return "";
}

/**
 * Main extraction function. Returns an object with extracted tariff details.
 * Fields may be null/empty if not found.
 */
export async function extractTariffFromPDF(arrayBuffer) {
  try {
    const text = await extractText(arrayBuffer);

    return {
      retailer: findRetailer(text),
      plan: findPlanName(text),
      dailyCharge: findDailyCharge(text),
      peakRate: findRate(text, ["peak", "day rate", "unit rate", "variable", "usage rate", "energy charge"]),
      offPeakRate: findRate(text, ["off-peak", "off peak", "night rate", "overnight", "controlled"]),
    };
  } catch (err) {
    console.error("PDF parsing error:", err);
    return { retailer: "", plan: "", dailyCharge: null, peakRate: null, offPeakRate: null };
  }
}
