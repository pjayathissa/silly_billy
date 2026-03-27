import { useState, useCallback } from "react";
import UploadScreen from "./components/UploadScreen.jsx";
import TariffReview from "./components/TariffReview.jsx";
import Dashboard from "./components/Dashboard.jsx";
import StepIndicator from "./components/StepIndicator.jsx";
import { parseCSV } from "./utils/csvParser.js";
import { extractTariffFromPDF } from "./utils/pdfParser.js";

/**
 * Main application — manages the three-step flow:
 *   1. Upload (CSV + optional PDF)
 *   2. Tariff review (extracted/manual)
 *   3. Analysis dashboard
 */
export default function App() {
  // "upload" | "review" | "dashboard"
  const [step, setStep] = useState("upload");

  const [consumptionData, setConsumptionData] = useState(null);
  const [csvWarnings, setCsvWarnings] = useState([]);
  const [csvPreview, setCsvPreview] = useState(null);
  const [needsCsvConfirm, setNeedsCsvConfirm] = useState(false);

  const [extractedTariff, setExtractedTariff] = useState({});
  const [confirmedTariff, setConfirmedTariff] = useState(null);

  // Step 1 → Step 2: parse uploads and move to review
  const handleUpload = useCallback(async ({ csvContent, pdfBuffer }) => {
    // Parse CSV
    const csv = parseCSV(csvContent);
    setConsumptionData(csv.data);
    setCsvWarnings(csv.warnings);
    setCsvPreview(csv.needsConfirmation ? csv.preview : null);
    setNeedsCsvConfirm(csv.needsConfirmation);

    // Parse PDF if provided
    let tariff = { dailyCharge: null, peakRate: null, offPeakRate: null, baseRate: null };
    if (pdfBuffer) {
      tariff = await extractTariffFromPDF(pdfBuffer);
    }
    setExtractedTariff(tariff);

    setStep("review");
  }, []);

  // Step 2 → Step 3: confirm tariff and run analysis
  const handleTariffConfirm = useCallback((tariff) => {
    setConfirmedTariff(tariff);
    setStep("dashboard");
  }, []);

  // Allow restarting
  const handleReset = useCallback(() => {
    setStep("upload");
    setConsumptionData(null);
    setCsvWarnings([]);
    setCsvPreview(null);
    setExtractedTariff({});
    setConfirmedTariff(null);
  }, []);

  // Navigate to a previous step via step indicator
  const handleStepClick = useCallback((stepId) => {
    if (stepId === "upload") {
      handleReset();
    } else {
      setStep(stepId);
    }
  }, [handleReset]);

  return (
    <div className="app">
      {step !== "dashboard" && <StepIndicator currentStep={step} onStepClick={handleStepClick} />}

      {step !== "upload" && (
        <button className="reset-btn" onClick={handleReset}>
          Start over
        </button>
      )}

      {step === "upload" && <UploadScreen onUpload={handleUpload} />}

      {step === "review" && (
        <TariffReview
          extractedTariff={extractedTariff}
          confirmedTariff={confirmedTariff}
          csvWarnings={csvWarnings}
          csvPreview={csvPreview}
          onConfirmCsv={needsCsvConfirm ? () => setNeedsCsvConfirm(false) : null}
          onConfirm={handleTariffConfirm}
        />
      )}

      {step === "dashboard" && consumptionData && confirmedTariff && (
        <Dashboard data={consumptionData} currentTariff={confirmedTariff} onStepClick={handleStepClick} />
      )}

      <footer className="site-footer">
        <span>&copy; 2026 Silly Billy</span>
        <a href="https://github.com/pjayathissa/silly_billy" target="_blank" rel="noopener noreferrer" className="footer-link">GitHub</a>
        <span className="footer-brand">Silly Billy</span>
      </footer>
    </div>
  );
}
