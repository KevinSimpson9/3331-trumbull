const pptxgen = require("pptxgenjs");
const path = require("path");

const IMG = (n) => path.join(__dirname, "img", n);

// ── Brand palette, lifted from trumbullnorth.com ──────────────────────────────
const INK      = "12303C"; // deep teal — dominant dark
const INK2     = "173F4D";
const TEAL     = "1D5260";
const GOLD     = "D9A441";
const GOLD_LT  = "E3C581";
const GOLD_DK  = "8A6414";
const PAPER    = "F3F5F5";
const WHITE    = "FFFFFF";
const MUTED    = "6B8792";
const MUTED_LT = "9FC0C8";
const BODY     = "47606B";
const HAIR     = "E2E8E9";
const TINT     = "F8F1E0"; // warm gold tint for highlight rows

const SERIF = "Cambria";
const SANS  = "Calibri";

const W = 13.3, H = 7.5, M = 0.62;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "AK Capital Investments LLC";
pres.company = "AK Capital Investments LLC";
pres.title = "3331 Trumbull — Investor Deck";

const shadow = (o = {}) => ({
  type: "outer", color: "0B2029", blur: 12, offset: 2, angle: 90, opacity: 0.14, ...o,
});

// Repeated motif: a small gold square that marks every eyebrow label and card.
function marker(slide, x, y, size = 0.1, color = GOLD) {
  slide.addShape(pres.ShapeType.rect, { x, y, w: size, h: size, fill: { color } });
}

function eyebrow(slide, text, x, y, color = GOLD_DK) {
  marker(slide, x, y + 0.055, 0.1, color === GOLD_DK ? GOLD : GOLD);
  slide.addText(text, {
    x: x + 0.22, y, w: 8.5, h: 0.24, fontFace: SANS, fontSize: 10.5, bold: true,
    color, charSpacing: 2.4, margin: 0, valign: "middle",
  });
}

function title(slide, text, x, y, w, color = INK, size = 32) {
  slide.addText(text, {
    x, y, w, h: 0.78, fontFace: SERIF, fontSize: size, bold: true, color, margin: 0, valign: "middle",
  });
}

function footer(slide, page, dark = false) {
  slide.addText("3331 TRUMBULL   |   AK CAPITAL INVESTMENTS LLC × BONDY CONSTRUCTION & DESIGN", {
    x: M, y: H - 0.46, w: 10.4, h: 0.24, fontFace: SANS, fontSize: 8.5,
    color: dark ? "5B7F8A" : "93A8B0", charSpacing: 1.2, margin: 0, valign: "middle",
  });
  slide.addText(String(page), {
    x: W - M - 0.5, y: H - 0.46, w: 0.5, h: 0.24, fontFace: SANS, fontSize: 8.5,
    color: dark ? "5B7F8A" : "93A8B0", align: "right", margin: 0, valign: "middle",
  });
}

// Stat callout on a tinted card
function statCard(slide, { x, y, w, h, value, label, dark = false, vSize }) {
  const fs = vSize || (value.length >= 8 ? 18 : value.length >= 7 ? 21 : 25);
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: dark ? "0E2833" : WHITE },
    line: dark ? { color: "27505F", width: 0.75 } : { color: HAIR, width: 0.75 },
    shadow: dark ? undefined : shadow({ blur: 8, opacity: 0.09 }),
  });
  marker(slide, x + 0.22, y + 0.2, 0.09, GOLD);
  slide.addText(value, {
    x: x + 0.22, y: y + 0.32, w: w - 0.4, h: 0.42, fontFace: SERIF, fontSize: fs, bold: true,
    color: dark ? WHITE : INK, margin: 0, valign: "middle",
  });
  slide.addText(label, {
    x: x + 0.22, y: y + 0.74, w: w - 0.4, h: h - 0.84, fontFace: SANS, fontSize: 8.5,
    color: dark ? MUTED_LT : MUTED, charSpacing: 0.9, margin: 0, valign: "top", lineSpacing: 10.5,
  });
}

// Simple table renderer — full control over row tinting
function table(slide, { x, y, w, cols, header, rows, rowH = 0.36, headH = 0.32, fontSize = 10.5 }) {
  const total = cols.reduce((a, b) => a + b, 0);
  const cw = cols.map((c) => (c / total) * w);
  const cx = []; let acc = x;
  cw.forEach((c) => { cx.push(acc); acc += c; });

  slide.addShape(pres.ShapeType.rect, { x, y, w, h: headH, fill: { color: "F0F4F5" }, line: { color: HAIR, width: 0.75 } });
  header.forEach((t, i) => {
    slide.addText(t, {
      x: cx[i] + 0.12, y, w: cw[i] - 0.24, h: headH, fontFace: SANS, fontSize: 8.5, bold: true,
      color: MUTED, charSpacing: 1.2, margin: 0, valign: "middle",
      align: i === 0 ? "left" : "right",
    });
  });

  rows.forEach((r, ri) => {
    const ry = y + headH + ri * rowH;
    const hl = r.highlight;
    slide.addShape(pres.ShapeType.rect, {
      x, y: ry, w, h: rowH,
      fill: { color: hl ? TINT : WHITE }, line: { color: HAIR, width: 0.75 },
    });
    r.cells.forEach((t, i) => {
      slide.addText(t, {
        x: cx[i] + 0.12, y: ry, w: cw[i] - 0.24, h: rowH, fontFace: SANS, fontSize,
        bold: hl || (r.bold && i === 0), color: hl ? GOLD_DK : (i === 0 ? INK : BODY),
        margin: 0, valign: "middle", align: i === 0 ? "left" : "right",
      });
    });
  });
  return y + headH + rows.length * rowH;
}

