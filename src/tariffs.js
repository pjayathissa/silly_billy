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
  }

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
    plan: "Basic",
    type: "standard",
    dailyCharge: 240,
    rates: [{ name: "Anytime", centsPerKwh: 32.0 }],
    features: "Simple flat rate, broadband bundle available",
  },
  {
    retailer: "Contact",
    plan: "Basic",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 37.8 }],
    features: "Low-user flat rate (LFC regulation being phased out — daily charge rising annually)",
  },
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
    plan: "Kiwi",
    type: "standard",
    dailyCharge: 240,
    rates: [{ name: "Anytime", centsPerKwh: 30.5 }],
    features: "1 free hour of power per day (Hour of Power, time choosable between 9am–5pm or 9pm–7am)",
  },
  {
    retailer: "Electric Kiwi",
    plan: "Kiwi",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 36.5 }],
    features: "Low-user + Hour of Power",
  },
  {
    retailer: "Electric Kiwi",
    plan: "MoveMaster",
    type: "standard",
    dailyCharge: 215,
    rates: [
      // Peak: 7am–9am AND 5pm–9pm, weekdays only (two separate windows).
      // Rates are approximate for Vector/Auckland; vary by network. Off-peak night
      // is marketed as "half price" relative to peak. Shoulder covers all other times.
      { name: "Peak (morning)", centsPerKwh: 40.5, startHour: 7, endHour: 9, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Peak (evening)", centsPerKwh: 40.5, startHour: 17, endHour: 21, daysOfWeek: [1, 2, 3, 4, 5] },
      { name: "Off-peak night", centsPerKwh: 20.0, startHour: 23, endHour: 7 },
      { name: "Shoulder", centsPerKwh: 27.0 }, // catch-all: weekday midday + evenings 9–11pm, weekends 7am–11pm
    ],
    features: "3-tier TOU: peak weekday mornings & evenings, shoulder daytime/weekends, half-price overnight (11pm–7am) + Hour of Power",
  },

  // ── Octopus Energy ───────────────────────────────────────
  {
    retailer: "Octopus Energy",
    plan: "Simple",
    type: "standard",
    dailyCharge: 235,
    rates: [{ name: "Anytime", centsPerKwh: 30.5 }],
    features: "No lock-in, app-based management",
  },
  {
    retailer: "Octopus Energy",
    plan: "Simple",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 36.5 }],
    features: "Low-user option",
  },

  // ── Nova Energy ──────────────────────────────────────────
  {
    retailer: "Nova Energy",
    plan: "Nova Plus",
    type: "standard",
    dailyCharge: 258,
    rates: [{ name: "Anytime", centsPerKwh: 31.5 }],
    features: "Flat rate, online management, broadband/gas bundle discounts available",
  },
  {
    retailer: "Nova Energy",
    plan: "Nova Plus",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 37.5 }],
    features: "Low-user flat rate (LFC regulation being phased out — daily charge rising annually)",
  },

  // ── Pulse Energy ─────────────────────────────────────────
  {
    retailer: "Pulse Energy",
    plan: "Plus",
    type: "standard",
    dailyCharge: 248,
    rates: [{ name: "Anytime", centsPerKwh: 31.0 }],
    features: "Prompt-pay discount available",
  },
  {
    retailer: "Pulse Energy",
    plan: "Plus",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 37.0 }],
    features: "Low-user flat rate",
  },

  // ── Powershop ────────────────────────────────────────────
  // Note: Powershop is owned by Meridian Energy.
  {
    retailer: "Powershop",
    plan: "All You Need",
    type: "standard",
    dailyCharge: 252,
    rates: [{ name: "Anytime", centsPerKwh: 31.5 }],
    features: "Pre-purchase power packs for discounts (owned by Meridian Energy)",
  },
  {
    retailer: "Powershop",
    plan: "All You Need",
    type: "low",
    dailyCharge: 173,
    rates: [{ name: "Anytime", centsPerKwh: 37.5 }],
    features: "Low-user with power pack option",
  },
];

export const tariffsLastUpdated = "March 2026";
export default tariffs;