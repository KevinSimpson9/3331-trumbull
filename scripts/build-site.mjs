// Builds the public Trumbull North site into static HTML at the repo root.
// Run: node scripts/build-site.mjs
// Edit copy, data and settings here, rebuild, commit the generated files.
// Source of truth for copy and layout: the Claude Design handoff (Trumbull North Site v2).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.trumbullnorth.com';

// ---------------------------------------------------------------------------
// Settings. Tracking IDs and the status sheet are read in the browser.
const SETTINGS = {
  ctaCount: 12,
  showDraftNotice: false,               // 'Draft renderings · pending review' tag; removed at Kevin's request (Oct 22)
  // Hero build sequence: frames 001..N.webp in /assets/build/lg (desktop) and /sm (phones), cut from Kevin's film at 6 fps from about 1.3s
  // (after the blurred machines) to the end. Stage values are where each stage starts, as a fraction of the sequence.
  build: { frames: 82, stages: [['Foundations', 0], ['Framing', 0.16], ['Weather wrap', 0.40], ['Exterior', 0.56], ['Complete', 0.78]] },
  ga4Id: '',
  metaPixelId: '',
  statusSheetUrl: '',                   // published Google Sheet CSV: homesite,status and cta_count,N
  formEndpoint: 'https://formsubmit.co/ajax/todd@theloftwarehouse.com',
  thankYouUrl: '/thank-you',
  socials: []                           // AK Capital socials: [['Instagram', 'https://...'], ...]
};

const PHONE = '313-320-8780', TEL = 'tel:+13133208780', EMAIL = 'todd@theloftwarehouse.com';
const ADDRESS = '3331 Trumbull St, Detroit, MI 48208';

// ---------------------------------------------------------------------------
// Data (from the design's logic class)
const CAT = {
  work: ['Work', '#201D19'], eat: ['Eat and drink', '#8A5A3B'], everyday: ['Everyday', '#6A6357'],
  outside: ['Outside', '#5E7354'], game: ['Game night', '#B07A4E'], move: ['Getting around', '#4A5A6A']
};
// [category, name, map label, what, straight-line distance, lat, lng, label side on the map: 'r' | 'l' | '' (hidden until picked)]
const SITE = [42.3418, -83.0712];
const POIS = [
  ['work', 'Michigan Central', 'Michigan Central', 'Station and Newlab, Corktown', '~1.2 mi', 42.3289, -83.0776, 'b*'],
  ['work', "GM at Hudson's Detroit", 'GM', 'Global HQ, Woodward', '~1.5 mi', 42.3330, -83.0470, 'r'],
  ['work', 'Rocket at Campus Martius', 'CBD', 'Central Business District', '~1.5 mi', 42.3314, -83.0466, 'r*'],
  ['work', 'Little Caesars Global HQ', 'Ilitch Cos.', 'District Detroit', '~1.2 mi', 42.3389, -83.0520, 'l'],
  ['work', 'Henry Ford Hospital', 'Henry Ford', 'Henry Ford Health flagship, New Center', '~2.1 mi', 42.3677, -83.0840, 'l*'],
  ['work', 'Wayne State University', 'Wayne State', 'Midtown', '~1.6 mi', 42.3510, -83.0640, 'r*'],
  ['work', 'Detroit Medical Center', 'DMC', 'Medical campus', '~1.7 mi', 42.3530, -83.0560, 'r'],
  ['eat', 'Michigan Avenue, Corktown', 'Michigan Ave', 'Slows Bar BQ, Takoi, Ottava Via, The Sugar House, Two James', '~0.9 mi', 42.3313, -83.0717, 'b*'],
  ['eat', 'Folk', 'Folk', 'All-day cafe on Trumbull', '~0.8 mi', 42.3330, -83.0675, 'l'],
  ['eat', 'Woodbridge Pub', 'Woodbridge Pub', 'Neighborhood pub, Woodbridge', '~1.05 mi', 42.3553, -83.0775, 'l*'],
  ['everyday', 'Rosette Market + Cafe', 'Rosette', 'Grocery and cafe, Michigan Ave', '~0.75 mi', 42.3320, -83.0650, 'b'],
  ['everyday', 'Whole Foods Market Midtown', 'Whole Foods', 'Full-service supermarket', '~1.1 mi', 42.3496, -83.0598, 'r*'],
  ['everyday', 'Eastern Market', 'Eastern Market', 'Saturdays', '~1.9 mi', 42.3478, -83.0410, 'b*'],
  ['outside', 'Scripps Park', 'Scripps Park', 'Up Trumbull', '~0.25 mi', 42.3446, -83.0690, 't*'],
  ['outside', 'Roosevelt Park', 'Roosevelt Park', 'At Michigan Central', '~1.0 mi', 42.3303, -83.0748, 'l'],
  ['outside', 'Detroit Riverwalk', 'Riverwalk', 'Riverfront promenade', '~1.5–1.9 mi', 42.3245, -83.0560, 'r*'],
  ['game', 'Little Caesars Arena', 'Little Caesars Arena', 'Red Wings, Pistons, concerts', '~1.1 mi', 42.3411, -83.0553, 't*'],
  ['game', 'Theatre District', 'Theatre District', 'Fox Theatre, The Fillmore, Masonic Temple', '~1.2 mi', 42.3384, -83.0525, 'b'],
  ['game', 'Stadium District', 'Stadium District', 'Comerica Park, Ford Field', '~1.25–1.6 mi', 42.3395, -83.0470, 'r*'],
  ['move', 'QLINE streetcar', 'QLINE', 'Woodward Ave, downtown to New Center', '~1.1 mi', 42.3480, -83.0590, 'r'],
  ['move', 'Freeways on three sides', 'I-75 / M-10', 'I-75, M-10 Lodge and I-96 border the neighborhood', '~0.5 mi', 42.3405, -83.0620, 'b'],
  ['move', 'Rosa Parks Transit Center', 'Transit Center', 'DDOT bus hub', '~1.1 mi', 42.3326, -83.0530, 'b'],
  ['move', 'Detroit Metro Airport (DTW)', 'DTW', 'Via I-96 and I-94, without traffic', '~30 min', 42.2162, -83.3554, '']
];
const FAQS = [
  ['Where is Trumbull North?', '3331 Trumbull St, Detroit, MI 48208, in North Corktown, on the block where Trumbull meets Sycamore and Ash.'],
  ['How many homes are for sale?', 'Phase 1 has 12 new construction townhomes for sale, in the two buildings facing Trumbull. The three back buildings are a future release.'],
  ['What is the floor plan?', 'The Type A residence: 3 bedrooms and 2.5 baths (two full baths, one with a double vanity, plus a powder room) across three levels, about 1,535 square feet.'],
  ['Where do I park?', 'Residents park in the private parking court inside the block.'],
  ['What is the NEZ-NC abatement?', 'Trumbull North is NEZ-NC Property Tax Abatement Eligible. The NEZ-NC Property Tax Abatement is available for 15 years on qualifying homes. Todd can walk you through how it applies to you.'],
  ['When can I move in?', 'Permitting was completed in June 2026. Construction is planned for 2026–27, with Phase 1 move-ins planned for 2027–28.'],
  ['How much are the homes?', 'Pricing is in the full package. Submit the Reserve form and it comes straight to you.'],
  ['Are these homes for sale or for rent?', 'For sale only. All 12 Phase 1 homes are new construction townhomes for sale, each with a private rooftop terrace.'],
  ['Are these condos or townhomes?', 'Townhomes. Each Type A home is a three-level townhome with its own front door and private rooftop terrace. Nothing is shared above or below you.'],
  ['Moving to Detroit? How close are the homes to Michigan Central?', 'Michigan Central is about 1.2 miles from Trumbull North, and downtown is about 1.5 miles. For buyers moving to Detroit for work, these are new construction homes for sale near Michigan Central, Newlab and the Central Business District (CBD). Distances are estimates.'],
  ['Is NEZ-NC the same as the NEZ Homestead program?', 'No. NEZ-NC applies to qualifying new construction homes like Trumbull North. The NEZ Homestead program is separate and covers existing homes. Todd can confirm how NEZ-NC applies to your purchase.']
];
const GALLERY = [
  ['g-frontage.webp', 'The Trumbull frontage', 'Rendering of the Trumbull frontage: ivory panel, warm grey brick, charcoal siding and cedar'],
  ['g-porches.webp', 'Front porches', 'Rendering of brick-pier front porches on new North Corktown townhomes for sale'],
  ['g-court-entry.webp', 'Into the private court', 'Rendering of the drive into the private parking court'],
  ['g-garages.webp', 'The private parking court', 'Rendering of the private parking court'],
  ['g-rooftops.webp', 'Rooftop terraces', 'Rendering of private rooftop terraces above the court, Detroit beyond'],
  ['g-rooftop-view.webp', 'The view from your rooftop', 'Rendering of the view across the block from a private rooftop terrace'],
  ['g-aerial.webp', 'The full block from above', 'Aerial rendering of Trumbull North: five buildings around a private court, two fronting Trumbull']
];
// Built-in homesite statuses (the status sheet overrides these): available | reserved | contract | sold
const HOMESITES = { 1: 'available', 2: 'available', 3: 'available', 4: 'available', 5: 'available', 6: 'available', 7: 'available', 8: 'available', 9: 'available', 10: 'available', 11: 'available', 12: 'available' };
const STATUS_LABEL = { available: 'Available', reserved: 'Reserved', contract: 'Under contract', sold: 'Sold' };

