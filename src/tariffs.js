/**
 * New Zealand Residential Electricity Tariff Database
 *
 * Last validated: March 2026
 *
 * Sources: Retailer websites, Powerswitch (Consumer NZ), EA Regional Power Prices dashboard
 * Region: General / nationwide plans. Actual rates vary by network region.
 *         These are representative rates for common urban networks
 *         (Vector/Auckland, Wellington Electricity, Orion/Christchurch).
 *
 * IMPORTANT: Rates are updated as of early 2026, following the April 2025 DPP4 lines
 *         charge increases which raised average NZ household bills by ~$10–25/month.
 *         A further ~5% increase is expected from April 2026. Always verify current
 *         rates via retailer websites or https://www.powerswitch.org.nz before use.
 *
 * MARKET CHANGES (2025):
 *   - Frank Energy: closed August 2025, customers transferred to Genesis Energy.
 *   - Flick Electric: sold to Meridian Energy (May 2025), brand retired ~Oct 2025,
 *                     customers transferred to Meridian.
 *   Both retailers have been removed from this database.
 *
 * LOW USER NOTE: The Low Fixed Charge Tariff regulation is being phased out by the
 *   Government over 5 years from April 2022. Low-user daily charges are gradually
 *   increasing across all retailers. The 30c/day cap no longer applies.
 *   Phase-out schedule (max daily charge, ex-GST): $0.90 (Apr 2023), $1.20 (Apr 2024),
 *   $1.50 (Apr 2025), $1.80 (Apr 2026), fully removed Apr 2027.
 *   As of March 2026, the regulated cap is $1.50/day ex-GST = ~$1.73/day incl. GST
 *   (173c/day). From April 2026, the cap rises to $1.80/day ex-GST = ~$2.07/day incl.
 *   GST (207c/day). Low-user dailyCharge values below reflect the current April 2025 cap;
 *   update all low-user dailyCharge values to 207 once April 2026 rates take effect.
 *
 * To update: edit the plans array below. Each plan has:
 *   - retailer: company name
 *   - plan: plan name
 *   - type: "standard" | "low"  (standard vs low user)
 *   - dailyCharge: cents/day (incl. GST)
 *   - rates: array of { name, centsPerKwh, startHour?, endHour?, daysOfWeek? }
 *       If startHour/endHour are omitted, the rate applies all day (anytime).
 *       Hours are 0–23 in 24-hour format.
 *       daysOfWeek: optional array of day numbers (0=Sun, 1=Mon ... 6=Sat).
 *         If omitted, rate applies every day.
 *   - features: short description string
 */

