/**
 * Excel Parser — converts .xlsx / .xls files to CSV text so the existing
 * csvParser can handle column detection and data normalisation.
 *
 * Uses SheetJS (xlsx) to read the workbook and convert the first sheet to CSV.
 */

import { read, utils } from "xlsx";

/**
 * Convert an ArrayBuffer containing an Excel file (.xlsx/.xls) into a CSV
 * string suitable for passing to parseCSV().
 *
 * If the workbook has multiple sheets, the first sheet is used.
 */
export function excelToCSV(arrayBuffer) {
  const workbook = read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return utils.sheet_to_csv(sheet);
}