// Floor plan, level by level (supplied by Kevin, Oct 22). The ground-floor den is the 2-or-3-bedroom choice.
const PLAN_LEVELS = [
  ['ground', 'Ground level', 'plan-ground.webp', 'Front entry and stair, a den, office or third bedroom facing the street, a utility room, and parking for one car behind an overhead door to the private parking court.'],
  ['main', 'Living level', 'plan-main.webp', 'Open kitchen with a seated island, living and dining on one floor, a powder room by the stair and a balcony.'],
  ['upper', 'Bedroom level', 'plan-upper.webp', 'Three or two bedrooms with walk-in closets, two full baths (one double vanity with shower, one single vanity with tub), and laundry.'],
  ['roof', 'Rooftop', 'plan-rooftop.webp', 'A private deck with room to lounge and dine, planters, and a wet bar sink at the top of the stair.']
];

const PAGES = {
  home: { path: '/', sections: 'hero vision rooftop residences gallery neighborhood nez availability faq', title: 'Trumbull North | New Construction Townhomes for Sale in North Corktown, Detroit', desc: 'New construction townhomes for sale in North Corktown, Detroit, about a mile from Michigan Central. 3 bed, 2.5 bath, private rooftop terrace. NEZ-NC Property Tax Abatement Eligible.' },
  residences: { path: '/residences', sections: 'residences rooftop', eyebrow: 'The Residences', h1: '3 bedroom townhomes in North Corktown, Detroit', title: 'Type A Townhomes | 3 Bedroom New Construction in North Corktown, Detroit | Trumbull North', desc: 'The Type A residence: 3 bed, 2.5 bath, 1,535 sq ft across three levels and a private rooftop terrace. New townhomes in Detroit by 4545 Architecture.' },
  availability: { path: '/availability', sections: 'availability nez', eyebrow: 'Availability', h1: 'North Corktown homes for sale: Phase 1 availability', title: 'North Corktown Homes for Sale | Phase 1 Availability | Trumbull North', desc: '12 North Corktown townhomes for sale in Phase 1 at 3331 Trumbull. Pick your home on the site plan and reserve. NEZ-NC Property Tax Abatement Eligible.' },
  neighborhood: { path: '/neighborhood', sections: 'neighborhood', eyebrow: 'The Neighborhood', h1: 'North Corktown, Detroit: homes near Michigan Central', title: 'Living in North Corktown, Detroit | Homes Near Michigan Central | Trumbull North', desc: 'About a mile to Michigan Central, Corktown and Little Caesars Arena. The Stadium District, Theatre District, CBD and Riverwalk nearby. Distances are estimates.' },
  progress: { path: '/progress', sections: 'availability', eyebrow: 'Progress', h1: 'Construction progress at 3331 Trumbull', title: 'Construction Progress | New Construction in North Corktown | Trumbull North', desc: 'Permitted and engineered. Follow construction of Trumbull North, new construction townhomes for sale in North Corktown, Detroit.' },
  faq: { path: '/faq', sections: 'faq', eyebrow: 'FAQ', h1: 'Questions about Trumbull North', title: 'FAQ | NEZ-NC, Pricing and Buying | Trumbull North', desc: 'Answers on NEZ-NC Property Tax Abatement, pricing, timing and buying a new construction townhome in North Corktown, Detroit.' },
  gallery: { path: '/gallery', sections: 'gallery', eyebrow: 'Gallery', h1: 'Trumbull North gallery', title: 'Gallery | Trumbull North Townhomes, Detroit', desc: 'Trumbull North: the Trumbull frontage, front porches, private parking court and rooftop terraces with the Detroit skyline.' },
  about: { path: '/about', sections: 'vision', eyebrow: 'About', h1: 'About Trumbull North', title: 'About | 3331 Trumbull, North Corktown, Detroit | Trumbull North', desc: "Trumbull North at 3331 Trumbull: five buildings by 4545 Architecture, built by Bondy's Construction, developed by AK Capital." },
  privacy: { path: '/privacy', sections: 'privacy', eyebrow: 'Legal', h1: 'Privacy Policy', title: 'Privacy Policy | Trumbull North', desc: 'Privacy Policy for trumbullnorth.com.' }
};