function note(slide, text, x, y, w, dark = false) {
  slide.addText(text, {
    x, y, w, h: 0.52, fontFace: SANS, fontSize: 8.5, italic: true,
    color: dark ? "6E93A0" : "93A8B0", margin: 0, valign: "top", lineSpacing: 11,
  });
}

/* ───────────────────────────── 1 · TITLE ──────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addImage({ path: IMG("rendering-aerial.jpg"), x: 6.6, y: 0, w: 6.7, h: H, sizing: { type: "cover", w: 6.7, h: H } });
  s.addShape(pres.ShapeType.rect, { x: 6.6, y: 0, w: 6.7, h: H, fill: { color: INK, transparency: 42 } });
  s.addShape(pres.ShapeType.rect, { x: 6.0, y: 0, w: 1.2, h: H, fill: { color: INK, transparency: 30 } });
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 6.4, h: H, fill: { color: INK } });

  marker(s, M, 1.08, 0.13);
  s.addText("AK CAPITAL  ×  BONDY CONSTRUCTION & DESIGN", {
    x: M + 0.26, y: 1.0, w: 5.4, h: 0.3, fontFace: SANS, fontSize: 9.5, bold: true,
    color: GOLD_LT, charSpacing: 1.2, margin: 0, valign: "middle",
  });

  s.addText("3331 Trumbull", {
    x: M, y: 1.5, w: 5.6, h: 0.95, fontFace: SERIF, fontSize: 42, bold: true, color: WHITE, margin: 0, valign: "middle",
  });
  s.addText("Twenty-five for-sale townhomes on a full city block in North Corktown, Detroit — built in two phases.", {
    x: M, y: 2.5, w: 5.3, h: 1.1, fontFace: SANS, fontSize: 14, color: "C6DADE", margin: 0, valign: "top", lineSpacing: 21,
  });

  const chips = [
    ["13 + 12", "UNITS, PHASE 1 / PHASE 2"],
    ["$700K", "PHASE 1 NOTE TRANCHE"],
    ["20%", "FIXED, PAID QUARTERLY"],
  ];
  chips.forEach(([v, l], i) => {
    const x = M + i * 1.78;
    s.addText(v, { x, y: 3.9, w: 1.7, h: 0.42, fontFace: SERIF, fontSize: 21, bold: true, color: WHITE, margin: 0, valign: "middle" });
    s.addText(l, { x, y: 4.33, w: 1.7, h: 0.5, fontFace: SANS, fontSize: 7.8, color: MUTED_LT, charSpacing: 0.8, margin: 0, valign: "top", lineSpacing: 10 });
  });

  s.addShape(pres.ShapeType.rect, { x: M, y: 5.18, w: 5.4, h: 0.012, fill: { color: "2C5566" } });
  s.addText("SECURED NOTE OFFERING   ·   AUGUST 2026", {
    x: M, y: 5.36, w: 5.4, h: 0.28, fontFace: SANS, fontSize: 10, bold: true, color: GOLD_LT, charSpacing: 1.4, margin: 0, valign: "middle",
  });
  s.addText("Confidential — prepared for the named recipient only. Not an offer to sell securities.", {
    x: M, y: 5.72, w: 5.4, h: 0.5, fontFace: SANS, fontSize: 8.5, color: "5B7F8A", margin: 0, valign: "top", lineSpacing: 11,
  });
}

/* ─────────────────────────── 2 · THE OPPORTUNITY ──────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "THE OPPORTUNITY", M, 0.52);
  title(s, "A city block, built in two bites", M, 0.86, 11.9);

  s.addText(
    "3331 Trumbull is a full city block in North Corktown, master-planned by 4545 Architecture: five buildings around a private parking court with 248 feet of frontage where Trumbull meets Sycamore and Ash. All 25 homes get an attached garage and a private rooftop deck with skyline views.\n\nPermitting completed June 2026. Rather than build all 25 at once, the project runs in two phases — 13 homes, then 12 — so Phase 1 proceeds fund Phase 2 and investor principal returns off the first closings.",
    { x: M, y: 1.8, w: 6.45, h: 2.3, fontFace: SANS, fontSize: 12.5, color: BODY, margin: 0, valign: "top", lineSpacing: 19 }
  );

  const stats = [
    ["25", "TOWNHOMES\n5 BUILDINGS"],
    ["$10.76M", "PROJECTED\nGROSS REVENUE"],
    ["$2.67M", "PROJECTED\nNET PROFIT"],
    ["24.8%", "PROJECTED\nNET MARGIN"],
  ];
  stats.forEach(([v, l], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    statCard(s, { x: M + col * 3.3, y: 4.5 + row * 1.2, w: 3.15, h: 1.12, value: v, label: l });
  });

  s.addShape(pres.ShapeType.rect, { x: 7.42, y: 1.72, w: 5.26, h: 4.42, fill: { color: WHITE }, line: { color: HAIR, width: 0.75 }, shadow: shadow({ blur: 14, opacity: 0.12 }) });
  s.addImage({ path: IMG("site-plan.jpg"), x: 7.62, y: 1.92, w: 4.86, h: 3.62, sizing: { type: "contain", w: 4.86, h: 3.62 } });
  s.addText("ARCHITECTURAL SITE PLAN · SP1.1 · 4545 ARCHITECTURE", {
    x: 7.62, y: 5.62, w: 4.86, h: 0.28, fontFace: SANS, fontSize: 8.5, bold: true, color: MUTED, charSpacing: 1.1, margin: 0, valign: "middle",
  });
  footer(s, 2);
}

/* ───────────────────── 3 · THE TWO-PHASE PLAN (centerpiece) ───────────────── */
{
  const s = pres.addSlide();
  s.background = { color: INK };
  eyebrow(s, "THE PLAN", M, 0.52, GOLD_LT);
  title(s, "Thirteen homes first. Then twelve.", M, 0.86, 11.9, WHITE);
  s.addText("Phasing cuts the capital at risk roughly in half, proves absorption before the second half breaks ground, and lets Phase 1 closings do two jobs at once — return investor principal and fund Phase 2.", {
    x: M, y: 1.76, w: 11.0, h: 0.66, fontFace: SANS, fontSize: 12, color: "C6DADE", margin: 0, valign: "top", lineSpacing: 18,
  });

  const phases = [
    {
      x: M, tag: "PHASE 1", units: "13 homes", sub: "Buildings 1–3",
      lines: [
        "Funded by a First Merchants construction loan — secured at 6% — alongside the $700,000 investor note tranche",
        "Seven $100,000 secured notes — the full raise, and the only raise",
        "Pre-sales launch during construction; closings begin as buildings deliver",
      ],
      accent: true,
    },
    {
      x: M + 6.15, tag: "PHASE 2", units: "12 homes", sub: "Buildings 4–5",
      lines: [
        "Funded from Phase 1 closing proceeds — no second investor raise",
        "Breaks ground while Phase 1 is still closing out",
        "Completes the block and the $10.76M projected sellout",
      ],
      accent: false,
    },
  ];

  phases.forEach((p) => {
    s.addShape(pres.ShapeType.rect, {
      x: p.x, y: 2.52, w: 5.93, h: 2.52,
      fill: { color: p.accent ? "16394A" : "0E2833" },
      line: { color: p.accent ? GOLD : "27505F", width: p.accent ? 1.25 : 0.75 },
    });
    marker(s, p.x + 0.3, 2.82, 0.11, p.accent ? GOLD : MUTED_LT);
    s.addText(p.tag, {
      x: p.x + 0.52, y: 2.74, w: 2.0, h: 0.26, fontFace: SANS, fontSize: 10, bold: true,
      color: p.accent ? GOLD_LT : MUTED_LT, charSpacing: 2.0, margin: 0, valign: "middle",
    });
    s.addText(p.units, {
      x: p.x + 0.3, y: 3.06, w: 3.0, h: 0.52, fontFace: SERIF, fontSize: 28, bold: true, color: WHITE, margin: 0, valign: "middle",
    });
    s.addText(p.sub, {
      x: p.x + 3.3, y: 3.06, w: 2.33, h: 0.52, fontFace: SANS, fontSize: 11, color: MUTED_LT, margin: 0, valign: "middle", align: "right",
    });
    s.addText(
      p.lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i !== p.lines.length - 1 } })),
      { x: p.x + 0.3, y: 3.68, w: 5.33, h: 1.2, fontFace: SANS, fontSize: 10.5, color: "C6DADE", margin: 0, valign: "top", paraSpaceAfter: 6, lineSpacing: 14 }
    );
  });

  // The repayment trigger band
  s.addShape(pres.ShapeType.rect, { x: M, y: 5.28, w: 12.08, h: 1.32, fill: { color: "16394A" }, line: { color: GOLD, width: 1.25 } });
  s.addText("8 of 13", { x: M + 0.32, y: 5.5, w: 1.7, h: 0.6, fontFace: SERIF, fontSize: 32, bold: true, color: GOLD_LT, margin: 0, valign: "middle" });
  s.addText("PHASE 1 CLOSINGS RETURN\nINVESTOR PRINCIPAL IN FULL", { x: M + 2.12, y: 5.5, w: 2.6, h: 0.6, fontFace: SANS, fontSize: 9, bold: true, color: WHITE, charSpacing: 0.8, margin: 0, valign: "middle", lineSpacing: 12 });
  s.addText(
    "Eight closings throw off roughly $3.4M of gross sale proceeds and $855,204 of cumulative net profit against $700,000 of principal — 1.22× coverage measured on profit alone, after the construction lender is fully repaid on those units. The remaining five Phase 1 homes and all of Phase 2 close free of the note.",
    { x: M + 5.0, y: 5.46, w: 6.72, h: 0.98, fontFace: SANS, fontSize: 10, color: "C6DADE", margin: 0, valign: "middle", lineSpacing: 14 }
  );
  footer(s, 3, true);
}

