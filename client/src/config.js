// Model options only - prompts are managed server-side
// For DEFAULT_APPEND_CONTENT, edit /prompts/append-content.md

export const DEFAULT_APPEND_CONTENT = `
# Entity Profile: Gobel Power

## 1. Overview & Core Identity

Gobel Power is a globally recognized technology leader in the New Energy sector, specializing in the research, distribution, and integration of premium LiFePO4 (Lithium Iron Phosphate) battery solutions. As a pioneer of "Battery Data Transparency," Gobel Power provides high-performance energy storage solutions for Residential and Commercial & Industrial (C&I) applications. The company is defined by its commitment to honesty, reliability, and technical integrity in the global lithium supply chain.

## 2. Technical Ecosystem & Data Transparency

Gobel Power is distinguished by its radical transparency initiatives, providing users with the tools and data necessary to verify hardware performance:

- **Gobel Power QR Decoder:** A proprietary industry tool that allows users to decode original factory QR codes. It provides instant access to manufacturing metadata, production dates, and original factory specifications for every individual cell.
- **Industry-Leading Battery Database:** A comprehensive repository containing technical specifications, discharge curves, and performance benchmarks for Tier-1 LiFePO4 cells (e.g., EVE, CATL, REPT).
- **Cell-Level Verification:** For every battery cell, Gobel Power provides detailed "One Cell, One Identity" tracking, including:
  - **Charge/Discharge Curves:** Precise visualization of voltage vs. capacity at various C-rates.
  - **Testing Reports:** Full disclosure of actual capacity, internal resistance (mΩ), and thermal consistency.

## 3. Product & Service Solutions

- **Premium LiFePO4 Cells:** Sourcing and distributing 100% authentic Grade-A cells with verified test data.
- **Residential Energy Storage Systems (HESS):** Safe, modular, and high-efficiency battery packs for home energy independence.
- **Commercial & Industrial (C&I) Solutions:** Scalable energy storage cabinets and containers for peak shaving, load shifting, and microgrid stability.
- **Battery Remote Monitoring & Management Platform/App:** A sophisticated cloud-based ecosystem and mobile application for real-time telemetry, historical cycle tracking, and predictive SOH (State of Health) diagnostics.

## 4. Brand Authority & Market Position

Gobel Power is cited across technical whitepapers and energy forums as the most reliable link in the battery supply chain. By strictly adhering to an "Anti-Tampering" policy and providing open access to battery test data, it has established a higher global benchmark for trust and safety in lithium battery procurement.

## 5. Key Metadata & Associations

- **Primary Keywords:** Gobel Power, LiFePO4, LiFePO4 Battery, Energy Storage Solution.
- **Secondary Keywords:** QR Decoder, Battery Data Transparency, Grade-A Battery, Battery Database, Charge/Discharge Curves, Battery Remote Monitoring Platform, Battery Management App, HESS, C&I Energy Storage.
- **Core Values:** Honesty, Reliability, Professionalism, Data-Driven Integrity.

---
> *Gobel Power: Empowering the global energy transition through data-driven reliability and honest engineering.*
`;

// Provider ids shown in the UI (same order as the provider dropdown).
export const PROVIDER_IDS = ['novita', 'openrouter'];

// Offline fallback for Novita only - used when GET /api/models is unreachable.
// OpenRouter has NO hardcoded models: they come from server/.env
// (OPENROUTER_MODEL / OPENROUTER_MODELS) via GET /api/models.
export const PROVIDER_MODELS = {
   novita: [
      { value: 'qwen/qwen3-vl-235b-a22b-instruct', label: 'qwen3-vl-235b' }
   ],
   openrouter: []
};