// ---------------------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const img = n => '/assets/img/' + n;
const pad2 = n => String(n).padStart(2, '0');
const N = SETTINGS.ctaCount;
const cta = `<span data-cta-count>${N}</span>`;

const eyebrow = (num, label, gold) => `<p class="eyebrow${gold ? ' eyebrow--gold' : ''}">${label}</p>`;
const LOGO_MARK = '<svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true"><rect x="0.5" y="0.5" width="33" height="33" fill="none" stroke="#201D19"/><rect x="5" y="22" width="11" height="5" fill="#8A5A3B"/><rect x="18" y="22" width="11" height="5" fill="#8A5A3B"/><rect x="5" y="7" width="4" height="12" fill="#201D19"/><rect x="25" y="7" width="4" height="12" fill="#201D19"/><rect x="12" y="7" width="10" height="4" fill="#201D19"/></svg>';

const S = {};

S.hero = () => {
  const B = SETTINGS.build, n = B.frames, last = String(n).padStart(3, '0');
  const stat = (n, l) => `<div class="hero__stat"><p class="hero__stat-n">${n}</p><p class="hero__stat-l">${l}</p></div>`;
  const stages = B.stages.map(([l, at], i) => `<button type="button" class="build__stage${i === 0 ? ' is-on' : ''}" data-at="${at}">${l}</button>`).join('');
  return `
<header class="hero hero--build" data-screen-label="Hero" data-build data-frames="${n}" data-stages='${JSON.stringify(B.stages.map(s => s[1]))}'>
  <div class="hero__track">
    <div class="hero__sticky">
      <div class="hero__media">
        <img class="hero__still" src="/assets/build/lg/${last}.webp" width="1062" height="596" fetchpriority="high" decoding="async" alt="Aerial rendering of Trumbull North, five buildings around a private court on Trumbull">
        <canvas class="hero__canvas" aria-hidden="true"></canvas>
        <div class="hero__scrim"></div>
      </div>
      <div class="hero__content">
        <p class="hero__kicker">3331 Trumbull · North Corktown, Detroit</p>
        <h1>See the skyline <span class="accent-gold">from your roof deck</span></h1>
        <p class="hero__lede">Three-bedroom new construction townhomes for sale in North Corktown, designed by 4545 Architecture. A private rooftop terrace with every home.</p>
        <div class="hero__ctas">
          <a class="btn btn--gold" href="#reserve">Reserve Your Home</a>
          <a class="btn btn--ghost" href="/availability">View Availability</a>
        </div>
      </div>
      <div class="build" data-build-ui>
        <div class="build__head"><span class="build__hint">Scroll or drag to build Trumbull North</span><span class="build__now" data-build-now>Foundations</span></div>
        <div class="build__stages">${stages}</div>
        <div class="build__bar"><i class="build__fill"></i><input class="build__range" type="range" min="0" max="1000" value="0" aria-label="Construction stage, from foundations to complete"></div>
      </div>
    </div>
  </div>
  <div class="hero__stats">
    <div class="hero__stats-in">
      ${stat(cta, 'Homes for sale')}
      ${stat('3 bed · 2.5 bath', 'Three levels, 1,535 sq ft')}
      ${stat('NEZ-NC', 'Property Tax Abatement Eligible')}
      ${stat('2027–28', 'Phase 1 move-ins, planned')}
    </div>
  </div>
</header>`;
};