/* ──────────────────── 4 · CAPITAL STRUCTURE & THE NOTE ────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "THE OFFER", M, 0.52);
  title(s, "Fixed return, real security, short clock", M, 0.86, 11.9);

  const terms = [
    ["20% fixed", "ANNUAL RATE, INTEREST-ONLY"],
    ["$5,000", "PER QUARTER, PER $100K NOTE"],
    ["18–24 mo", "TERM — EARLY AT 8 OF 13"],
    ["2nd position", "RECORDED DEBT + GUARANTEE"],
  ];
  terms.forEach(([v, l], i) => {
    statCard(s, { x: M + i * 3.06, y: 1.72, w: 2.88, h: 1.4, value: v, label: l });
  });

  // Note economics table
  const end = table(s, {
    x: M, y: 3.42, w: 7.3,
    cols: [2.5, 1, 1, 1],
    header: ["NOTE ECONOMICS", "1 NOTE", "3 NOTES", "7 NOTES"],
    rows: [
      { cells: ["Principal", "$100,000", "$300,000", "$700,000"] },
      { cells: ["Quarterly interest", "$5,000", "$15,000", "$35,000"] },
      { cells: ["Interest per year", "$20,000", "$60,000", "$140,000"] },
      { cells: ["Total interest — 24 months", "$40,000", "$120,000", "$280,000"] },
      { cells: ["Total cash returned — 24 months", "$140,000", "$420,000", "$980,000"], highlight: true },
    ],
    rowH: 0.38,
  });
  note(s, "Interest is a fixed contractual obligation of the borrower under the promissory note, not a projection. Seven $100,000 notes; accredited investors only.", M, end + 0.14, 7.3);

  // Capital stack
  s.addShape(pres.ShapeType.rect, { x: 8.28, y: 3.42, w: 4.42, h: 2.98, fill: { color: INK } });
  marker(s, 8.56, 3.7, 0.1);
  s.addText("PHASE 1 CAPITAL STACK", { x: 8.78, y: 3.62, w: 3.6, h: 0.26, fontFace: SANS, fontSize: 9.5, bold: true, color: GOLD_LT, charSpacing: 1.6, margin: 0, valign: "middle" });

  const stack = [
    ["Senior construction loan", "First Merchants Bank · secured at 6%", "27505F"],
    ["Investor notes", "$700,000 · 2nd position", GOLD],
    ["Sponsor equity & land", "Site owned since 2022", "27505F"],
  ];
  stack.forEach(([a, b, c], i) => {
    const y = 4.04 + i * 0.66;
    s.addShape(pres.ShapeType.rect, { x: 8.56, y, w: 0.06, h: 0.46, fill: { color: c } });
    s.addText(a, { x: 8.76, y, w: 3.7, h: 0.24, fontFace: SANS, fontSize: 11, bold: true, color: WHITE, margin: 0, valign: "middle" });
    s.addText(b, { x: 8.76, y: y + 0.23, w: 3.7, h: 0.23, fontFace: SANS, fontSize: 9.5, color: MUTED_LT, margin: 0, valign: "middle" });
  });
  s.addText("First Merchants has financed $10M+ of Bondy projects since 2019, all obligations met per terms.", {
    x: 8.56, y: 5.94, w: 3.9, h: 0.4, fontFace: SANS, fontSize: 8.5, italic: true, color: "6E93A0", margin: 0, valign: "top", lineSpacing: 11,
  });
  footer(s, 4);
}

/* ────────────────────────────── 5 · THE PRODUCT ───────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "THE PRODUCT", M, 0.52);
  title(s, "Two proven floorplans, all under $450K", M, 0.86, 11.9);

  const units = [
    { tag: "TYPE A · 17 HOMES", price: "$432,870", psf: "$282 / SF", specs: ["3 BR / 2.5 BA", "1,535 sf", "Tuck-under garage", "Private roof deck"] },
    { tag: "TYPE B · 8 HOMES", price: "$409,384", psf: "$292 / SF", specs: ["2 BR / 2.5 BA", "1,402 sf", "Tuck-under garage", "Private roof deck"] },
  ];
  units.forEach((u, i) => {
    const x = M + i * 3.34;
    s.addShape(pres.ShapeType.rect, { x, y: 1.78, w: 3.14, h: 2.5, fill: { color: WHITE }, line: { color: HAIR, width: 0.75 }, shadow: shadow({ blur: 10, opacity: 0.1 }) });
    marker(s, x + 0.26, 2.06, 0.1);
    s.addText(u.tag, { x: x + 0.48, y: 1.98, w: 2.5, h: 0.26, fontFace: SANS, fontSize: 9, bold: true, color: GOLD_DK, charSpacing: 1.4, margin: 0, valign: "middle" });
    s.addText(u.price, { x: x + 0.26, y: 2.34, w: 2.62, h: 0.5, fontFace: SERIF, fontSize: 25, bold: true, color: INK, margin: 0, valign: "middle" });
    s.addText(u.psf + "  ·  launch pricing", { x: x + 0.26, y: 2.84, w: 2.62, h: 0.26, fontFace: SANS, fontSize: 10, color: MUTED, margin: 0, valign: "middle" });
    s.addText(u.specs.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j !== u.specs.length - 1 } })), {
      x: x + 0.26, y: 3.18, w: 2.62, h: 0.98, fontFace: SANS, fontSize: 10, color: BODY, margin: 0, valign: "top", paraSpaceAfter: 3, lineSpacing: 13,
    });
  });

  s.addShape(pres.ShapeType.rect, { x: M, y: 4.44, w: 6.48, h: 1.7, fill: { color: WHITE }, line: { color: HAIR, width: 0.75 }, shadow: shadow({ blur: 10, opacity: 0.1 }) });
  marker(s, M + 0.26, 4.72, 0.1);
  s.addText("FINISHES & UPGRADE REVENUE", { x: M + 0.48, y: 4.64, w: 5.7, h: 0.26, fontFace: SANS, fontSize: 9, bold: true, color: GOLD_DK, charSpacing: 1.4, margin: 0, valign: "middle" });
  s.addText("Granite and quartz tops, engineered wood and tile floors, full-glass shower enclosures, Andersen windows, smart thermostats. Launch pricing produces a $10.6M sellout before upgrades; the proforma carries a $125,000 upgrade-revenue allowance on top.", {
    x: M + 0.26, y: 5.0, w: 5.96, h: 0.98, fontFace: SANS, fontSize: 10.5, color: BODY, margin: 0, valign: "top", lineSpacing: 15,
  });

  s.addImage({ path: IMG("rendering-street-dusk.jpg"), x: 7.42, y: 1.78, w: 5.26, h: 4.36, sizing: { type: "cover", w: 5.26, h: 4.36 } });
  footer(s, 5);
}

/* ─────────────────────────── 6 · MARKET EVIDENCE ──────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "MARKET EVIDENCE", M, 0.52);
  title(s, "Priced $30–50/sf under closed comps", M, 0.86, 11.9);
  s.addText("These are recorded closings from the same submarket, the same architect, and the same builder — not projections. 3331 Trumbull launches below every one of them.", {
    x: M, y: 1.76, w: 8.6, h: 0.46, fontFace: SANS, fontSize: 12, color: BODY, margin: 0, valign: "top", lineSpacing: 17,
  });

  const end = table(s, {
    x: M, y: 2.36, w: 8.6,
    cols: [3.5, 1.35, 1.15, 1.3],
    header: ["COMMUNITY", "SIZE (SF)", "SOLD $/SF", "STATUS"],
    rows: [
      { cells: ["3331 Trumbull — North Corktown (subject)", "1,402–1,535", "$282–292", "Launch pricing"], highlight: true },
      { cells: ["Sycamore Park — Bondy, 1 block from site", "1,261–1,585", "$312–327", "Sold out"] },
      { cells: ["Terraces at Woodbridge — same architect", "1,278–1,592", "$313–341", "6 closings"] },
      { cells: ["Harrison 12 — Bondy, North Corktown", "843–1,511", "$289–326", "Sold out"] },
      { cells: ["Scripps District — Woodbridge", "1,331–1,618", "$256–286", "~65% of 61 sold"] },
      { cells: ["The Coachman — Corktown", "696–1,500", "$349–428", "Sold out"] },
      { cells: ["The Eleventh — Corktown", "2,030–2,054", "$229–292", "Sold out"] },
    ],
    rowH: 0.375,
  });
  note(s, "Sources: Realcomp IDX sold records (June–July 2026 pulls), ALTA seller settlement statements, and builder price lists, per Bondy Construction & Design. Full comp book with unit-level closings is in the offering package. All figures should be independently verified.", M, end + 0.16, 8.6);

  s.addShape(pres.ShapeType.rect, { x: 9.5, y: 2.36, w: 3.18, h: 3.6, fill: { color: INK } });
  marker(s, 9.76, 2.64, 0.1);
  s.addText("THE HEADROOM", { x: 9.98, y: 2.56, w: 2.5, h: 0.26, fontFace: SANS, fontSize: 9, bold: true, color: GOLD_LT, charSpacing: 1.6, margin: 0, valign: "middle" });
  s.addText("$288", { x: 9.76, y: 2.98, w: 2.7, h: 0.56, fontFace: SERIF, fontSize: 30, bold: true, color: WHITE, margin: 0, valign: "middle" });
  s.addText("3331 TRUMBULL BLENDED\nLAUNCH PRICE PER SF", { x: 9.76, y: 3.54, w: 2.7, h: 0.44, fontFace: SANS, fontSize: 8.5, color: MUTED_LT, charSpacing: 0.8, margin: 0, valign: "top", lineSpacing: 11 });
  s.addShape(pres.ShapeType.rect, { x: 9.76, y: 4.14, w: 2.7, h: 0.012, fill: { color: "2C5566" } });
  s.addText("$320", { x: 9.76, y: 4.28, w: 2.7, h: 0.5, fontFace: SERIF, fontSize: 27, bold: true, color: GOLD_LT, margin: 0, valign: "middle" });
  s.addText("SYCAMORE PARK BLENDED —\nBONDY-BUILT, ONE BLOCK AWAY,\nSOLD OUT AT SETTLEMENT", { x: 9.76, y: 4.8, w: 2.7, h: 0.66, fontFace: SANS, fontSize: 8.5, color: MUTED_LT, charSpacing: 0.8, margin: 0, valign: "top", lineSpacing: 11 });
  footer(s, 6);
}

/* ───────────────────────────── 7 · FINANCIALS ─────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "FINANCIALS", M, 0.52);
  title(s, "Sales proforma — all 25 units", M, 0.86, 11.9);

  const end = table(s, {
    x: M, y: 1.68, w: 7.1,
    cols: [3.2, 1.4],
    header: ["LINE ITEM", "AMOUNT"],
    rows: [
      { cells: ["Gross unit sales (25 units)", "$10,633,862"] },
      { cells: ["Upgrade revenue allowance", "$125,000"] },
      { cells: ["Total projected revenue", "$10,758,862"], bold: true },
      { cells: ["Total development cost", "($7,387,024)"] },
      { cells: ["Gross profit", "$3,371,838"], bold: true },
      { cells: ["Closing costs", "($699,326)"] },
      { cells: ["Projected net profit", "$2,672,512"], highlight: true },
    ],
    rowH: 0.40, fontSize: 11.5,
  });
  note(s, "Source: 3331 Trumbull for-sale proforma, June 2026. Figures reflect launch pricing across both phases before upgrade contracts. All figures should be independently verified.", M, end + 0.12, 7.1);

  const stats = [
    ["$288", "BLENDED PRICE\nPER SQUARE FOOT"],
    ["$106,900", "PROJECTED NET\nPROFIT PER UNIT"],
    ["24.8%", "PROJECTED\nNET MARGIN"],
    ["36.2%", "PROJECTED\nRETURN ON COST"],
  ];
  stats.forEach(([v, l], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    statCard(s, { x: 8.14 + col * 2.34, y: 1.68 + row * 1.66, w: 2.2, h: 1.52, value: v, label: l });
  });
  // Underwriting cushion — the proforma is modeled above the debt actually secured
  s.addShape(pres.ShapeType.rect, { x: M, y: 5.58, w: 12.08, h: 1.16, fill: { color: INK }, line: { color: GOLD, width: 1.25 } });
  s.addText("6%", { x: M + 0.34, y: 5.76, w: 1.5, h: 0.48, fontFace: SERIF, fontSize: 29, bold: true, color: GOLD_LT, margin: 0, valign: "middle" });
  s.addText("CONSTRUCTION DEBT\nSECURED", { x: M + 0.34, y: 6.24, w: 2.0, h: 0.38, fontFace: SANS, fontSize: 8, bold: true, color: WHITE, charSpacing: 0.7, margin: 0, valign: "top", lineSpacing: 10 });
  s.addText("9%", { x: M + 2.62, y: 5.76, w: 1.5, h: 0.48, fontFace: SERIF, fontSize: 29, bold: true, color: WHITE, margin: 0, valign: "middle" });
  s.addText("CARRIED IN THE\nPROFORMA ABOVE", { x: M + 2.62, y: 6.24, w: 2.0, h: 0.38, fontFace: SANS, fontSize: 8, bold: true, color: MUTED_LT, charSpacing: 0.7, margin: 0, valign: "top", lineSpacing: 10 });
  s.addText(
    "The construction loan is secured at 6%. Every figure above is underwritten at 9%, with construction overage allowances carried in the budget — so the projected margin is modeled three points above the debt cost actually in hand, before any of that cushion is counted.",
    { x: M + 4.9, y: 5.78, w: 6.9, h: 0.8, fontFace: SANS, fontSize: 10.5, color: "C6DADE", margin: 0, valign: "middle", lineSpacing: 14 }
  );
  footer(s, 7);
}

/* ─────────────────── 8 · TRACK RECORD — CLOSED ON THIS BLOCK ──────────────── */
{
  const s = pres.addSlide();
  s.background = { color: INK };
  eyebrow(s, "TRACK RECORD", M, 0.52, GOLD_LT);
  title(s, "Closed on this block, three times", M, 0.86, 11.9, WHITE);
  s.addText("Bondy Construction & Design has built and sold out three townhome developments within blocks of 3331 Trumbull. These are closed transactions from the firm's real-estate-owned schedule — purchase, build cost, sale price, and realized profit.", {
    x: M, y: 1.76, w: 11.6, h: 0.66, fontFace: SANS, fontSize: 12, color: "C6DADE", margin: 0, valign: "top", lineSpacing: 17,
  });

  const projects = [
    { name: "North Corktown 11", addr: "3301 Cochrane St", units: "11 units", sale: "$4,650,000", profit: "$1,030,000", sold: "SOLD AUG 2021" },
    { name: "Harrison 12", addr: "2746 Harrison St", units: "12 units", sale: "$4,250,000", profit: "$750,000", sold: "SOLD AUG 2024" },
    { name: "Sycamore Park", addr: "1600 Sycamore St", units: "10 units", sale: "$4,352,000", profit: "$982,000", sold: "SOLD MAR 2025" },
  ];
  projects.forEach((p, i) => {
    const x = M + i * 4.06;
    s.addShape(pres.ShapeType.rect, { x, y: 2.5, w: 3.86, h: 2.44, fill: { color: "0E2833" }, line: { color: "27505F", width: 0.75 } });
    marker(s, x + 0.26, 2.78, 0.1);
    s.addText(p.sold, { x: x + 0.48, y: 2.7, w: 3.2, h: 0.26, fontFace: SANS, fontSize: 8.5, bold: true, color: GOLD_LT, charSpacing: 1.4, margin: 0, valign: "middle" });
    s.addText(p.name, { x: x + 0.26, y: 3.04, w: 3.34, h: 0.4, fontFace: SERIF, fontSize: 19, bold: true, color: WHITE, margin: 0, valign: "middle" });
    s.addText(p.addr + "  ·  " + p.units, { x: x + 0.26, y: 3.44, w: 3.34, h: 0.26, fontFace: SANS, fontSize: 9.5, color: MUTED_LT, margin: 0, valign: "middle" });
    s.addShape(pres.ShapeType.rect, { x: x + 0.26, y: 3.82, w: 3.34, h: 0.012, fill: { color: "2C5566" } });
    s.addText("SALE PRICE", { x: x + 0.26, y: 3.94, w: 1.6, h: 0.22, fontFace: SANS, fontSize: 8, color: MUTED_LT, charSpacing: 0.8, margin: 0, valign: "middle" });
    s.addText(p.sale, { x: x + 0.26, y: 4.14, w: 1.6, h: 0.32, fontFace: SERIF, fontSize: 16, bold: true, color: WHITE, margin: 0, valign: "middle" });
    s.addText("NET PROFIT", { x: x + 2.0, y: 3.94, w: 1.6, h: 0.22, fontFace: SANS, fontSize: 8, color: MUTED_LT, charSpacing: 0.8, margin: 0, valign: "middle" });
    s.addText(p.profit, { x: x + 2.0, y: 4.14, w: 1.6, h: 0.32, fontFace: SERIF, fontSize: 16, bold: true, color: GOLD_LT, margin: 0, valign: "middle" });
  });

  s.addShape(pres.ShapeType.rect, { x: M, y: 5.14, w: 12.08, h: 1.28, fill: { color: "16394A" }, line: { color: GOLD, width: 1.25 } });
  const totals = [
    ["33", "UNITS DELIVERED\n& SOLD"],
    ["$13.25M", "COMBINED\nSALE PROCEEDS"],
    ["$2.76M", "REALIZED\nNET PROFIT"],
    ["20.8%", "REALIZED\nNET MARGIN"],
    ["$83,697", "REALIZED NET\nPROFIT PER UNIT"],
  ];
  totals.forEach(([v, l], i) => {
    const x = M + 0.32 + i * 2.36;
    s.addText(v, { x, y: 5.32, w: 2.2, h: 0.42, fontFace: SERIF, fontSize: 21, bold: true, color: i === 4 ? GOLD_LT : WHITE, margin: 0, valign: "middle" });
    s.addText(l, { x, y: 5.74, w: 2.2, h: 0.44, fontFace: SANS, fontSize: 8, color: MUTED_LT, charSpacing: 0.7, margin: 0, valign: "top", lineSpacing: 10 });
  });
  note(s, "Source: Bondy Construction & Design real-estate-owned and experience schedule, 21 March 2026. 3331 Trumbull's projected 24.8% margin and $106,900 net profit per unit sit modestly above what these three projects actually realized.", M, 6.56, 12.08, true);
  footer(s, 8, true);
}

