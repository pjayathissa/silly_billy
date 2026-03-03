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

  it("parses readings from the data", () => {
    // 108 DET rows total (including 3 summary rows)
    expect(result.data.length).toBeGreaterThanOrEqual(100);
  });

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

  it("first half-hourly reading is 11 Feb 2025 00:00", () => {
    // First data point (may be a summary row at same timestamp)
    const firstFeb11 = result.data.find(
      (d) => d.timestamp.getDate() === 11 && d.kwh < 1
    );
    expect(firstFeb11).toBeDefined();
    expect(firstFeb11.timestamp.getFullYear()).toBe(2025);
    expect(firstFeb11.timestamp.getMonth()).toBe(1); // February
    expect(firstFeb11.timestamp.getDate()).toBe(11);
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