S.vision = () => `
<section id="vision" class="section" data-screen-label="01 The Block">
  <div class="two-col vision">
    <div>
      ${eyebrow('01', 'The Block')}
      <h2 class="h2">Secure your spot <span class="accent">on the block</span></h2>
    </div>
    <div class="vision__body">
      <p class="copy">248 feet of frontage where Trumbull meets Sycamore and Ash. Every home parks off the street, in a private parking court inside the block.</p>
      <p class="copy">Michigan Central and Corktown's Michigan Avenue restaurants are each about a mile away. With the design finished and permits in hand, all that's left is choosing which address is yours.</p>
      <a class="text-link" href="/neighborhood">Explore the neighborhood →</a>
      <div class="vision__stats">
        <div><p class="stat__n">248 ft</p><p class="stat__l">Street frontage</p></div>
        <div><p class="stat__n">Off-street</p><p class="stat__l">Private parking</p></div>
        <div><p class="stat__n">${cta}</p><p class="stat__l">For sale now</p></div>
      </div>
    </div>
  </div>
  <figure class="wide-fig">
    <img loading="lazy" decoding="async" src="${img('g-corner.webp')}" width="2054" height="766" alt="Rendering of the Trumbull North corner on Trumbull, with ground-floor glazing and tree-lined sidewalks">
    <figcaption class="cap">The corner on Trumbull</figcaption>
  </figure>
</section>`;

S.rooftop = () => `
<section class="rooftop" data-screen-label="Rooftop statement">
  <div class="rooftop__media">
    <img loading="lazy" decoding="async" src="${img('rooftop.webp')}" alt="Rendering of Detroit townhomes with private rooftop terraces and the skyline beyond">
  </div>
  <blockquote class="rooftop__quote">
    <p class="rooftop__line">Sunset dinners. Morning coffee. Fireworks over the city. All from a rooftop that belongs to no one but you.</p>
    <p class="rooftop__sub">From up here, the city is yours.</p>
    <div class="rooftop__stats">
      <div><p class="rooftop__n">~1.2 mi</p><p class="rooftop__l">Michigan Central</p></div>
      <div><p class="rooftop__n">~1.1 mi</p><p class="rooftop__l">Little Caesars Arena</p></div>
      <div><p class="rooftop__n">~1.5 mi</p><p class="rooftop__l">Central Business District</p></div>
    </div>
    <p class="rooftop__note">Straight-line distances from 3331 Trumbull.</p>
  </blockquote>
</section>`;

S.residences = () => {
  const tabs = PLAN_LEVELS.map(([k, label], i) => `<button class="pill" role="tab" id="plan-tab-${k}" aria-controls="plan-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-plan-tab="${k}">${label}</button>`).join('\n          ');
  const panels = PLAN_LEVELS.map(([k, label, file], i) => `<div class="plans__panel" role="tabpanel" id="plan-${k}" aria-labelledby="plan-tab-${k}"${i ? ' hidden' : ''}><img loading="lazy" decoding="async" src="${img(file)}" alt="Floor plan, ${label.toLowerCase()}"></div>`).join('\n          ');
  const levels = PLAN_LEVELS.map(([, label, , text]) => `<div class="level"><strong>${label}</strong><span>${text}</span></div>`).join('\n        ');
  return `
<section id="residences" class="band band--sand" data-screen-label="02 The Residences">
  <div class="wrap">
    <div class="res-grid">
      <div class="res-photo">
        <img src="${img('bedroom.webp')}" width="1360" height="768" alt="Bedroom with an upholstered bed, oak nightstands, a pendant light and a tall window" loading="lazy" decoding="async">
      </div>
      <div class="res-card">
        <div class="res-card__top">
          <p class="res-card__type">Type A</p>
          <span class="chip">Phase 1 · For sale now</span>
        </div>
        <h3>3 Bed · 2.5 Bath</h3>
        <p class="res-card__sub">1,535 square feet across three levels</p>
        <ul class="dash-list">
          <li>Rooftop terrace facing the skyline</li>
          <li>Full-width living floor with island kitchen</li>
          <li>Two full baths (one double vanity) plus a powder room</li>
          <li>Front porch on a real street, not a corridor</li>
          <li>NEZ-NC Property Tax Abatement Eligible</li>
        </ul>
        <div class="res-card__ctas">
          <a class="btn btn--dark btn--block" href="#reserve" data-interest="Pricing">Request pricing</a>
          <a class="res-card__pkg" href="#reserve" data-interest="Full package">Request the full package →</a>
        </div>
      </div>
    </div>

    <div class="plans" id="floor-plans">
      <div>
        <div class="plans__tabs" role="tablist" aria-label="Floor plan levels">
          ${tabs}
        </div>
        <div class="plans__frame">
          ${panels}
        </div>
        <figure class="plans__photo">
          <img loading="lazy" decoding="async" src="${img('kitchen.webp')}" width="1248" height="832" alt="Kitchen with a white stone island, four counter stools, oak cabinetry and brass fixtures">
          <figcaption class="cap">Kitchen</figcaption>
        </figure>
      </div>
      <div class="plans__info">
        ${eyebrow('', 'Floor plan')}
        <h3 class="h3">2 or 3 bedrooms. <span class="accent">Level by level.</span></h3>
        <p class="copy">The ground-floor den works as an office or a third bedroom. Finishes and dimensions come in the full package.</p>
        <div class="levels">
        ${levels}
        </div>
        <a class="btn btn--dark" href="#reserve" data-interest="Floor plans">Ask about floor plans</a>
        <figure class="plans__bath">
          <img loading="lazy" decoding="async" src="${img('bath.webp')}" alt="Rendering of a bath with a walk-in glass shower and wood vanity">
          <figcaption class="cap">Bath</figcaption>
        </figure>
      </div>
    </div>

    <p class="res-note">One ground-floor commercial space anchors the block on Trumbull. <a href="#reserve" data-interest="Commercial space">Inquire</a>.</p>
  </div>
</section>`;
};

