# 3331 Trumbull

Detroit townhome development — $350K capital raise by AK Capital Investments LLC × Bondy Construction & Design.

This repo holds both sites:

| Path | What | Deployed |
| --- | --- | --- |
| `index.html` | Public marketing site (trumbullnorth.com) | Existing Vercel project, serves the repo root as a static site |
| `portal/` | Private investor portal — Next.js + Supabase | Separate Vercel project with Root Directory set to `portal/` |

The portal is a full application (auth, database, e-signatures, messaging). Setup and deployment instructions are in [`portal/README.md`](portal/README.md).