const tariffs = [
  // ── Mercury ──────────────────────────────────────────────
  // Note: Mercury's plan is now branded "Everyday Rates". Separate TOU plan
  // confirmed still available. Daily charge ~269c/day incl. GST (ex-GST ~$2.34/day
  // per customer reports). Rates ~12–15% higher than 2024 following April 2025
  // DPP4 increases and subsequent retail adjustments.
  {
    retailer: "Mercury",
    plan: "Open Term",
    type: "standard",
    dailyCharge: 335,
    rates: [{ name: "Anytime", centsPerKwh: 25.9 }],
    features: "Simple flat rate, no peak/off-peak, no fixed term",
  },
  {
    retailer: "Mercury",
    plan: "Everyday Rates",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 33.3 }],
    features: "Low-user flat rate (LFC regulation being phased out — daily charge rising annually)",
  },

  // ── Meridian ─────────────────────────────────────────────
  // Note: Meridian acquired Flick Electric (May 2025) and Powershop customers.
  // Plan formerly known as "Simple", rebranded to "Freedom" (also called "Simple Flexi Plan").
  // Rates updated to reflect post-DPP4 levels.
  
  {
    retailer: "Meridian",
    plan: "Freedom",
    type: "standard",
    dailyCharge: 288,
    rates: [
      { name: "Day", centsPerKwh: 27.55, startHour: 7, endHour: 21 },
      { name: "Night", centsPerKwh: 24.22, startHour: 21, endHour: 7 },
    ],
    features: "Cheaper nights (9pm–7am)",
  },
  {
    retailer: "Meridian",
    plan: "Freedom",
    type: "low",
    dailyCharge: 207,
    rates: [
      { name: "Day", centsPerKwh: 31.25, startHour: 7, endHour: 21 },
      { name: "Night", centsPerKwh: 27.91, startHour: 21, endHour: 7 },
    ],
    features: "Cheaper nights (9pm–7am)",
  },

  // ── Genesis Energy ───────────────────────────────────────
  // Note: Genesis absorbed Frank Energy customers (August 2025).
  {
    retailer: "Genesis",
    plan: "Power Home",
    type: "standard",
    dailyCharge: 273,
    rates: [{ name: "Anytime", centsPerKwh: 27.9 }],
    features: "No frills flat rate",
  },
  {
    retailer: "Genesis",
    plan: "Power Home",
    type: "low",
    dailyCharge: 167,
    rates: [{ name: "Anytime", centsPerKwh: 32.6 }],
    features: "Low-user flat rate (LFC regulation being phased out — daily charge rising annually)",
  },
  {
    retailer: "Genesis",
    plan: "EVHome",
    type: "standard",
    dailyCharge: 283,
    rates: [
      // Free period: 9am–5pm Saturday and Sunday only.
      {
        name: "Night",
        centsPerKwh: 16.8,
        startHour: 21,
        endHour: 7,
        daysOfWeek: [0, 6],
      },
      { name: "Day", centsPerKwh: 33.6 },
    ],
    features: "Dual fuel discount available",
  }, 
  {
    retailer: "Genesis",
    plan: "EVHome",
    type: "low",
    dailyCharge: 167,
    rates: [
      // Free period: 9am–5pm Saturday and Sunday only.
      {
        name: "Night",
        centsPerKwh: 19.41,
        startHour: 21,
        endHour: 7,
        daysOfWeek: [0, 6],
      },
      { name: "Day", centsPerKwh: 38.9 },
    ],
    features: "Dual fuel discount available",
  },


  // ── Contact Energy ───────────────────────────────────────

  {
    retailer: "Contact",
    plan: "Good Nights",
    type: "standard",
    dailyCharge: 240,
    rates: [
      // Free period: 9pm–midnight, Monday–Friday only (daysOfWeek: 1–5).
      {
        name: "Free (Mon–Fri nights)",
        centsPerKwh: 0,
        startHour: 21,
        endHour: 0,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      { name: "All other times", centsPerKwh: 36.0 },
    ],
    features: "Free power 9pm–midnight Mon–Fri only (smart meter required, fair use policy applies). Higher day rate offsets free period.",
  },
  {
    retailer: "Contact",
    plan: "Good Weekends",
    type: "standard",
    dailyCharge: 240,
    rates: [
      // Free period: 9am–5pm Saturday and Sunday only.
      {
        name: "Free (Sat–Sun 9am–5pm)",
        centsPerKwh: 0,
        startHour: 9,
        endHour: 17,
        daysOfWeek: [0, 6],
      },
      { name: "All other times", centsPerKwh: 34.0 },
    ],
    features: "Free power 9am–5pm Sat & Sun only (smart meter required). Higher weekday/off-peak rate offsets free period.",
  },
  {
    retailer: "Contact",
    plan: "Good Charge",
    type: "standard",
    dailyCharge: 240,
    rates: [
      // Half-price electricity 9pm–7am every night.
      {
        name: "Off-peak (9pm–7am)",
        centsPerKwh: 17.0,
        startHour: 21,
        endHour: 7,
      },
      { name: "Day rate", centsPerKwh: 34.0 },
    ],
    features: "Half-price electricity 9pm–7am every night (smart meter required). Popular with EV owners.",
  },

  // ── Electric Kiwi ────────────────────────────────────────
  {
    retailer: "Electric Kiwi",
    plan: "Everyday",
    type: "standard",
    dailyCharge: 203,
    rates: [
      { name: "Peak", centsPerKwh: 39.25, startHour: 7, endHour: 9, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 39.25, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Shoulder", centsPerKwh: 39.25 }, // catch-all:
    ],
    features: "",
  },
  {
    retailer: "Electric Kiwi",
    plan: "Everyday",
    type: "low",
    dailyCharge: 172,
    rates: [
      { name: "Peak", centsPerKwh: 40.8, startHour: 7, endHour: 9, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 40.8, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Shoulder", centsPerKwh: 40.8 }, // catch-all:
    ],
    features: "",
  },
  {
    retailer: "Electric Kiwi",
    plan: "MoveMaster",
    type: "standard",
    dailyCharge: 203,
    rates: [
      // Peak: 7am–9am AND 5pm–9pm, weekdays only (two separate windows).
      // Rates are approximate for Vector/Auckland; vary by network. Off-peak night
      // is marketed as "half price" relative to peak. Shoulder covers all other times.
      { name: "Peak (morning)", centsPerKwh: 52.99, startHour: 7, endHour: 9, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 52.99, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Off-peak night", centsPerKwh: 26.5, startHour: 23, endHour: 7 },
      { name: "Shoulder", centsPerKwh: 31.8 }, // catch-all: weekday midday + evenings 9–11pm, weekends 7am–11pm
    ],
    features: "3-tier TOU: peak weekday mornings & evenings, shoulder daytime/weekends, half-price overnight (11pm–7am) + Hour of Power",
  },
  {
    retailer: "Electric Kiwi",
    plan: "MoveMaster",
    type: "low",
    dailyCharge: 115,
    rates: [
      // Peak: 7am–9am AND 5pm–9pm, weekdays only (two separate windows).
      // Rates are approximate for Vector/Auckland; vary by network. Off-peak night
      // is marketed as "half price" relative to peak. Shoulder covers all other times.
      { name: "Peak (morning)", centsPerKwh: 59.37, startHour: 7, endHour: 9, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 59.37, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Off-peak night", centsPerKwh: 29.68, startHour: 23, endHour: 7 },
      { name: "Shoulder", centsPerKwh: 35.62 }, // catch-all: weekday midday + evenings 9–11pm, weekends 7am–11pm
    ],
    features: "3-tier TOU: peak weekday mornings & evenings, shoulder daytime/weekends, half-price overnight (11pm–7am) + Hour of Power",
  },

  // ── Octopus Energy ───────────────────────────────────────
  {
    retailer: "Octopus Energy",
    plan: "Standard User",
    type: "standard",
    dailyCharge: 366.1,
    rates: [

      { name: "Peak (morning)", centsPerKwh: 32.1, startHour: 7, endHour: 11, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 32.1, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Off-peak night", centsPerKwh: 16.0, startHour: 23, endHour: 7 },
      { name: "Off-Peak", centsPerKwh: 24.0 }, // catch-all: 
    ],
    features: "No lock-in, app-based management",
  },
  {
    retailer: "Octopus Energy",
    plan: "Standard User",
    type: "low",
    dailyCharge: 172.5,
    rates: [
  
      { name: "Peak (morning)", centsPerKwh: 42.6, startHour: 7, endHour: 11, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 42.6, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Off-peak night", centsPerKwh: 21.3, startHour: 23, endHour: 7 },
      { name: "Off-Peak", centsPerKwh: 34.6 }, // catch-all: 
    ],
    features: "No lock-in, app-based management",
  },

  // ── Nova Energy ──────────────────────────────────────────
  {
    retailer: "Nova Energy",
    plan: "Electricity Only",
    type: "standard",
    dailyCharge: 363.876,
    rates: [

      { name: "Day", centsPerKwh: 33.979, startHour: 7, endHour: 11, },
      { name: "Night", centsPerKwh: 24.741, startHour: 21, endHour: 7 },
    ],
    features: "",
  },
  {
    retailer: "Nova Energy",
    plan: "Electricity Only",
    type: "low",
    dailyCharge: 207,
    rates: [

      { name: "Day", centsPerKwh: 41.137, startHour: 7, endHour: 11, },
      { name: "Night", centsPerKwh: 31.899, startHour: 21, endHour: 7 },
    ],
    features: "",
  },

  // ── Pulse Energy ─────────────────────────────────────────
  {
    retailer: "Pulse Energy",
    plan: "Anytime",
    type: "standard",
    dailyCharge: 363.630,
    rates: [

      { name: "Day", centsPerKwh: 34.326, startHour: 7, endHour: 11, },
      { name: "Night", centsPerKwh: 29.818, startHour: 21, endHour: 7 },
    ],
    features: "Price Promise Available",
  },
  {
    retailer: "Pulse Energy",
    plan: "Anytime",
    type: "low",
    dailyCharge: 207.000,
    rates: [{ name: "Anytime", centsPerKwh: 39.685 }],
    features: "Price Promise Available",
  },

  // ── Powershop ────────────────────────────────────────────
  // Note: Powershop is owned by Meridian Energy.
  {
    retailer: "Powershop",
    plan: "All You Need",
    type: "standard",
    dailyCharge: 313.03,
    rates: [

      { name: "Peak", centsPerKwh: 37.09, startHour: 7, endHour: 11, },
      { name: "Night", centsPerKwh: 22.75, startHour: 21, endHour: 7 },
    ],
    features: "Website doesn't specify when peak/offpeak hours are, but we assume them here",
  },
  {
    retailer: "Powershop",
    plan: "All You Need",
    type: "low",
    dailyCharge: 195.5,
    rates: [

      { name: "Peak", centsPerKwh: 42.45, startHour: 7, endHour: 11, },
      { name: "Night", centsPerKwh: 28.11, startHour: 21, endHour: 7 },
    ],
    features: "Website doesn't specify when peak/offpeak hours are, but we assume them here",
  },
];

export const tariffsLastUpdated = "March 2026";
export default tariffs;