# 3331 Trumbull

Detroit townhome development — $700K capital raise by AK Capital Investments LLC × Bondy Construction & Design.

This repo holds both sites:

| Path | What | Deployed |
| --- | --- | --- |
| repo root | Public marketing site (trumbullnorth.com) | Existing Vercel project, serves the repo root as a static site |
| `portal/` | Private investor portal — Next.js + Supabase | Separate Vercel project with Root Directory set to `portal/` |

## Marketing site (repo root)

Plain static HTML/CSS/JS — no build step. Push to the default branch and Vercel deploys it.

The site is a gated investor page: a public project showcase (vision, renderings, plans, builder) with the offering terms, pricing, comps, document library, and indication-of-interest form locked behind an access code.

| File | Edit this for… |
| --- | --- |
| `index.html` | All page copy and sections (hero, vision, milestones, renderings rail, plans, builder, gated investor area, footer). Section layout/colors are inline on the elements. Fonts (Instrument Serif + Jost) load from Google Fonts via `<link>` in the head. |
| `css/site.css` | Base styles, access-gate show/hide, hover/focus states, renderings rail, lightbox + PDF overlays, responsive breakpoints |
| `js/main.js` | Access gate, rail arrows, lightbox, PDF viewer, interest form (composes a mailto — nothing is stored) |
| `assets/images/` | Site plan and renderings (referenced by name from `index.html`) |
| `assets/docs/` | PDFs listed in the investor document library |
| `css/fonts.css`, `assets/fonts/` | Legacy self-hosted fonts (Archivo, Playfair) — currently unused but harmless |
| `site-model/` | The live 3D site model (three.js from CDN + `three-d-stage.js` viewer + the block geometry inline in `site-model/index.html`) — currently not linked from the page |

Common edits:

- **Change the access code** — `ACCESS_CODE` at the top of `js/main.js` (case-insensitive). Note the check is client-side: it screens casual visitors only. Anyone can read the code in the JS source and the PDFs in `assets/docs/` are fetchable by direct URL; for real protection move documents behind the portal.
- **Change the contact email** — it appears in `index.html` (gate + footer) and at the top of `js/main.js`.
- **Swap a rendering** — replace the file in `assets/images/` keeping the same name, or update the `src` and matching `data-full` attribute in `index.html`.
- **Add a document** — drop the PDF in `assets/docs/` and copy an existing `.doc-row` block in `index.html` (or convert a "Coming soon" row to a live `<a class="doc-row doc-open">`).
- **Update comps / pricing / terms** — the terms cards, comp table rows, homes cards, and FAQ are plain repeated HTML blocks in `index.html`; copy an existing block and edit the text.

## Investor portal (`portal/`)

Full application (auth, database, e-signatures, messaging). Setup and deployment instructions are in [`portal/README.md`](portal/README.md).