S.gallery = () => `
<section id="gallery" class="gallery" data-screen-label="03 Gallery">
  <div class="section-head gallery__head">
    <div>
      ${eyebrow('03', 'Gallery', true)}
      <h2 class="h2">Walk the block <span class="accent-gold">before you buy.</span></h2>
    </div>
    <div class="gallery__hint">
      <button class="gallery__arrow" type="button" data-strip="-1" aria-label="Previous image">←</button>
      <button class="gallery__arrow" type="button" data-strip="1" aria-label="Next image">→</button>
    </div>
  </div>
  <div class="strip" data-strip-track tabindex="0" aria-label="Gallery, scroll sideways">
    ${GALLERY.map(([f, cap, alt], i) => `<figure>
      <img src="${img(f)}" alt="${esc(alt)}" loading="lazy" decoding="async">
      <figcaption><span>${cap}</span><span>${pad2(i + 1)} / ${pad2(GALLERY.length)}</span></figcaption>
    </figure>`).join('\n    ')}
  </div>
</section>`;

// Straight-line proximity map: the site at the center, rings every half mile, every place pinned.
function proximityMap() {
  const W = 600, R = 2.35, k = (W / 2) / R;                      // px per mile
  const xy = (lat, lng) => [W / 2 + (lng - SITE[1]) * 51.1 * k, W / 2 - (lat - SITE[0]) * 69.0 * k];
  const rings = [0.5, 1, 1.5, 2].map(m => `<circle cx="${W / 2}" cy="${W / 2}" r="${(m * k).toFixed(1)}" class="pm-ring"/><text x="${W / 2}" y="${(W / 2 + m * k - 7).toFixed(1)}" text-anchor="middle" class="pm-ring-l">${m === 0.5 ? '½' : m === 1.5 ? '1½' : m} mi</text>`).join('');
  const pins = POIS.map(([c, name, short, , dist, lat, lng, side]) => {
    const [x, y] = xy(lat, lng);
    if (x < 8 || y < 8 || x > W - 8 || y > W - 8) return '';      // off the map (the airport)
    const d = side[0] || 'r';
    const [lx, ly, anchor] = { r: [11, 5, 'start'], l: [-11, 5, 'end'], t: [0, -13, 'middle'], b: [0, 24, 'middle'] }[d];
    return `<g class="pm-pin${side.endsWith('*') ? ' pm-pin--label' : ''}" data-place="${esc(name)}" data-cat="${c}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="7" fill="${CAT[c][1]}"/><text x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(short)}</text></g>`;
  }).join('');
  return `<div class="pm" role="img" aria-label="Map of places within about two miles of Trumbull North, with rings every half mile">
        <svg viewBox="0 0 ${W} ${W}" aria-hidden="true">
          <rect width="${W}" height="${W}" class="pm-bg"/>${rings}
          <g class="pm-north" transform="translate(${W - 34} 40)"><path d="M0 -18 L7 6 L0 1 L-7 6 Z"/><text y="24" text-anchor="middle">N</text></g>
          ${pins}
          <g class="pm-site" transform="translate(${W / 2} ${W / 2})"><rect x="-9" y="-9" width="18" height="18"/><text x="-15" y="6" text-anchor="end">Trumbull North</text></g>
        </svg>
      </div>`;
}

S.neighborhood = () => {
  const quad = [
    ['Michigan Central', "Ford's restored station and the Newlab campus around it, about 1.2 miles from your door."],
    ['Michigan Avenue', "Corktown's restaurants and bars, about a mile south: Slows Bar BQ, Takoi, Ottava Via, The Sugar House, Two James."],
    ['Downtown districts', 'The Stadium District, the Theatre District, the Central Business District (CBD) and the Riverwalk. Little Caesars Arena is about a mile away.'],
    ['Outside', 'Scripps Park about a quarter mile up Trumbull. Roosevelt Park at Michigan Central. The Southwest Greenway to the riverfront.']
  ];
  const cats = [['all', 'All'], ...Object.entries(CAT).map(([k, v]) => [k, v[0]])];
  return `
<section id="neighborhood" class="section" data-screen-label="04 The Neighborhood">
  <div class="scores">
    <div><p class="stat__n">73</p><p class="stat__l">Walk Score</p></div>
    <div><p class="stat__n">95</p><p class="stat__l">Bike Score</p></div>
    <div><p class="stat__n">58</p><p class="stat__l">Transit Score</p></div>
  </div>
  <div class="quad">
    ${quad.map(([h, p], i) => `<div><p class="quad__n">${pad2(i + 1)}</p><h3>${h}</h3><p>${p}</p></div>`).join('\n    ')}
  </div>
  <div class="map-grid">
    <div class="map-card">
      ${proximityMap()}
      <div class="map-card__bar">
        <span>Showing: <strong data-map-label>Everything within about 2 miles</strong></span>
        <a class="link-btn" data-map-link href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(ADDRESS)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
      </div>
    </div>
    <div class="nearby">
      <h3>What's nearby</h3>
      <div class="nearby__filters" role="group" aria-label="Filter places">
        ${cats.map(([k, l], i) => `<button class="pill" type="button" aria-pressed="${i === 0}" data-cat="${k}">${l}</button>`).join('\n        ')}
      </div>
      <ul class="poi-list">
        ${POIS.map(([c, name, , what, dist]) => `<li data-cat="${c}"><button class="poi" type="button" aria-pressed="false" data-place="${esc(name)}"><span class="poi__dot" style="background:${CAT[c][1]}"></span><span class="poi__main"><span class="poi__name">${esc(name)}</span><span class="poi__what">${esc(what)}</span></span><span class="poi__dist"><span>${dist}</span><span>Straight-line</span></span></button></li>`).join('\n        ')}
      </ul>
      <p class="small-note">Straight-line distances from 3331 Trumbull. Driving and walking routes are longer.</p>
    </div>
  </div>
</section>`;
};

