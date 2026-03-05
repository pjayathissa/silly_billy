import { useState, useCallback } from "react";

/**
 * Upload screen — lets the user upload a CSV (consumption data) and a PDF (bill).
 * Calls onUpload({ csvContent, pdfBuffer }) when both are ready.
 */
export default function UploadScreen({ onUpload }) {
  const [csvFile, setCsvFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!csvFile) return;
    setLoading(true);

    const csvContent = await csvFile.text();
    const pdfBuffer = pdfFile ? await pdfFile.arrayBuffer() : null;

    onUpload({ csvContent, pdfBuffer });
  }, [csvFile, pdfFile, onUpload]);

  return (
    <div className="upload-screen">
      <h1>Energy Bill Analyst</h1>
      <ol className="subtitle">
        <li>Request 12 months electricity data from your retailer in csv format</li>
        <li>Upload the csv file below</li>
        <li>Optional - upload a pdf copy of your bill</li>
      </ol>

      <div className="upload-boxes">
        <label className={`upload-box ${csvFile ? "has-file" : ""}`}>
          <span className="upload-label">Consumption Data (CSV)</span>
          <span className="upload-hint">Half-hourly readings, 6–12 months</span>
          {csvFile && <span className="file-name">{csvFile.name}</span>}
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files[0] || null)}
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
        disabled={!csvFile || loading}
        onClick={handleSubmit}
      >
        {loading ? "Processing…" : "Analyse"}
      </button>
    </div>
  );
}
