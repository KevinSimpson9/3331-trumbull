# 3331 Trumbull — Investor Deck

Rebuilt August 2026 for the two-phase structure (13 units, then 12).

| File | What |
| --- | --- |
| `3331-Trumbull-Investor-Deck-Aug-2026.pptx` | The deck. Editable in PowerPoint / Google Slides. |
| `3331-Trumbull-Investor-Deck-Aug-2026.pdf` | Send-ready PDF. |
| `build.js` | Generator. Edit copy and numbers here, then rebuild. |
| `img/` | Optimized JPEGs of the renderings and site plan (sourced from `../assets/images/`). |

## Rebuilding

```bash
cd deck && npm install pptxgenjs && node build.js
```

To regenerate the PDF: `soffice --headless --convert-to pdf 3331-Trumbull-Investor-Deck-Aug-2026.pptx`

## Slide map

1. Title
2. The opportunity — full block, phased
3. **The plan** — Phase 1 (13) / Phase 2 (12), and the 8-of-13 principal-return trigger
4. The offer — note terms, note economics, Phase 1 capital stack
5. The product — Type A / Type B
6. Market evidence — the comp set from Bondy Construction & Design
7. Financials — full 25-unit sales proforma
8. Track record — the three closed North Corktown townhome projects
9. Sponsorship — BCD portfolio totals and active pipeline
10. Execution — two-phase timeline
11. Next steps

## Sources

- **Proforma:** 3331 Trumbull for-sale proforma, June 2026 (all 25 units).
- **Comps:** `3331-Trumbull-Sales-Comps-BCD.pdf` (Lukas Bondy, 8 July 2026) — Realcomp IDX sold
  records, ALTA seller settlement statements, builder price lists.
- **Track record / portfolio:** `REO & EXPERIENCE 3.21.26 BCD.pdf` — Bondy Construction & Design
  real-estate-owned and experience schedule, 21 March 2026.
- **Phasing and lender:** First Merchants Bank; ~$750K of capital required for one of two phases
  (Lukas Bondy, 29 July 2026).

## Known open items

- **Phase 1 unit mix.** Slide 3 assigns Phase 1 to Buildings 1–3 and Phase 2 to Buildings 4–5.
  Confirm against the final building sequence; if the split changes, the 13/12 counts on slides
  1, 2, 3 and 10 need updating. Slide 7 financials are the full 25-unit proforma and are unaffected.
- **Track record headline.** Slides 8 and 9 use the REO-documented figures (26 projects, 122 units,
  75 delivered). The prior deck's "140+ units / $100M+ completed construction" is not reconcilable
  with the REO schedule and was left out. Swap in Luke's updated schedule when it arrives.
