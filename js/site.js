// Trumbull North, public site behavior. Settings come from window.TN (set by scripts/build-site.mjs).
(function () {
  'use strict';
  var TN = window.TN || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STATUS_LABEL = { available: 'Available', reserved: 'Reserved', contract: 'Under contract', sold: 'Sold' };

  function track(name, params) {
    if (window.gtag) window.gtag('event', name, params || {});
  }

  // Hero film: play muted inline, fade in over the facade image once frames arrive.
  var hero = $('[data-hero-video]');
  if (hero) {
    hero.muted = true;
    hero.addEventListener('playing', function () {
      hero.classList.add('is-playing');
    });
    if (!reduceMotion) {
      hero.preload = 'auto';
      var p = hero.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  // Mobile sticky bar: only after scrolling past the hero (or one screen on pages without one).
  var sticky = $('[data-sticky-cta]');
  if (sticky) {
    var heroEl = $('.hero');
    var onScroll = function () {
      var past = heroEl ? heroEl.getBoundingClientRect().bottom < 0 : window.scrollY > window.innerHeight;
      var reserve = $('#reserve');
      var atForm = reserve && reserve.getBoundingClientRect().top < window.innerHeight;
      sticky.classList.toggle('is-on', past && !atForm);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Reserve form: interest context, FormSubmit, thank-you redirect.
  var form = $('[data-reserve-form]');
  var note = $('[data-form-note]');
  function setInterest(interest, text) {
    if (!form) return;
    form.elements.namedItem('interest').value = interest || 'Reserve';
    if (note) { note.textContent = text || ''; note.hidden = !text; }
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-interest]');
    if (!el) return;
    var i = el.getAttribute('data-interest');
    setInterest(i, i === 'Pricing' ? 'Requesting pricing' : 'Requesting: ' + i.toLowerCase());
  });
  if (form) {
    var started = false;
    form.addEventListener('input', function () { if (!started) { started = true; track('form_start', { form: 'reserve' }); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = function (n) { return form.elements.namedItem(n); };
      if (f('company').value) return; // honeypot: drop silently
      if (!form.reportValidity()) return;
      var err = $('[data-form-error]'); err.hidden = true;
      var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      var data = { name: f('name').value.trim(), email: f('email').value.trim(), phone: f('phone').value.trim(), interest: f('interest').value };
      var payload = Object.assign({}, data, {
        page: document.body.dataset.page || '',
        _subject: 'Trumbull North: ' + data.interest + ' request from ' + (data.name || 'website'),
        _template: 'table', _captcha: 'false',
        _autoresponse: 'Thank you for your interest in Trumbull North, 3331 Trumbull St, North Corktown. Todd will follow up personally with the full package: floor plans, finishes, pricing and availability. Questions in the meantime: 313-320-8780.'
      });
      fetch(TN.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
        .then(function (j) {
          if (j && (j.success === false || j.success === 'false')) throw new Error('rejected');
          track('generate_lead', { form: 'reserve', interest: data.interest });
          if (window.fbq) window.fbq('track', 'Lead');
          setTimeout(function () { window.location.href = TN.thankYouUrl || '/thank-you'; }, 250);
        })
        .catch(function () { err.hidden = false; btn.disabled = false; });
    });
  }

  // Follow the build (no list provider yet: tracked as an event only).
  var follow = $('[data-follow]');
  if (follow) follow.addEventListener('submit', function (e) {
    e.preventDefault();
    track('build_updates_signup');
    $('[data-follow-row]').hidden = true;
    $('[data-follow-done]').hidden = false;
  });

  // Floor plan tabs.
  var tabs = $$('[data-plan-tab]');
  function pickTab(t) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pickTab(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length]; pickTab(n); n.focus();
    });
  });

  // Gallery arrows.
  var track_ = $('[data-strip-track]');
  $$('[data-strip]').forEach(function (b) {
    b.addEventListener('click', function () {
      var fig = track_.querySelector('figure');
      var step = fig ? fig.getBoundingClientRect().width + 26 : track_.clientWidth;
      track_.scrollBy({ left: step * Number(b.getAttribute('data-strip')), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // Neighborhood: satellite proximity map (Leaflet + Esri imagery) with the SVG map as fallback,
  // category filters and the "What's nearby" list.
  var pm = $('.pm');
  if (pm) {
    var label = $('[data-map-label]'), gmap = $('[data-map-link]');
    var ALL = 'Everything within about 2 miles', HOME_Q = '3331 Trumbull St, Detroit, MI 48208';
    var api = svgMap(pm);
    if (window.L && window.TN_MAP) {
      try { api = satMap(pm, window.TN_MAP); }
      catch (e) { pm.classList.remove('is-sat'); var sat = $('.pm-sat', pm); if (sat) sat.remove(); }
    }
    var pick = function (place) {
      api.pick(place);
      $$('.poi').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-place') === place); });
      label.textContent = place || ALL;
      gmap.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place ? place + ', Detroit, MI' : HOME_Q);
    };
    api.onPin = function (p) {
      var on = label.textContent === p;
      pick(on ? null : p);
      var btn = $$('.poi').filter(function (b) { return b.getAttribute('data-place') === p; })[0];
      if (btn && !btn.closest('li').hidden) btn.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    $$('.poi').forEach(function (b) {
      b.addEventListener('click', function () { pick(b.getAttribute('aria-pressed') === 'true' ? null : b.getAttribute('data-place')); });
    });
    $$('.nearby__filters [data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = b.getAttribute('data-cat');
        $$('.nearby__filters [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        $$('.poi-list li').forEach(function (li) { li.hidden = cat !== 'all' && li.getAttribute('data-cat') !== cat; });
        api.filter(cat);
        pick(null);
      });
    });
  }

  function svgMap(root) {
    var pins = $$('.pm-pin', root), api = {};
    pins.forEach(function (g) { g.addEventListener('click', function () { api.onPin && api.onPin(g.getAttribute('data-place')); }); });
    api.pick = function (place) {
      root.classList.toggle('is-picked', !!place);
      pins.forEach(function (g) { g.classList.toggle('is-on', g.getAttribute('data-place') === place); });
    };
    api.filter = function (cat) {
      root.classList.toggle('is-filtered', cat !== 'all');
      pins.forEach(function (g) { g.classList.toggle('is-dim', cat !== 'all' && g.getAttribute('data-cat') !== cat); });
    };
    return api;
  }

  function satMap(root, data) {
    var L = window.L, api = {}, cat = 'all', picked = null;
    var el = document.createElement('div'); el.className = 'pm-sat';
    root.appendChild(el); root.classList.add('is-sat');
    var site = data.site, MILE = 1609.34;
    var map = L.map(el, { scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false, zoomSnap: 0.25, attributionControl: true });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
    }).addTo(map);
    var dLat = (2.15 * MILE) / 111320, dLng = dLat / Math.cos(site[0] * Math.PI / 180);
    map.fitBounds([[site[0] - dLat, site[1] - dLng], [site[0] + dLat, site[1] + dLng]], { padding: [6, 6] });
    [0.5, 1, 1.5, 2].forEach(function (m) {
      L.circle(site, { radius: m * MILE, color: '#FAF8F4', weight: 1.25, opacity: 0.8, dashArray: '4 7', fill: false, interactive: false }).addTo(map);
      var south = L.latLng(site[0] - (m * MILE) / 111320, site[1]);
      L.marker(south, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'pm-ring-tip', html: (m === 0.5 ? '½' : m === 1.5 ? '1½' : m) + ' mi', iconSize: null, iconAnchor: [0, 18] }) }).addTo(map);
    });
    L.marker(site, { keyboard: false, icon: L.divIcon({ className: 'pm-site-tip', html: '<i></i><span>Trumbull North</span>', iconSize: null, iconAnchor: [9, 9] }) }).addTo(map);
    var DIR = { r: 'right', l: 'left', t: 'top', b: 'bottom' };
    // Small screens: label only the anchors by default; the rest appear when filtered or picked.
    var small = el.clientWidth < 480, KEY = ['Michigan Central', 'Little Caesars Arena', 'Rocket at Campus Martius', 'Detroit Riverwalk', 'Eastern Market', 'Henry Ford Hospital'];
    var pins = data.pois.map(function (p) {
      var side = p.side || 'r', d = DIR[side[0]] || 'right';
      var mk = L.circleMarker([p.lat, p.lng], { radius: 7, color: '#FAF8F4', weight: 2.5, fillColor: p.color, fillOpacity: 1 }).addTo(map);
      mk.bindTooltip(p.short, { permanent: true, direction: d, offset: d === 'right' ? [8, 0] : d === 'left' ? [-8, 0] : d === 'top' ? [0, -8] : [0, 8], className: 'pm-tip', interactive: false });
      mk.on('click', function () { api.onPin && api.onPin(p.name); });
      return { p: p, mk: mk, def: /\*$/.test(side) && (!small || KEY.indexOf(p.name) > -1) };
    });
    function render() {
      pins.forEach(function (x) {
        var dim = cat !== 'all' && x.p.c !== cat, on = picked === x.p.name;
        var show = on || (!dim && (cat !== 'all' || (x.def && !picked)));
        x.mk.setStyle({ opacity: dim ? 0.3 : 1, fillOpacity: dim ? 0.3 : 1, radius: on ? 10 : 7, color: on ? '#201D19' : '#FAF8F4' });
        if (show) x.mk.openTooltip(); else x.mk.closeTooltip();
        if (on) x.mk.bringToFront();
      });
    }
    api.pick = function (place) { picked = place; render(); };
    api.filter = function (c) { cat = c; render(); };
    render();
    return api;
  }

  // Availability: homesite selection.
  var units = $$('.sp-unit');
  var selected = null;
  function countAvailable() {
    var el = $('[data-avail-count]');
    if (el) el.textContent = units.filter(function (u) { return u.dataset.status === 'available'; }).length;
  }
  units.forEach(function (u) {
    u.addEventListener('click', function () {
      selected = u;
      units.forEach(function (x) { x.setAttribute('aria-pressed', x === u); });
      $('[data-unit-kicker]').textContent = 'Building ' + u.dataset.building + ' · Type A';
      var st = $('[data-unit-status]'); st.textContent = STATUS_LABEL[u.dataset.status]; st.hidden = false;
      var t = $('[data-unit-title]'); t.textContent = 'Homesite ' + u.dataset.unit; t.classList.add('is-unit');
    });
  });
  var reserveUnit = $('[data-reserve-unit]');
  if (reserveUnit) reserveUnit.addEventListener('click', function () {
    if (selected) setInterest('Homesite ' + selected.dataset.unit, 'Requesting homesite ' + selected.dataset.unit);
  });

  // Homesite status sheet (published Google Sheet CSV). Falls back to built-in statuses.
  if (TN.statusSheetUrl) {
    fetch(TN.statusSheetUrl).then(function (r) { return r.text(); }).then(function (t) {
      t.trim().split(/\r?\n/).forEach(function (line) {
        var c = line.split(',').map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
        var k = (c[0] || '').toLowerCase(), v = (c[1] || '').toLowerCase();
        if (k === 'cta_count' && /^\d+$/.test(v)) {
          $$('[data-cta-count]').forEach(function (el) { el.textContent = v; });
        } else if (/^\d+$/.test(k) && STATUS_LABEL[v]) {
          var u = units.filter(function (x) { return Number(x.dataset.unit) === Number(k); })[0];
          if (u) { u.dataset.status = v; u.setAttribute('aria-label', 'Homesite ' + Number(k) + ', ' + STATUS_LABEL[v]); }
        }
      });
      countAvailable();
    }).catch(function () {});
  }

  // Consent and tags: only when a tracking ID is configured.
  function loadTags() {
    if (TN.ga4Id && !window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', TN.ga4Id);
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + TN.ga4Id; document.head.appendChild(s);
    }
    if (TN.metaPixelId && !window.fbq) {
      var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      n.queue = []; n.loaded = true; n.version = '2.0'; window._fbq = n;
      var f = document.createElement('script'); f.async = true; f.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(f);
      window.fbq('init', TN.metaPixelId); window.fbq('track', 'PageView');
    }
  }
  if (TN.ga4Id || TN.metaPixelId) {
    var consent = null;
    try { consent = localStorage.getItem('tn-consent'); } catch (e) {}
    if (consent === 'granted') loadTags();
    var box = $('[data-consent]');
    if (!consent && box) {
      box.hidden = false;
      $$('[data-consent-choice]', box).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-consent-choice');
          try { localStorage.setItem('tn-consent', v); } catch (e) {}
          box.hidden = true;
          if (v === 'granted') loadTags();
        });
      });
    }
  }

  // Click tracking.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a,button'); if (!el) return;
    var href = el.getAttribute('href') || '', txt = (el.textContent || '').trim();
    if (href.indexOf('tel:') === 0) track('click_to_call', { link_url: href });
    else if (href.indexOf('mailto:') === 0) track('email_click', { link_url: href });
    else if (/full package/i.test(txt)) track('package_request_click', { link_text: txt });
    else if (href === '#reserve') track('reserve_cta_click', { link_text: txt });
  }, true);
})();
