# Fixtures (K7, owner: Jordi)

Golden data for the demo and `scripts/acceptance.ts`. Spec: `docs/SCOPE_AND_TASKS.md` §2.1.
Expected figures live in [`golden.json`](./golden.json), hand-computed and never copied from engine output.

| File | Status | Purpose |
|---|---|---|
| `seed.json` (or `seed_*.csv`) | TODO | Panadería La Ceiba, GTQ, Nov 2026: Deliveries budget Q3,000 + 3–4 categories; Deliveries actuals Q1,200 + Q900 + Q600 = Q2,700, plus other categories and some income |
| `sample_actuals_nov.csv` | TODO | 1 new Deliveries expense Q600 (Transportes Rápidos, 2026-11-18) + 2 rows already in the seed + 1 bad amount `"Q 1,2O0"` |
| `sample_budget_dec.csv` | TODO | December budget lines (tests the Budget type; doesn't touch November) |
| `bill_transportes_rapidos.pdf` | TODO | Text-based PDF, 2026-11-18, total Q600.00, GTQ |
| `bill_no_match.pdf` | TODO | Second PDF with no good candidate → stays `uncertain_match` (AC7) |
| `adversarial_actuals.csv` | TODO | Test-only: injection text in a description cell + unresolvable header `Imp. neto` (AC13) |

Headers are intentionally non-standard: `Fecha`, `Concepto`, `Rubro`, `Monto (Q)`.

## Consolidation track set

[`grupo-ag/`](./grupo-ag/README.md): six-company, three-currency, six-format group pack with 13 planted errors for the multi-company consolidation track. Verified by `npm run fixtures:check`.
