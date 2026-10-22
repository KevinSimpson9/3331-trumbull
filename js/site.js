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
    var tag = $('[data-hero-tag]');
    hero.muted = true;
    hero.addEventListener('playing', function () {
      hero.classList.add('is-playing');
      if (tag && tag.dataset.videoLabel) tag.textContent = tag.dataset.videoLabel;
    });
    if (!reduceMotion) {
      hero.preload = 'auto';
      var p = hero.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  // Time-lapse: play while at least half visible, muted.
  var inview = $$('video[data-inview]');
  if (inview.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target; v.muted = true;
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !reduceMotion) {
          if (v.preload === 'none') v.preload = 'auto';
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (!v.paused) v.pause();
      });
    }, { threshold: [0, 0.5] });
    inview.forEach(function (v) { vio.observe(v); });
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

  // Neighborhood: category filters and map.
  var map = $('[data-map]');
  if (map) {
    var label = $('[data-map-label]'), home = $('[data-map-home]');
    var HOME_Q = '3331 Trumbull St, Detroit, MI 48208';
    var setMap = function (place) {
      var q = place ? place + ', Detroit, MI' : HOME_Q;
      map.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=' + (place ? 14 : 15) + '&output=embed';
      map.title = 'Google map: ' + (place || 'Trumbull North, 3331 Trumbull St');
      label.textContent = place || 'Trumbull North · 3331 Trumbull St';
      home.hidden = !place;
      $$('.poi').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-place') === place); });
    };
    $$('.poi').forEach(function (b) { b.addEventListener('click', function () { setMap(b.getAttribute('data-place')); }); });
    home.addEventListener('click', function () { setMap(null); });
    $$('[data-cat]', $('.nearby__filters')).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-cat');
        $$('.nearby__filters [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        $$('.poi-list li').forEach(function (li) { li.hidden = c !== 'all' && li.getAttribute('data-cat') !== c; });
      });
    });
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
