import { useState, useCallback } from "react";

/**
 * Upload screen — lets the user upload a CSV or Excel file (consumption data)
 * and a PDF (bill).
 * Calls onUpload({ csvContent, pdfBuffer }) when both are ready.
 * Excel files (.xlsx, .xls) are converted to CSV before being passed upstream.
 */
export default function UploadScreen({ onUpload }) {
  const [dataFile, setDataFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!dataFile) return;
    setLoading(true);

    const isExcel = /\.xlsx?$/i.test(dataFile.name);
    let csvContent;
    if (isExcel) {
      const { excelToCSV } = await import("../utils/excelParser.js");
      const buf = await dataFile.arrayBuffer();
      csvContent = excelToCSV(buf);
    } else {
      csvContent = await dataFile.text();
    }

    const pdfBuffer = pdfFile ? await pdfFile.arrayBuffer() : null;

    onUpload({ csvContent, pdfBuffer });
  }, [dataFile, pdfFile, onUpload]);

  return (
    <div className="upload-screen">
      <h1>Energy Bill Analyst</h1>
      <ol className="subtitle">
        <li>Request 12 months electricity data from your retailer in csv or Excel format</li>
        <li>Upload the file below</li>
        <li>Optional - upload a pdf copy of your bill</li>
      </ol>

      <div className="upload-boxes">
        <label className={`upload-box ${dataFile ? "has-file" : ""}`}>
          <span className="upload-label">Consumption Data (CSV / Excel)</span>
          <span className="upload-hint">Half-hourly readings, 6–12 months</span>
          {dataFile && <span className="file-name">{dataFile.name}</span>}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setDataFile(e.target.files[0] || null)}
          />
        </label>

        <label className={`upload-box ${pdfFile ? "has-file" : ""}`}>
          <span className="upload-label">Electricity Bill (PDF)</span>
          <span className="upload-hint">Optional — to auto-detect your current plan</span>
          {pdfFile && <span className="file-name">{pdfFile.name}</span>}
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files[0] || null)}
          />
        </label>
      </div>

      <button
        className="primary-btn"
        disabled={!dataFile || loading}
        onClick={handleSubmit}
      >
        {loading ? "Processing…" : "Analyse"}
      </button>
    </div>
  );
}