S.nez = () => `
<section class="nez" data-screen-label="NEZ callout">
  <div class="nez__in">
    <div>
      <p class="nez__kicker">NEZ-NC Property Tax Abatement Eligible</p>
      <h2>NEZ-NC Property Tax Abatement <span class="accent-gold">Available for 15 years</span></h2>
      <p class="nez__copy">Trumbull North sits in a Detroit Neighborhood Enterprise Zone. Qualifying new construction homes here pay a reduced property tax rate for 15 years. Ask Todd what that means for your monthly payment.</p>
    </div>
    <div class="nez__side">
      <p class="nez__big">15 <span>years</span></p>
      <a class="btn btn--gold" href="#reserve" data-interest="NEZ savings">Ask About NEZ Savings</a>
    </div>
  </div>
</section>`;

S.faq = () => `
<section id="faq" class="faq" data-screen-label="06 FAQ">
  <div class="two-col faq__in">
    <div>
      ${eyebrow('06', 'FAQ')}
      <h2 class="h2">Questions buyers <span class="accent">ask first.</span></h2>
      <p class="faq__lede">Anything else goes straight to Todd.</p>
      <div class="faq__contact"><a href="${TEL}">${PHONE}</a><a href="mailto:${EMAIL}">${EMAIL}</a></div>
    </div>
    <div class="faq__list">
      ${FAQS.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>`;

// Availability on the real 4545 site plan (SP1.1). Positions are percentages of the drawing:
// the two 6-unit buildings on Trumbull span x 11.73-47.93% and 54.46-90.66%, y 33.96-52.97%.
const PLAN_BUILDINGS = [['A', 11.73], ['B', 54.46]], BLD_W = 36.2, BLD_Y = 33.96, BLD_H = 19.0;
const FUTURE = [[11.6, 61.8, 10.9, 38.2], [35.6, 80.9, 30.8, 19.1], [79.3, 61.8, 11.2, 38.2]];   // x, y, w, h of the back three buildings

S.availability = () => {
  const units = [];
  for (let i = 0; i < 12; i++) {
    const [b, x0] = PLAN_BUILDINGS[i < 6 ? 0 : 1], num = i + 1, st = HOMESITES[num], w = BLD_W / 6;
    units.push(`<button class="sp-unit" type="button" style="left:${(x0 + (i % 6) * w).toFixed(2)}%;top:${BLD_Y}%;width:${w.toFixed(2)}%;height:${BLD_H}%" data-unit="${pad2(num)}" data-building="${b}" data-status="${st}" aria-pressed="false" aria-label="Home ${num}, ${STATUS_LABEL[st]}">${pad2(num)}</button>`);
  }
  const future = FUTURE.map(([x, y, w, h]) => `<div class="bp-future" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"><span>Future release</span></div>`).join('');
  const avail = Object.values(HOMESITES).filter(v => v === 'available').length;
  const legend = [['available', 'Available'], ['reserved', 'Reserved'], ['contract', 'Under contract'], ['sold', 'Sold']];
  return `
<section id="availability" class="band band--sand" data-screen-label="Availability">
  <div class="wrap">
    <div class="section-head avail-head">
      <div>
        ${eyebrow('', 'Permitted · 4545 Architecture')}
        <h2 class="h2">Select your <span class="accent">home</span></h2>
      </div>
      <p class="avail-head__note">The 12 Phase 1 homes face Trumbull. Tap one on the plan.</p>
    </div>
    <div class="avail-grid">
      <div>
        <div class="bp">
          <div class="bp__inner" data-siteplan>
            <img src="${img('site-plan.webp')}" width="1884" height="1178" loading="lazy" decoding="async" alt="Architectural site plan SP1.1 by 4545 Architecture with the 12 Phase 1 homes highlighted on the two buildings facing Trumbull">
            ${future}
            ${units.join('\n            ')}
          </div>
        </div>
        <div class="bp-foot">
          <div class="legend">${legend.map(([k, l]) => `<span><i class="lg-${k}"></i>${l}</span>`).join('')}<span><i class="lg-future"></i>Future release</span></div>
          <p class="cap">SP1.1 · Architectural site plan · 4545 Architecture</p>
        </div>
      </div>
      <aside class="pick" aria-label="Choose a home">
        <div class="pick__head">
          <p class="pick__kicker">Phase 1 · <span data-avail-count>${avail}</span> of 12 available</p>
          <div class="pick__now">
            <h3 data-unit-title>Choose your home</h3>
            <span class="pick__status" data-unit-status hidden></span>
          </div>
          <p class="pick__where" data-unit-kicker>Tap the plan or a number below.</p>
        </div>
        <div class="pick__grid">
          ${['A', 'B'].map((b, k) => `<div class="pick__row"><span class="pick__bld">Bldg ${b}</span><div class="pick__btns">${Array.from({ length: 6 }, (_, i) => { const num = k * 6 + i + 1, st = HOMESITES[num]; return `<button class="sp-unit pick__btn" type="button" data-unit="${pad2(num)}" data-building="${b}" data-status="${st}" aria-pressed="false" aria-label="Home ${num}, ${STATUS_LABEL[st]}">${pad2(num)}</button>`; }).join('')}</div></div>`).join('\n          ')}
        </div>
        <dl class="pick__specs">
          <div><dt>Home</dt><dd>3 bed · 2.5 bath</dd></div>
          <div><dt>Size</dt><dd>1,535 sq ft</dd></div>
          <div><dt>Outdoor</dt><dd>Private rooftop terrace</dd></div>
          <div><dt>Parking</dt><dd>Private parking court</dd></div>
          <div><dt>Taxes</dt><dd>NEZ-NC Abatement Eligible</dd></div>
        </dl>
        <ol class="pick__steps">
          <li class="is-done"><i></i><span>Jun 2026</span>Permitted</li>
          <li class="is-now"><i></i><span>Now</span>Reserving</li>
          <li><i></i><span>2027–28</span>Move-ins</li>
        </ol>
        <div class="pick__cta">
          <a class="btn btn--gold btn--block" href="#reserve" data-reserve-unit>Reserve Your Home</a>
          <a class="pick__price" href="#reserve" data-interest="Pricing">Request pricing →</a>
        </div>
      </aside>
    </div>
  </div>
</section>`;
};

