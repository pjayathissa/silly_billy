# Energy Bill Analyst

A browser-based tool that analyses New Zealand residential electricity consumption data and recommends the cheapest power plan. Upload your smart meter data (CSV) and optionally your current bill (PDF), and the app ranks 25+ plans from 11 NZ retailers by estimated annual cost using your actual usage profile.

## Features

- **CSV Upload & Auto-Detection** — Supports multiple retailer export formats (wide, long, MERX, CTCT, GE, retail-wide). The parser auto-detects column layout, date formats (DD/MM/YYYY), transposed data, preamble rows, and interval numbering.
- **PDF Bill Parsing** — Extracts your current tariff details (daily charge, peak/off-peak rates) from uploaded electricity bills using pdf.js with line-aware text reconstruction.
- **Consumption Analysis** — Average daily profile (48 half-hour slots), summer vs winter comparison, and weekly trends.
- **Smart Insights** — Nighttime baseload detection, seasonal heating cost estimates, usage spike alerts, solar pattern recognition, and load-shifting savings opportunities.
- **Plan Comparison** — Ranks plans from Mercury, Meridian, Genesis, Contact, Electric Kiwi, Octopus, Nova, Pulse, and Powershop by estimated annual cost, accounting for time-of-use rates, day-of-week restrictions, and free-power windows.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. To run tests:

```bash
npm test
```

## How It Works

The app follows a three-step flow managed by `src/App.jsx`:

1. **Upload** — User provides a CSV of half-hourly consumption data and optionally a PDF bill.
2. **Tariff Review** — Extracted/manual tariff details are confirmed by the user.
3. **Dashboard** — Analysis results, charts, and plan rankings are displayed.

### Key Components

#### `src/tariffs.js` — Tariff Database

**This is the most important file for contributors and reviewers.**

Contains the full database of NZ residential electricity plans with structured rate definitions. Each plan specifies:

- `retailer` / `plan` — Retailer and plan name
- `type` — `"standard"` or `"low"` (low fixed charge)
- `dailyCharge` — Fixed daily charge in cents/day (incl. GST)
- `rates[]` — Array of rate tiers, each with:
  - `centsPerKwh` — Energy rate
  - `startHour` / `endHour` (optional) — Time-of-use window (24-hour format, overnight wrapping supported)
  - `daysOfWeek` (optional) — Array of day numbers (0=Sun, 6=Sat) for day-specific rates
- `features` — Human-readable plan description

**We welcome contributions to keep rates accurate and add missing plans.** Rates are region-dependent (these are representative for common urban networks like Vector/Auckland, Wellington Electricity, Orion/Christchurch). See the file header for market context, the Low User phase-out schedule, and update instructions.

#### `src/utils/csvParser.js` — CSV Parser

Auto-detects and normalises half-hourly electricity data from multiple CSV formats:

- **Wide format** — One row per day, 48 time-slot columns (e.g. `ID12_00AM`, `ID12 00AM`, `HH:MM`, `12:00 AM` headers)
- **Long format** — One row per reading with timestamp and kWh columns
- **Headerless formats** — Detects columns by data patterns (timestamp scoring, kWh scoring)
- **Date + interval number** — Combines date column with interval (1–48) to reconstruct timestamps
- **Summary row handling** — Detects aggregated rows spanning >30 minutes, removes them, and fills gaps using the previous day's consumption profile

#### `src/utils/analysis.js` — Analysis Engine

- `dailyProfile(data)` — Average kWh per half-hour slot across the dataset
- `seasonalProfiles(data)` — Summer vs winter daily profiles (NZ seasons: Nov–Mar / Apr–Oct)
- `weeklyTrend(data)` — Total kWh per week
- `generateInsights(data, currentTariff)` — Produces actionable insights (baseload, seasonal cost, spikes, load-shifting, solar detection)
- `annualCost(data, plan)` — Estimates annual cost for any tariff plan using actual consumption, handling TOU rates with overnight wrapping and day-of-week restrictions
- `rankPlans(data, currentCost)` — Ranks all plans from `tariffs.js` by estimated annual cost

#### `src/utils/pdfParser.js` — PDF Tariff Extractor

Extracts tariff rates from electricity bill PDFs using pdf.js. Uses Y-coordinate grouping to reconstruct table rows, then applies keyword-based line classification (daily charge, peak, off-peak) with rate extraction. Falls back to keyword-proximity search for values the line scanner misses.

#### `src/utils/excelParser.js` — Excel Converter

Converts `.xlsx`/`.xls` files to CSV using SheetJS so the CSV parser can handle them.

#### UI Components (`src/components/`)

- `UploadScreen.jsx` — File upload with drag-and-drop for CSV/Excel + PDF
- `TariffReview.jsx` — Displays extracted tariff for user confirmation/editing
- `Dashboard.jsx` — Charts (Recharts) and plan comparison table
- `StepIndicator.jsx` — Progress indicator for the three-step flow

## Tech Stack

React 19, Vite, Recharts, PapaParse, pdf.js, SheetJS

## Contributing

Contributions are welcome, especially:

- **Tariff updates** — Rates change frequently. If you spot outdated rates or missing plans in `src/tariffs.js`, please open a PR.
- **New CSV formats** — If your retailer's export doesn't parse correctly, please open an issue with a sample (with personal details removed).
- **Regional rate variants** — The current database uses representative urban rates. Regional breakdowns would be valuable.

## License

[MIT](LICENSE)
