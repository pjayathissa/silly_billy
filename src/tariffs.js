/**
 * New Zealand Residential Electricity Tariff Database
 *
 * Last validated: March 2026
 *
 * Sources: Retailer websites, Powerswitch (Consumer NZ)
 * Region: General / nationwide plans. Actual rates vary by network region.
 *         These are representative rates for common urban networks
 *         (Vector/Auckland, Wellington Electricity, Orion/Christchurch).
 *
 * To update: edit the plans array below. Each plan has:
 *   - retailer: company name
 *   - plan: plan name
 *   - type: "standard" | "low"  (standard vs low user)
 *   - dailyCharge: cents/day (incl. GST)
 *   - rates: array of { name, centsPerKwh, startHour?, endHour? }
 *       If startHour/endHour are omitted, the rate applies all day (anytime).
 *       Hours are 0–23 in 24-hour format.
 *   - features: short description string
 */

const tariffs = [
  // ── Mercury ──────────────────────────────────────────────
  {
    retailer: "Mercury",
    plan: "Everyday",
    type: "standard",
    dailyCharge: 230,
    rates: [{ name: "Anytime", centsPerKwh: 28.5 }],
    features: "Simple flat rate, no peak/off-peak",
  },
  {
    retailer: "Mercury",
    plan: "Everyday",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 34.0 }],
    features: "Low-user flat rate",
  },
  {
    retailer: "Mercury",
    plan: "Time of Use",
    type: "standard",
    dailyCharge: 230,
    rates: [
      { name: "Peak", centsPerKwh: 38.0, startHour: 7, endHour: 21 },
      { name: "Off-peak", centsPerKwh: 16.5, startHour: 21, endHour: 7 },
    ],
    features: "Cheaper nights (9pm–7am)",
  },

  // ── Meridian ─────────────────────────────────────────────
  {
    retailer: "Meridian",
    plan: "Simple",
    type: "standard",
    dailyCharge: 207,
    rates: [{ name: "Anytime", centsPerKwh: 27.8 }],
    features: "Flat rate, no contract",
  },
  {
    retailer: "Meridian",
    plan: "Simple",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 33.5 }],
    features: "Low-user flat rate",
  },
  {
    retailer: "Meridian",
    plan: "Time of Use",
    type: "standard",
    dailyCharge: 207,
    rates: [
      { name: "Peak", centsPerKwh: 37.5, startHour: 7, endHour: 21 },
      { name: "Off-peak", centsPerKwh: 15.8, startHour: 21, endHour: 7 },
    ],
    features: "Cheaper nights (9pm–7am)",
  },

  // ── Genesis Energy ───────────────────────────────────────
  {
    retailer: "Genesis",
    plan: "Energy Basic",
    type: "standard",
    dailyCharge: 215,
    rates: [{ name: "Anytime", centsPerKwh: 29.0 }],
    features: "No frills flat rate",
  },
  {
    retailer: "Genesis",
    plan: "Energy Basic",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 34.5 }],
    features: "Low-user flat rate",
  },
  {
    retailer: "Genesis",
    plan: "Energy Plus",
    type: "standard",
    dailyCharge: 230,
    rates: [{ name: "Anytime", centsPerKwh: 27.5 }],
    features: "Dual fuel discount available",
  },

  // ── Contact Energy ───────────────────────────────────────
  {
    retailer: "Contact",
    plan: "Basic",
    type: "standard",
    dailyCharge: 200,
    rates: [{ name: "Anytime", centsPerKwh: 28.2 }],
    features: "Simple flat rate, broadband bundle available",
  },
  {
    retailer: "Contact",
    plan: "Basic",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 33.8 }],
    features: "Low-user flat rate",
  },
  {
    retailer: "Contact",
    plan: "Good Nights",
    type: "standard",
    dailyCharge: 200,
    rates: [
      { name: "Day", centsPerKwh: 32.0, startHour: 7, endHour: 21 },
      { name: "Night", centsPerKwh: 0, startHour: 21, endHour: 7 },
    ],
    features: "Free power 9pm–7am (higher day rate)",
  },
  {
    retailer: "Contact",
    plan: "Good Weekends",
    type: "standard",
    dailyCharge: 200,
    rates: [
      { name: "Weekday", centsPerKwh: 30.0 },
      { name: "Weekend", centsPerKwh: 0 },
    ],
    features: "Free power on weekends (higher weekday rate)",
  },

  // ── Electric Kiwi ────────────────────────────────────────
  {
    retailer: "Electric Kiwi",
    plan: "Kiwi",
    type: "standard",
    dailyCharge: 199,
    rates: [{ name: "Anytime", centsPerKwh: 27.0 }],
    features: "1 free hour of power per day (Hour of Power)",
  },
  {
    retailer: "Electric Kiwi",
    plan: "Kiwi",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 32.5 }],
    features: "Low-user + Hour of Power",
  },
  {
    retailer: "Electric Kiwi",
    plan: "MoveMaster",
    type: "standard",
    dailyCharge: 179,
    rates: [
      { name: "Peak", centsPerKwh: 36.0, startHour: 7, endHour: 21 },
      { name: "Off-peak", centsPerKwh: 14.5, startHour: 21, endHour: 7 },
    ],
    features: "Time of use + Hour of Power",
  },

  // ── Flick Electric ───────────────────────────────────────
  {
    retailer: "Flick Electric",
    plan: "Flat",
    type: "standard",
    dailyCharge: 199,
    rates: [{ name: "Anytime", centsPerKwh: 27.5 }],
    features: "Simple flat rate, transparent pricing",
  },
  {
    retailer: "Flick Electric",
    plan: "Flat",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 33.0 }],
    features: "Low-user flat rate",
  },
  {
    retailer: "Flick Electric",
    plan: "Off Peak",
    type: "standard",
    dailyCharge: 199,
    rates: [
      { name: "Peak", centsPerKwh: 35.0, startHour: 7, endHour: 23 },
      { name: "Off-peak", centsPerKwh: 14.0, startHour: 23, endHour: 7 },
    ],
    features: "Cheap overnight (11pm–7am)",
  },

  // ── Frank Energy ─────────────────────────────────────────
  {
    retailer: "Frank Energy",
    plan: "Frank Plan",
    type: "standard",
    dailyCharge: 189,
    rates: [{ name: "Anytime", centsPerKwh: 26.5 }],
    features: "Low fixed charge, competitive variable rate",
  },
  {
    retailer: "Frank Energy",
    plan: "Frank Plan",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 32.0 }],
    features: "Low-user option",
  },

  // ── Octopus Energy ───────────────────────────────────────
  {
    retailer: "Octopus Energy",
    plan: "Simple",
    type: "standard",
    dailyCharge: 195,
    rates: [{ name: "Anytime", centsPerKwh: 26.8 }],
    features: "No lock-in, app-based management",
  },
  {
    retailer: "Octopus Energy",
    plan: "Simple",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 32.5 }],
    features: "Low-user option",
  },

  // ── Nova Energy ──────────────────────────────────────────
  {
    retailer: "Nova Energy",
    plan: "Nova Plus",
    type: "standard",
    dailyCharge: 220,
    rates: [{ name: "Anytime", centsPerKwh: 28.0 }],
    features: "Flat rate, online management",
  },
  {
    retailer: "Nova Energy",
    plan: "Nova Plus",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 33.5 }],
    features: "Low-user flat rate",
  },

  // ── Pulse Energy ─────────────────────────────────────────
  {
    retailer: "Pulse Energy",
    plan: "Plus",
    type: "standard",
    dailyCharge: 210,
    rates: [{ name: "Anytime", centsPerKwh: 27.5 }],
    features: "Prompt-pay discount available",
  },
  {
    retailer: "Pulse Energy",
    plan: "Plus",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 33.0 }],
    features: "Low-user flat rate",
  },

  // ── Powershop ────────────────────────────────────────────
  {
    retailer: "Powershop",
    plan: "All You Need",
    type: "standard",
    dailyCharge: 215,
    rates: [{ name: "Anytime", centsPerKwh: 28.0 }],
    features: "Pre-purchase power packs for discounts",
  },
  {
    retailer: "Powershop",
    plan: "All You Need",
    type: "low",
    dailyCharge: 69,
    rates: [{ name: "Anytime", centsPerKwh: 33.5 }],
    features: "Low-user with power pack option",
  },
];

export default tariffs;
