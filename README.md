# 3331 Trumbull

Trumbull North: 12 new construction townhomes for sale at 3331 Trumbull St, North Corktown, Detroit. AK Capital with Bondy's Construction & Design, designed by 4545 Architecture.

This repo holds both sites:

| Path | What | Deployed |
| --- | --- | --- |
| repo root | Public sales site (trumbullnorth.com) for the 12 Phase 1 homes | Existing Vercel project, serves the repo root as a static site |
| `portal/` | Private investor portal — Next.js + Supabase. Investor documents are executed in DocuSign and uploaded here from the back office. | Separate Vercel project with Root Directory set to `portal/` |

## Sales site (repo root)

Static HTML, one real file per page, no build step on Vercel. Rebuilt from the Claude Design handoff (Trumbull North Site v2). No investor content belongs on this site.

The pages are generated. **Edit `scripts/build-site.mjs`, run `node scripts/build-site.mjs`, commit the regenerated files.** Don't hand-edit the `.html` files at the root; the next build overwrites them.

| File | What it holds |
| --- | --- |
| `scripts/build-site.mjs` | All copy, data and settings: `SETTINGS` (hero build frames and stages, draft notice, GA4/Meta IDs, status sheet, form endpoint, socials), `POIS`, `FAQS`, `GALLERY`, `HOMESITES`, `PLAN_LEVELS`, `PAGES` (title/description per route), and every section's markup |
| `index.html`, `residences.html`, … `thank-you.html`, `404.html`, `sitemap.xml`, `robots.txt` | Generated output. `vercel.json` sets `cleanUrls`, so `/residences` serves `residences.html` |
| `css/site.css` | Design tokens and all styles |
| `js/site.js` | Hero build scrub, time-lapse, reserve form (FormSubmit → `/thank-you`), plan tabs, map filters, site plan, status sheet, consent + GA4/Meta |
| `assets/img/` | Renderings, optional floor plan, og.jpg |
| `assets/build/` | Hero build sequence: `lg/` (1062 px, desktop) and `sm/` (640 px, phones), numbered WebP frames scrubbed by scroll or the drag bar |
| `vendor/leaflet/` | Leaflet 1.9.4 (BSD-2), self-hosted, for the satellite proximity map on the home and Neighborhood pages. Imagery tiles come from Esri World Imagery; the SVG map in the page is the fallback |
| `site-model/` | Live 3D site model — not linked from the site |

Common edits (all in `scripts/build-site.mjs`, then rebuild):

- **Mark a homesite reserved/sold** — `HOMESITES`, or set `statusSheetUrl` to a published Google Sheet CSV (`homesite,status` rows plus an optional `cta_count,N` row) and edit the sheet instead.
- **Approve renderings** — set `showDraftNotice: false`.
- **Swap the hero build footage** — re-cut the frames from the new master (commands below), set `build.frames` to the new count, and adjust the `build.stages` start points.
- **Nearby places** — `POIS`: category, name, map label, description, listed distance, lat/lng, and the map label side (`r`/`l`/`t`/`b`, trailing `*` = labelled by default).
- **Tracking** — set `ga4Id` / `metaPixelId`. The consent banner and tags only appear once an ID is set.

Hero build frames (from the master film; skip any opening frames with blurred machinery):

```
ffmpeg -ss 1.33 -i master.mov -vf "fps=6,scale=1062:-2" -c:v libwebp -quality 58 -compression_level 6 assets/build/lg/%03d.webp
ffmpeg -ss 1.33 -i master.mov -vf "fps=6,scale=640:-2"  -c:v libwebp -quality 58 -compression_level 6 assets/build/sm/%03d.webp
```

The reserve form posts to FormSubmit for todd@theloftwarehouse.com. Todd must click FormSubmit's one-time activation email; send one test submission from the live domain to trigger it.

## Investor portal (`portal/`)

Full application (auth, database, e-signatures, messaging). Setup and deployment instructions are in [`portal/README.md`](portal/README.md).
