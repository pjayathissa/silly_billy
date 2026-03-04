import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseCSV } from "../src/utils/csvParser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(name) {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

// ─── Long format tests ─────────────────────────────────────────

describe("parseCSV — long format", () => {
  const csv = readFixture("long-format.csv");
  const result = parseCSV(csv);

  it("parses all 48 rows without errors", () => {
    expect(result.data.length).toBe(48);
  });

  it("returns no critical warnings", () => {
    // There should be no "Could not confidently detect" warning
    const critical = result.warnings.filter((w) =>
      w.includes("Could not confidently detect")
    );
    expect(critical).toHaveLength(0);
  });

  it("does not need user confirmation", () => {
    expect(result.needsConfirmation).toBe(false);
  });

  it("uses read_start as the timestamp column (not read_end)", () => {
    const first = result.data[0];
    // First row: read_start = 2025-03-03 00:00:00
    expect(first.timestamp.getFullYear()).toBe(2025);
    expect(first.timestamp.getMonth()).toBe(2); // March = month 2
    expect(first.timestamp.getDate()).toBe(3);
    expect(first.timestamp.getHours()).toBe(0);
    expect(first.timestamp.getMinutes()).toBe(0);
  });

  it("correctly parses kWh values from the kwh column", () => {
    const first = result.data[0];
    expect(first.kwh).toBeCloseTo(0.349, 3);

    const last = result.data[result.data.length - 1];
    expect(last.kwh).toBeCloseTo(0.255, 3);
  });

  it("data is sorted chronologically", () => {
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        result.data[i - 1].timestamp.getTime()
      );
    }
  });

  it("all kWh values are non-negative", () => {
    for (const d of result.data) {
      expect(d.kwh).toBeGreaterThanOrEqual(0);
    }
  });

  it("timestamps are spaced 30 minutes apart", () => {
    for (let i = 1; i < result.data.length; i++) {
      const diff = result.data[i].timestamp - result.data[i - 1].timestamp;
      expect(diff).toBe(30 * 60 * 1000); // 30 minutes in ms
    }
  });

  it("total consumption is reasonable (sum of 48 half-hours)", () => {
    const total = result.data.reduce((sum, d) => sum + d.kwh, 0);
    // 48 readings, each between ~0.25 and ~1.77, sum should be around 23 kWh
    expect(total).toBeGreaterThan(10);
    expect(total).toBeLessThan(50);
  });

  it("returns a preview of raw data", () => {
    expect(result.preview).toBeDefined();
    expect(result.preview.length).toBeGreaterThanOrEqual(5);
  });
});

// ─── Wide format tests ──────────────────────────────────────────

