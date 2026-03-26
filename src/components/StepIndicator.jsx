export default function StepIndicator({ currentStep, onStepClick }) {
  const steps = [
    { id: "upload", label: "Upload" },
    { id: "review", label: "Review" },
    { id: "dashboard", label: "Results" },
  ];
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="step-indicator">
      {steps.map((step, i) => {
        let status;
        if (i < currentIndex) status = "completed";
        else if (i === currentIndex) status = "active";
        else status = "upcoming";

        const clickable = status === "completed" && onStepClick;

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div className={`step-connector ${i <= currentIndex ? "done" : "pending"}`} />
            )}
            <div
              className={`step ${status}${clickable ? " clickable" : ""}`}
              onClick={clickable ? () => onStepClick(step.id) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onStepClick(step.id); } : undefined}
            >
              <span className="step-circle">
                {status === "completed" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="step-label">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
