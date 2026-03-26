# Silly Billy

A React app that analyses NZ residential electricity consumption data and recommends the best power plan.

## Features

- **CSV Upload**: Auto-detects column layout from half-hourly consumption data (handles transposed data, various date formats)
- **PDF Bill Parsing**: Extracts current tariff details (retailer, plan, rates) from uploaded electricity bills using pdf.js
- **Consumption Analysis**: Average daily profile, summer vs winter comparison, weekly trends
- **Smart Insights**: Nighttime baseload detection, seasonal heating costs, usage spike alerts, EV charging detection, solar pattern recognition, load-shifting savings
- **Plan Comparison**: Ranks 25+ plans from 11 NZ retailers (Mercury, Meridian, Genesis, Contact, Electric Kiwi, Flick, Frank, Octopus, Nova, Pulse, Powershop) by estimated annual cost using actual consumption data

## Getting Started

```bash
npm install
npm run dev
```

## Tech Stack

React 19, Vite, Recharts, PapaParse, pdf.js
