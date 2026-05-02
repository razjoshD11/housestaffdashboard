# House Staff Dashboard

A public dashboard showing how Democratic House members representing the largest U.S. cities (San Francisco, Los Angeles, New York City, Miami, Chicago, Seattle, Boston) spend their Members' Representational Allowance (MRA) — staff, office, travel, and everything else.

**Live:** https://razjoshd11.github.io/housestaffdashboard/

## Data source

U.S. House [Statement of Disbursements](https://www.house.gov/the-house-explained/open-government/statement-of-disbursements), 2025 quarterly detail-grid CSVs.

## Build

```bash
python3 scripts/build_data.py
```

Reads four CSVs from `~/Downloads/` and emits `site/data.json` consumed by the static dashboard in `site/`.

## Local preview

```bash
cd site && python3 -m http.server 8000
# open http://localhost:8000
```

## Methodology

See the **Methodology** link in the site header, or `site/app.js` `renderMethodology()`.

Short version:
- Only `SORT SEQUENCE = DETAIL` rows are summed (subtotals excluded).
- **Staff** = `PERSONNEL COMPENSATION`. **Office** = rent + supplies + printing. **Travel** = `TRAVEL`. **Other** = everything else.
- Salaries are annualized: full year if paid all 4 quarters, otherwise extrapolated by months on payroll with a flag.
- Top-5 "other" expenses exclude staff, office, and travel.
