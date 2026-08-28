# 3331 Trumbull

Detroit townhome development — $700K capital raise by AK Capital Investments LLC × Bondy Construction & Design.

This repo holds both sites:

| Path | What | Deployed |
| --- | --- | --- |
| repo root | Public marketing site (trumbullnorth.com) | Existing Vercel project, serves the repo root as a static site |
| `portal/` | Private investor portal — Next.js + Supabase | Separate Vercel project with Root Directory set to `portal/` |

## Marketing site (repo root)

Plain static HTML/CSS/JS — no build step. Push to the default branch and Vercel deploys it.

The public site is a project showcase only (vision, renderings, plans, builder, project-status timeline). Per securities counsel's 506(b) review, it carries **no offering terms, returns, minimums, documents, or investor sign-up** — all of that lives exclusively behind authenticated login in the investor portal. The "Investor Login" buttons link to investorportal.trumbullnorth.com.

| File | Edit this for… |
| --- | --- |
| `index.html` | All page copy and sections (hero, vision, milestones, renderings rail, plans, builder, portal link section, footer). Section layout/colors are inline on the elements. Fonts (Instrument Serif + Jost) load from Google Fonts via `<link>` in the head. |
| `css/site.css` | Base styles, hover/focus states, renderings rail, lightbox, responsive breakpoints |
| `js/main.js` | Rail arrows + renderings lightbox |
| `assets/images/` | Site plan and renderings (referenced by name from `index.html`) |
| `css/fonts.css`, `assets/fonts/` | Legacy self-hosted fonts (Archivo, Playfair) — currently unused but harmless |
| `site-model/` | The live 3D site model (three.js from CDN + `three-d-stage.js` viewer + the block geometry inline in `site-model/index.html`) — currently not linked from the page |

Common edits:

- **Change the contact email** — it appears in `index.html` (portal section + footer).
- **Swap a rendering** — replace the file in `assets/images/` keeping the same name, or update the `src` and matching `data-full` attribute in `index.html`.
- **Update the timeline** — the milestone blocks are plain repeated HTML in `index.html`; copy an existing block and edit the text.

**Compliance note (Rule 506(b)):** do not add offering terms (rate, term, raise size, minimums), commitment/interest forms, or offering documents to this public site — anything in the repo root is publicly fetchable. Investor-facing material belongs in `portal/` behind login. Confirm public-copy changes with securities counsel.

## Investor portal (`portal/`)

Full application (auth, database, e-signatures, messaging). Setup and deployment instructions are in [`portal/README.md`](portal/README.md).