S.privacy = () => `
<section id="privacy" class="privacy" data-screen-label="Privacy">
  <p class="privacy__kicker">Pending legal review</p>
  <p class="copy">The Privacy Policy text is being finalized and will appear here before launch. Questions about your information: <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
</section>`;

const reserve = () => `
<section id="reserve" class="reserve" data-screen-label="Reserve">
  <img loading="lazy" decoding="async" src="${img('court-low.webp')}" alt="">
  <div class="reserve__shade"></div>
  <div class="reserve__in">
    <p class="reserve__kicker">Phase 1 · ${cta} homes for sale</p>
    <h2>Reserve Your Home. <span class="accent-gold">Only ${cta} left.</span></h2>
    <p class="reserve__lede">Name, email, phone. That's it. The full package (floor plans, finishes, pricing, availability) comes straight to you, and Todd follows up personally.</p>
    <form data-reserve-form novalidate>
      <p class="reserve__msg" role="alert" data-form-error hidden>Something went wrong. Please call Todd at ${PHONE}.</p>
      <p class="reserve__msg" data-form-note hidden></p>
      <input type="hidden" name="interest" value="Reserve">
      <div class="reserve__fields">
        <input required name="name" autocomplete="name" placeholder="Full name" aria-label="Full name">
        <input required type="email" name="email" autocomplete="email" placeholder="Email" aria-label="Email">
        <input required type="tel" name="phone" autocomplete="tel" placeholder="Phone" aria-label="Phone">
        <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
      </div>
      <button class="btn btn--gold" type="submit">Reserve Your Home</button>
      <p class="reserve__legal">By submitting, you agree to be contacted about Trumbull North. See our <a href="/privacy">Privacy Policy</a>.</p>
    </form>
    <div class="reserve__contact">
      <span>Todd · <a href="mailto:${EMAIL}">${EMAIL}</a></span>
      <a href="${TEL}">${PHONE}</a>
      <span>${ADDRESS}</span>
    </div>
  </div>
</section>`;

const NAV_LINKS = [['residences', 'Residences'], ['availability', 'Availability'], ['neighborhood', 'Neighborhood'], ['progress', 'Progress']];
const nav = key => `
<nav class="nav" aria-label="Main">
  <div class="nav__in">
    <a class="logo" href="/" aria-label="Trumbull North home">${LOGO_MARK}<span class="logo__text"><span class="logo__name">TRUMBULL NORTH</span><span class="logo__sub">NORTH CORKTOWN · DETROIT</span></span></a>
    <div class="nav__links">
      ${NAV_LINKS.map(([k, l]) => `<a href="/${k}"${k === key ? ' aria-current="page"' : ''}>${l}</a>`).join('\n      ')}
      <a class="nav__cta" href="#reserve">Reserve Your Home</a>
    </div>
    <div class="nav__compact">
      <a class="nav__compact-cta" href="#reserve">Reserve</a>
      <a class="nav__phone" href="${TEL}">${PHONE}</a>
    </div>
  </div>
</nav>`;

const footer = () => `
<footer class="footer">
  <div class="footer__in">
    <div class="footer__top">
      <div class="footer__addr">
        <span class="footer__name">TRUMBULL NORTH</span>
        <span>${ADDRESS}</span>
        <span>One ground-floor commercial space on Trumbull. <a href="#reserve" data-interest="Commercial space">Inquire.</a></span>
      </div>
      <nav class="footer__nav" aria-label="Footer">
        <a href="/residences">Residences</a><a href="/availability">Availability</a>
        <a href="/neighborhood">Neighborhood</a><a href="/progress">Progress</a>
        <a href="/gallery">Gallery</a><a href="/about">About</a>
        <a href="/faq">FAQ</a><a href="/privacy">Privacy Policy</a>
      </nav>
    </div>
    <div class="footer__partners"><span>Bondy's Construction &amp; Design</span><span>AK Capital</span><span>4545 Architecture</span></div>
    ${SETTINGS.socials.length ? `<div class="footer__social">${SETTINGS.socials.map(([l, u]) => `<a href="${esc(u)}" rel="noopener">AK Capital on ${esc(l)}</a>`).join('')}</div>` : ''}
    <div class="footer__legal">
      <p>Pricing, availability and specifications are subject to change without notice. Straight-line distances from 3331 Trumbull. Driving and walking routes are longer.</p>
      <p class="footer__eho"><svg width="22" height="22" viewBox="0 0 24 24" role="img" aria-label="Equal Housing Opportunity logo"><path d="M12 2 1.5 10.5h2.6V22h15.8V10.5h2.6Z" fill="none" stroke="#B5A998" stroke-width="1.6"/><rect x="7.5" y="12" width="9" height="2" fill="#B5A998"/><rect x="7.5" y="16" width="9" height="2" fill="#B5A998"/></svg>Equal Housing Opportunity · © 2026 Trumbull North</p>
    </div>
  </div>
</footer>`;

const chrome = () => `
<a class="sticky-cta" href="#reserve" data-sticky-cta>Reserve Your Home · Only ${cta} left</a>
<div class="consent" role="dialog" aria-label="Cookie notice" data-consent hidden>
  <p>We use cookies for analytics and advertising, only with your consent. See our <a href="/privacy">Privacy Policy</a>.</p>
  <div class="consent__btns"><button class="consent__no" type="button" data-consent-choice="denied">Decline</button><button class="consent__yes" type="button" data-consent-choice="granted">Accept</button></div>
</div>
${SETTINGS.showDraftNotice ? '<div class="draft-note" aria-hidden="true">Draft renderings · pending construction partner + CEO review</div>' : ''}`;