/* ──────────────────── 9 · BCD PORTFOLIO AT A GLANCE ───────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "SPONSORSHIP", M, 0.52);
  title(s, "The builder behind the neighborhood", M, 0.86, 11.9);

  s.addText([
    { text: "Luke Bondy — CEO, Bondy Construction & Design\n", options: { bold: true, fontSize: 12.5, color: INK } },
    { text: "Vertically integrated developer and licensed general contractor across Southeast Michigan. Builder and owner on 140+ residential for-sale units with more than $100M of completed construction, plus a ~50-unit rental portfolio he owns and his team operates.\n\n", options: { fontSize: 11, color: BODY } },
    { text: "Kevin Simpson — Co-Developer & Investor Relations, AK Capital Investments\n", options: { bold: true, fontSize: 12.5, color: INK } },
    { text: "Real estate investor across single-family, multifamily, and commercial. Delta Air Lines pilot and former U.S. Army Blackhawk pilot; leads investor reporting and capital structure for the project.", options: { fontSize: 11, color: BODY } },
  ], { x: M, y: 1.82, w: 5.6, h: 2.4, margin: 0, valign: "top", fontFace: SANS, lineSpacing: 16 });

  const port = [
    ["$100M+", "COMPLETED\nCONSTRUCTION"],
    ["140+", "UNITS BUILT\n& SOLD"],
    ["50+", "RENTAL UNITS\nOWNED"],
  ];
  port.forEach(([v, l], i) => {
    statCard(s, { x: M + i * 1.93, y: 4.52, w: 1.82, h: 1.15, value: v, label: l, vSize: 21 });
  });

  const end = table(s, {
    x: 6.5, y: 1.82, w: 6.18,
    cols: [3.1, 1.35, 0.95],
    header: ["COMPLETED PROJECTS", "TYPE", "UNITS"],
    rows: [
      { cells: ["Wesburn Villas", "Townhomes", "28"] },
      { cells: ["iPG — Detroit", "Townhomes", "16"] },
      { cells: ["Harrison 12 — North Corktown", "Townhomes", "12"] },
      { cells: ["North Corktown 11", "Townhomes", "11"] },
      { cells: ["Sycamore Park — North Corktown", "Townhomes", "10"] },
      { cells: ["2221 & 2225 Wabash — Detroit", "Multi", "3"] },
      { cells: ["Total delivered", "6 projects", "80"], highlight: true },
    ],
    rowH: 0.355, fontSize: 10,
  });
  note(s, "Source: Bondy Construction & Design firm profile, July 2026. Banking reference: First Merchants Bank has financed $10M+ of Bondy projects since 2019, with all obligations met per terms — reference letter available on request.", 6.5, end + 0.16, 6.18);
  footer(s, 9);
}

/* ──────────────────────────── 10 · EXECUTION ──────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: PAPER };
  eyebrow(s, "EXECUTION", M, 0.52);
  title(s, "How the two phases run", M, 0.86, 9.0);

  const steps = [
    { when: "2021–2025", head: "Proof, delivered", body: "Cochrane 11, Harrison 12, and Sycamore Park built and sold out within blocks of the site.", done: true },
    { when: "JUNE 2026", head: "Permitting complete", body: "Architecture, structure, and MEP documented by 4545 Architecture. Land owned since 2022.", done: true },
    { when: "NOW", head: "Phase 1 capital close", body: "$700,000 of secured notes closes alongside the First Merchants construction loan.", done: true },
    { when: "MONTHS 2–14", head: "Phase 1 build", body: "13 homes across Buildings 1–3. Pre-sales launch during the build.", done: false },
    { when: "MONTHS 14–20", head: "Phase 1 closings", body: "Homes deliver and close in sequence. Investor principal returns in full at the eighth closing.", done: false, key: true },
    { when: "MONTHS 14–26", head: "Phase 2 build", body: "12 homes across Buildings 4–5, funded from Phase 1 proceeds — no second raise.", done: false },
    { when: "MONTHS 26–32", head: "Sellout", body: "Phase 2 closes out the block against a $10.76M projected sellout.", done: false },
  ];

  const colW = 1.66, gap = 0.06;
  steps.forEach((st, i) => {
    const x = M + i * (colW + gap);
    s.addShape(pres.ShapeType.rect, {
      x, y: 1.86, w: colW, h: 3.5,
      fill: { color: st.key ? INK : WHITE },
      line: { color: st.key ? GOLD : HAIR, width: st.key ? 1.25 : 0.75 },
      shadow: st.key ? undefined : shadow({ blur: 8, opacity: 0.09 }),
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.22, y: 2.12, w: 0.17, h: 0.17,
      fill: st.done || st.key ? { color: GOLD } : { color: st.key ? INK : WHITE },
      line: { color: GOLD, width: 1.25 },
    });
    s.addText(st.when, {
      x: x + 0.22, y: 2.42, w: colW - 0.44, h: 0.44, fontFace: SANS, fontSize: 8.5, bold: true,
      color: st.key ? GOLD_LT : GOLD_DK, charSpacing: 1.0, margin: 0, valign: "top", lineSpacing: 11,
    });
    s.addText(st.head, {
      x: x + 0.22, y: 2.9, w: colW - 0.4, h: 0.66, fontFace: SERIF, fontSize: 12.5, bold: true,
      color: st.key ? WHITE : INK, margin: 0, valign: "top", lineSpacing: 15,
    });
    s.addText(st.body, {
      x: x + 0.22, y: 3.64, w: colW - 0.4, h: 1.6, fontFace: SANS, fontSize: 9,
      color: st.key ? "C6DADE" : BODY, margin: 0, valign: "top", lineSpacing: 12,
    });
  });

  s.addShape(pres.ShapeType.rect, { x: M, y: 5.58, w: 12.08, h: 0.86, fill: { color: WHITE }, line: { color: HAIR, width: 0.75 }, shadow: shadow({ blur: 8, opacity: 0.09 }) });
  marker(s, M + 0.28, 5.94, 0.1);
  s.addText("Why the raise is capped: the raise is $700,000 — seven $100,000 secured notes to a small group of accredited investors — closing alongside the First Merchants construction loan to fund Phase 1. Phase 2 requires no additional raise.", {
    x: M + 0.5, y: 5.72, w: 11.3, h: 0.58, fontFace: SANS, fontSize: 10.5, color: BODY, margin: 0, valign: "middle", lineSpacing: 14,
  });
  footer(s, 10);
}

/* ──────────────────────────── 11 · NEXT STEPS ─────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: INK };
  s.addImage({ path: IMG("rendering-street-corner.jpg"), x: 7.0, y: 0, w: 6.3, h: H, sizing: { type: "cover", w: 6.3, h: H } });
  s.addShape(pres.ShapeType.rect, { x: 7.0, y: 0, w: 6.3, h: H, fill: { color: INK, transparency: 45 } });
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 7.0, h: H, fill: { color: INK } });

  eyebrow(s, "NEXT STEPS", M, 0.9, GOLD_LT);
  s.addText("Let's build it.", { x: M, y: 1.32, w: 5.9, h: 0.9, fontFace: SERIF, fontSize: 42, bold: true, color: WHITE, margin: 0, valign: "middle" });

  const steps = [
    ["01", "Reserve your notes", "$100,000 each — seven available in the Phase 1 tranche."],
    ["02", "Review the documents", "Note terms, comp book, CD set, and the June 2026 proforma."],
    ["03", "Fund at close", "Capital closes alongside the First Merchants construction loan and Phase 1 breaks ground."],
  ];
  steps.forEach(([n, h, b], i) => {
    const y = 2.5 + i * 1.06;
    s.addText(n, { x: M, y, w: 0.55, h: 0.36, fontFace: SERIF, fontSize: 17, bold: true, color: GOLD, margin: 0, valign: "middle" });
    s.addText(h, { x: M + 0.6, y, w: 5.3, h: 0.32, fontFace: SANS, fontSize: 13, bold: true, color: WHITE, margin: 0, valign: "middle" });
    s.addText(b, { x: M + 0.6, y: y + 0.32, w: 5.3, h: 0.6, fontFace: SANS, fontSize: 10.5, color: "C6DADE", margin: 0, valign: "top", lineSpacing: 14 });
  });

  s.addShape(pres.ShapeType.rect, { x: M, y: 5.72, w: 5.9, h: 0.012, fill: { color: "2C5566" } });
  s.addText("Kevin Simpson  ·  Co-Developer & Investor Relations", { x: M, y: 5.84, w: 5.9, h: 0.28, fontFace: SANS, fontSize: 12, bold: true, color: WHITE, margin: 0, valign: "middle" });
  s.addText("AK Capital Investments LLC", { x: M, y: 6.1, w: 5.9, h: 0.24, fontFace: SANS, fontSize: 10.5, color: MUTED_LT, margin: 0, valign: "middle" });
  s.addText("Kevin@AKCapital.fund   ·   trumbullnorth.com", { x: M, y: 6.36, w: 5.9, h: 0.26, fontFace: SANS, fontSize: 11, color: GOLD_LT, margin: 0, valign: "middle" });
  s.addText("This overview is a summary for discussion purposes only and is not an offer to sell or a solicitation of an offer to buy any security. Any offering is made only to accredited investors through definitive documents. Figures reflect launch pricing, third-party sold records, the Bondy Construction & Design real-estate-owned schedule dated 21 March 2026, and the June 2026 proforma; all figures should be independently verified. Real estate investments involve risk, including loss of principal. Past performance of prior projects does not guarantee future results.", {
    x: M, y: 6.7, w: 5.9, h: 0.66, fontFace: SANS, fontSize: 6.5, color: "5B7F8A", margin: 0, valign: "top", lineSpacing: 9,
  });
}

pres.writeFile({ fileName: path.join(__dirname, "3331-Trumbull-Investor-Deck-Aug-2026.pptx") })
  .then((f) => console.log("wrote", f));
