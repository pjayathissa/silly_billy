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
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

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

  if (loading) {
    return (
      <div className="upload-screen">
        <div className="processing-overlay">
          <div className="spinner" />
          <p className="processing-text">Analysing your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-screen">
      <div className="hero">
        <div className="hero-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </div>
        <h1>Silly Billy</h1>
        <p className="hero-tagline">Analyse your actual electricity data.</p>
        <div className="privacy-label">
          <button
            className="privacy-badge"
            onClick={() => setPrivacyExpanded((v) => !v)}
            aria-expanded={privacyExpanded}
          >
            <svg className="privacy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Your data is private and stays on your device{" "}
            <span className="privacy-more">({privacyExpanded ? "less info" : "more info"})</span>
          </button>
          {privacyExpanded && (
            <p className="privacy-detail">
              Silly Billy is an application that runs entirely on your device.
              The spreadsheets and PDF&apos;s that you upload do not leave your
              device, and therefore don&apos;t touch any server or database. The
              data you provide is not used for any training purposes.
            </p>
          )}
        </div>
      </div>

      <ol className="steps-list">
        <li>Request 12 months electricity data from your retailer in CSV or Excel format</li>
        <li>Upload the file below</li>
        <li>Optional — upload a PDF copy of your bill to auto-detect your current plan</li>
      </ol>

      <div className="upload-boxes">
        <label className={`upload-box ${dataFile ? "has-file" : ""}`}>
          <span className="upload-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </span>
          <span className="upload-label">Consumption Data</span>
          <span className="upload-hint">CSV or Excel - Half-hourly readings</span>
          {dataFile && (
            <span className="file-name">
              <span className="file-check">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {dataFile.name}
            </span>
          )}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setDataFile(e.target.files[0] || null)}
          />
        </label>

        <label className={`upload-box ${pdfFile ? "has-file" : ""}`}>
          <span className="upload-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
          </span>
          <span className="upload-label">Electricity Bill</span>
          <span className="upload-hint">PDF - Optional — auto-detects your plan</span>
          {pdfFile && (
            <span className="file-name">
              <span className="file-check">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {pdfFile.name}
            </span>
          )}
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdfFile(e.target.files[0] || null)}
          />
        </label>
      </div>

      <button
        className="primary-btn"
        disabled={!dataFile}
        onClick={handleSubmit}
      >
        Analyse My Usage
      </button>
    </div>
  );
}
