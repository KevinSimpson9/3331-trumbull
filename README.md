# 3331 Trumbull

Detroit townhome development — $700K capital raise by AK Capital Investments LLC × Bondy Construction & Design.

This repo holds both sites:

| Path | What | Deployed |
| --- | --- | --- |
| repo root | Public marketing site (trumbullnorth.com) | Existing Vercel project, serves the repo root as a static site |
| `portal/` | Private investor portal — Next.js + Supabase | Separate Vercel project with Root Directory set to `portal/` |

## Marketing site (repo root)

Plain static HTML/CSS/JS — no build step. Push to the default branch and Vercel deploys it.

| File | Edit this for… |
| --- | --- |
| `index.html` | All page copy and sections (hero, offering terms, project, renderings, market comps, track record, timeline, contact). Section layout/colors are inline on the elements. |
| `css/site.css` | Base styles, hover/focus states, lightbox, responsive breakpoints |
| `css/fonts.css` | Self-hosted font declarations (Archivo, Playfair Display) |
| `js/main.js` | Renderings lightbox + "Request the Offering" form (composes a mailto — nothing is stored) |
| `assets/images/` | Site plan and renderings (referenced by name from `index.html`) |
| `assets/fonts/` | Self-hosted woff2 files |
| `site-model/` | The live 3D site model shown in the hero (three.js from CDN + `three-d-stage.js` viewer + the block geometry inline in `site-model/index.html`) |

Common edits:

- **Change the contact email** — it appears in `index.html` (contact section, twice) and at the top of `js/main.js`.
- **Swap a rendering** — replace the file in `assets/images/` keeping the same name, or update the `src` and matching `data-full` attribute in `index.html`.
- **Update comps / pricing / timeline** — the comp cards, comp table rows, quarterly payout strip, and timeline are plain repeated HTML blocks in `index.html`; copy an existing block and edit the text.

## Investor portal (`portal/`)

Full application (auth, database, e-signatures, messaging). Setup and deployment instructions are in [`portal/README.md`](portal/README.md).