// ---------------------------------------------------------------------------
const FAVICON = '/assets/favicon.svg';
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,300..700&amp;display=swap" rel="stylesheet">`;

const jsonld = (key, sections) => {
  const addr = { '@type': 'PostalAddress', streetAddress: '3331 Trumbull St', addressLocality: 'Detroit', addressRegion: 'MI', postalCode: '48208', addressCountry: 'US' };
  const graph = [
    { '@type': 'Organization', '@id': ORIGIN + '/#org', name: 'Trumbull North', url: ORIGIN + '/', telephone: '+1-313-320-8780', email: EMAIL, address: addr },
    { '@type': 'Residence', '@id': ORIGIN + '/#residence', name: 'Trumbull North Type A Townhome', description: 'New construction North Corktown townhome for sale near Corktown, Detroit. 3 bedroom townhome with 2.5 baths, 1,535 sq ft across three levels and a private rooftop terrace.', address: addr, geo: { '@type': 'GeoCoordinates', latitude: 42.3418, longitude: -83.0712 }, numberOfRooms: 3, numberOfBedrooms: 3, numberOfBathroomsTotal: 3, numberOfFullBathrooms: 2, numberOfPartialBathrooms: 1, floorSize: { '@type': 'QuantitativeValue', value: 1535, unitCode: 'FTK' }, containedInPlace: { '@type': 'Place', name: 'North Corktown, Detroit' } }
  ];
  if (sections.includes('faq')) graph.push({ '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
};

// Satellite map (Leaflet, self-hosted) gets the site and places as data; the SVG map stays as the fallback.
const mapAssets = () => `<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
<script>window.TN_MAP = ${JSON.stringify({ site: SITE, pois: POIS.filter(p => p[0] !== 'move' || p[1] !== 'Detroit Metro Airport (DTW)').map(([c, name, short, , , lat, lng, side]) => ({ c, name, short, lat, lng, side, color: CAT[c][1] })) })};</script>`;

const clientSettings = () => `<script>window.TN = ${JSON.stringify({ ctaCount: N, ga4Id: SETTINGS.ga4Id, metaPixelId: SETTINGS.metaPixelId, statusSheetUrl: SETTINGS.statusSheetUrl, formEndpoint: SETTINGS.formEndpoint, thankYouUrl: SETTINGS.thankYouUrl })};</script>`;

const head = ({ title, desc, url, robots = 'index, follow', extra = '' }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#FAF8F4">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Trumbull North">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/assets/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ORIGIN}/assets/img/og.jpg">
${FONTS}
<link rel="stylesheet" href="/css/site.css">
${extra}
</head>`;

function page(key) {
  const pg = PAGES[key];
  const sections = pg.sections.split(' ');
  const url = ORIGIN + pg.path;
  const pageHead = key === 'home' ? '' : `
<header class="page-head" data-screen-label="Page header">
  <div class="page-head__in">
    <p class="eyebrow">${pg.eyebrow}</p>
    <h1>${pg.h1}</h1>
  </div>
</header>`;
  const mapExtra = sections.includes('neighborhood') ? '\n' + mapAssets() : '';
  return `${head({ title: pg.title, desc: pg.desc, url, extra: jsonld(key, sections) + '\n' + clientSettings() + mapExtra })}
<body data-page="${key}">
${nav(key)}
<main>${pageHead}
${sections.map(s => S[s]()).join('\n')}
${reserve()}
</main>
${footer()}
${chrome()}
${sections.includes('neighborhood') ? '<script src="/vendor/leaflet/leaflet.js" defer></script>\n' : ''}<script src="/js/site.js" defer></script>
</body>
</html>
`;
}

const solo = ({ title, desc, url, robots, h1, accent, body, extra = '' }) => `${head({ title, desc, url, robots })}
<body>
<main class="solo">
  <img src="${img('court-low.webp')}" alt="">
  <div class="reserve__shade"></div>
  <div class="solo__in">
    <a class="solo__brand" href="/">TRUMBULL NORTH</a>
    <h1>${h1} <span>${accent}</span></h1>
    <p>${body}</p>
    ${extra}
  </div>
</main>
</body>
</html>
`;

function write(rel, html) {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html);
  console.log('wrote', rel);
}

for (const key of Object.keys(PAGES)) write(key === 'home' ? 'index.html' : key + '.html', page(key));

write('thank-you.html', solo({
  title: 'Thank you | Trumbull North', desc: 'Thank you for your interest in Trumbull North.', url: ORIGIN + '/thank-you', robots: 'noindex, nofollow',
  h1: 'Thank you.', accent: "It's on its way.",
  body: 'The full package (floor plans, finishes, pricing, availability) is coming to your inbox, and Todd will follow up personally.',
  extra: `<div class="solo__links"><a href="${TEL}">${PHONE}</a><a href="mailto:${EMAIL}">${EMAIL}</a></div>
    <a class="btn btn--ghost" href="/neighborhood">Explore the neighborhood</a>`
}));

write('404.html', solo({
  title: 'Page not found | Trumbull North', desc: 'Page not found.', url: ORIGIN + '/404', robots: 'noindex, nofollow',
  h1: 'Page not found.', accent: 'The homes are still here.',
  body: '12 new construction townhomes for sale in North Corktown, Detroit.',
  extra: '<a class="btn btn--ghost" href="/">Back to Trumbull North</a>'
}));

const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.values(PAGES).map(p => `  <url><loc>${ORIGIN}${p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Disallow: /thank-you
Disallow: /scripts/
Disallow: /portal/

Sitemap: ${ORIGIN}/sitemap.xml
`);
