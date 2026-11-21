# CA mega enterprise fixtures

Fictional subsidiaries of global brands — **one per Central American country** — for Kaikei demos and load tests.

| Code | Brand | Country | Currency | Approx actual rows |
|---|---|---|---|---|
| `gt-apple` | Apple Operations Centroamérica | GT | GTQ | 520 |
| `hn-tesla` | Tesla Energía Honduras | HN | HNL | 520 |
| `sv-microsoft` | Microsoft Centroamérica El Salvador | SV | USD | 520 |
| `ni-amazon` | Amazon Logistics Nicaragua | NI | NIO | 520 |
| `cr-google` | Google Cloud Costa Rica | CR | CRC | 520 |
| `pa-meta` | Meta Platforms Panamá | PA | PAB | 520 |

Each pack folder contains:
- `budget_fy2026_q4.csv` — budget lines by period/category
- `actuals_seed.csv` — large actuals seed (~520 rows)
- `sample_actuals_nov_delta.csv` — 1 new + 2 overlap + 1 parse_error
- `adversarial_actuals.csv` — injection + odd header
- `bills/*.pdf` — text PDFs aligned to actual rows for evidence matching
- `*_pack.xlsx` — Workspace / Budget / Actuals / BillsIndex / Summary
- `manifest.json` — machine-readable index for that pack

**Disclaimer:** names are for demo realism only; figures are invented.