describe("parseCSV — wide format", () => {
  const csv = readFixture("wide-format.csv");
  const result = parseCSV(csv);

  it("parses 9 days × 48 slots = 432 readings", () => {
    expect(result.data.length).toBe(432);
  });

  it("returns no critical warnings", () => {
    const critical = result.warnings.filter((w) =>
      w.includes("Could not confidently detect")
    );
    expect(critical).toHaveLength(0);
  });

  it("does not need user confirmation", () => {
    expect(result.needsConfirmation).toBe(false);
  });

  it("first reading is 2025-03-03 00:00 with correct kWh", () => {
    const first = result.data[0];
    expect(first.timestamp.getFullYear()).toBe(2025);
    expect(first.timestamp.getMonth()).toBe(2); // March
    expect(first.timestamp.getDate()).toBe(3);
    expect(first.timestamp.getHours()).toBe(0);
    expect(first.timestamp.getMinutes()).toBe(0);
    expect(first.kwh).toBeCloseTo(0.349, 3);
  });

  it("last reading is 2025-03-11 23:30 with correct kWh", () => {
    const last = result.data[result.data.length - 1];
    expect(last.timestamp.getFullYear()).toBe(2025);
    expect(last.timestamp.getMonth()).toBe(2);
    expect(last.timestamp.getDate()).toBe(11);
    expect(last.timestamp.getHours()).toBe(23);
    expect(last.timestamp.getMinutes()).toBe(30);
    expect(last.kwh).toBeCloseTo(0.321, 3);
  });

  it("data is sorted chronologically", () => {
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        result.data[i - 1].timestamp.getTime()
      );
    }
  });

  it("all kWh values are non-negative", () => {
    for (const d of result.data) {
      expect(d.kwh).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns a preview of raw data", () => {
    expect(result.preview).toBeDefined();
    expect(result.preview.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Cross-format consistency ───────────────────────────────────

describe("parseCSV — cross-format consistency", () => {
  it("wide and long formats produce the same data for matching rows", () => {
    const longResult = parseCSV(readFixture("long-format.csv"));
    const wideResult = parseCSV(readFixture("wide-format.csv"));

    // The long-format fixture has 48 rows for 2025-03-03 only.
    // The wide-format fixture has 3 days. Filter to just 2025-03-03.
    const wideDay1 = wideResult.data.filter(
      (d) => d.timestamp.getDate() === 3 && d.timestamp.getMonth() === 2
    );

    expect(wideDay1.length).toBe(48);
    expect(longResult.data.length).toBe(48);

    for (let i = 0; i < 48; i++) {
      expect(wideDay1[i].timestamp.getTime()).toBe(
        longResult.data[i].timestamp.getTime()
      );
      expect(wideDay1[i].kwh).toBeCloseTo(longResult.data[i].kwh, 3);
    }
  });
});

// ─── MERX format tests (no header row, DD/MM/YYYY HH:mm:ss) ────

describe("parseCSV — MERX format (headerless long format)", () => {
  const csv = readFixture("merx-format.csv");
  const result = parseCSV(csv);

  it("does not need user confirmation", () => {
    expect(result.needsConfirmation).toBe(false);
  });

  it("interprets DD/MM/YYYY dates as NZ format (not US MM/DD)", () => {
    // 11/02/2025 should be February 11, not November 2
    const allInFeb = result.data.every(
      (d) => d.timestamp.getMonth() === 1 // January=0, February=1
    );
    expect(allInFeb).toBe(true);

    const anyInNov = result.data.some(
      (d) => d.timestamp.getMonth() === 10 // November=10
    );
    expect(anyInNov).toBe(false);
  });

  it("picks the correct kWh column (not the all-zero column)", () => {
    // Column 3 has "000" (all zeros). Column 12 has actual readings.
    const nonZero = result.data.filter((d) => d.kwh > 0);
    expect(nonZero.length).toBeGreaterThan(0);

    // Most half-hourly readings are 0.02–0.76
    const typicalReadings = result.data.filter(
      (d) => d.kwh > 0 && d.kwh < 1
    );
    expect(typicalReadings.length).toBeGreaterThan(50);
  });

  it("first reading is 11 Feb 2025 00:00", () => {
    const first = result.data[0];
    expect(first.timestamp.getFullYear()).toBe(2025);
    expect(first.timestamp.getMonth()).toBe(1); // February
    expect(first.timestamp.getDate()).toBe(11);
  });

  it("data is sorted chronologically", () => {
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        result.data[i - 1].timestamp.getTime()
      );
    }
  });

  it("all kWh values are non-negative", () => {
    for (const d of result.data) {
      expect(d.kwh).toBeGreaterThanOrEqual(0);
    }
  });

  // ─── Summary row handling ─────────────────────────────────

  it("removes summary rows that span longer than 30 minutes", () => {
    // The fixture has 3 summary rows: 7.94, 1.06, 20.66 kWh
    // After removal, no reading should exceed ~1 kWh
    const highValues = result.data.filter((d) => d.kwh > 5);
    expect(highValues).toHaveLength(0);
  });

  it("fills gaps with previous day's profile to produce complete days", () => {
    // Fixture: Feb 11 = 48 half-hourly, Feb 12 = 10 half-hourly + summary,
    // Feb 13 gap = covered by 20.66 summary ending 13/02/2025 23:59:53.
    // After filling: 3 complete days × 48 = 144 readings.
    expect(result.data.length).toBe(144);

    // Each day should have 48 readings
    const byDate = {};
    for (const d of result.data) {
      const key = d.timestamp.toLocaleDateString("en-NZ");
      byDate[key] = (byDate[key] || 0) + 1;
    }
    expect(Object.keys(byDate)).toHaveLength(3);
    for (const count of Object.values(byDate)) {
      expect(count).toBe(48);
    }
  });

  it("approximated readings use the previous day's consumption profile", () => {
    // Feb 12 05:00–23:30 should be filled from Feb 11's readings.
    // Feb 11 12:00 has kWh=0.76, so Feb 12 12:00 (filled) should match.
    const feb11noon = result.data.find(
      (d) => d.timestamp.getDate() === 11 && d.timestamp.getHours() === 12 && d.timestamp.getMinutes() === 0
    );
    const feb12noon = result.data.find(
      (d) => d.timestamp.getDate() === 12 && d.timestamp.getHours() === 12 && d.timestamp.getMinutes() === 0
    );
    expect(feb11noon).toBeDefined();
    expect(feb12noon).toBeDefined();
    expect(feb12noon.kwh).toBe(feb11noon.kwh);
  });

  it("emits a warning about aggregated summary rows", () => {
    const summaryWarning = result.warnings.find((w) =>
      w.includes("span longer than 30 minutes")
    );
    expect(summaryWarning).toBeDefined();
    expect(summaryWarning).toContain("3 reading(s)");
    expect(summaryWarning).toContain("approximated");
  });
});

// ─── CTCT format tests (extra trailing column of zeros) ─────────

describe("parseCSV — CTCT format", () => {
  const csv = readFixture("ctct-format.csv");
  const result = parseCSV(csv);

  it("parses all 50 half-hourly readings", () => {
    expect(result.data.length).toBe(50);
  });

  it("does not need user confirmation", () => {
    expect(result.needsConfirmation).toBe(false);
  });

  it("picks the real kWh column, not a timestamp column", () => {
    // Timestamp strings like "01/12/2024 00:00:01" must not be mistaken
    // for kWh via partial parseFloat (which would yield 1).
    const suspectValues = result.data.filter(
      (d) => d.kwh === 1 || d.kwh === 2
    );
    // The fixture has no actual kWh readings of exactly 1.00 or 2.00
    expect(suspectValues).toHaveLength(0);
  });

  it("correctly reads kWh values from column 12", () => {
    expect(result.data[0].kwh).toBeCloseTo(0.09, 2);
    expect(result.data[4].kwh).toBeCloseTo(0.51, 2);
    // Row with 1.08 kWh (09:00 slot)
    const highReading = result.data.find((d) => d.kwh > 1);
    expect(highReading).toBeDefined();
    expect(highReading.kwh).toBeCloseTo(1.08, 2);
  });

  it("interprets 01/12/2024 as December 1 (DD/MM/YYYY)", () => {
    const allDec = result.data.every(
      (d) => d.timestamp.getMonth() === 11 // December
    );
    expect(allDec).toBe(true);
  });

  it("data is sorted chronologically", () => {
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        result.data[i - 1].timestamp.getTime()
      );
    }
  });

  it("all kWh values are non-negative", () => {
    for (const d of result.data) {
      expect(d.kwh).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Edge cases ─────────────────────────────────────────────────

describe("parseCSV — edge cases", () => {
  it("returns error for too few rows", () => {
    const csv = "a,b,c\n1,2,3\n";
    const result = parseCSV(csv);
    expect(result.data).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("too few rows"))).toBe(true);
  });

  it("handles empty file gracefully", () => {
    const result = parseCSV("");
    expect(result.data).toHaveLength(0);
  });

  it("ignores rows with negative kWh values", () => {
    const rows = [];
    rows.push("timestamp,kwh");
    // Need at least 10 rows for the parser to proceed
    for (let i = 0; i < 12; i++) {
      const h = String(i).padStart(2, "0");
      rows.push(`2025-03-03 ${h}:00:00,${i === 5 ? -0.5 : 0.3}`);
    }
    const result = parseCSV(rows.join("\n"));
    // The negative row should be excluded
    expect(result.data.every((d) => d.kwh >= 0)).toBe(true);
    expect(result.data.length).toBe(11); // 12 - 1 negative
  });
});
