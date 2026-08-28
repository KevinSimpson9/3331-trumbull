// 3331 Trumbull — marketing site interactions + investor access gate

(function () {
  var CONTACT_EMAIL = 'kevin@akcapital.fund';
  var ACCESS_CODE = 'TRUMBULL25'; // case-insensitive

  // ----- investor access gate -----
  function grant() {
    document.body.classList.add('access-granted');
    var stampEl = document.getElementById('session-stamp');
    if (stampEl) {
      stampEl.textContent = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  }
  if (sessionStorage.getItem('tn_access') === 'granted') grant();

  var gateForm = document.getElementById('gate-form');
  if (gateForm) {
    gateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('gate-code');
      var msg = document.getElementById('gate-message');
      if ((input.value || '').trim().toLowerCase() === ACCESS_CODE.toLowerCase()) {
        sessionStorage.setItem('tn_access', 'granted');
        grant();
        input.value = '';
        msg.textContent = '';
        var access = document.getElementById('access');
        if (access) window.scrollTo({ top: access.offsetTop - 60, behavior: 'smooth' });
      } else {
        msg.textContent = "That code doesn't match — try again";
      }
    });
  }
  var lockLink = document.getElementById('lock-access');
  if (lockLink) {
    lockLink.addEventListener('click', function () {
      sessionStorage.removeItem('tn_access');
      document.body.classList.remove('access-granted');
      var access = document.getElementById('access');
      if (access) window.scrollTo({ top: access.offsetTop - 60 });
    });
  }

  // ----- renderings rail -----
  var rail = document.getElementById('rail');
  function scrollRail(dir) {
    if (rail) rail.scrollBy({ left: dir * Math.min(rail.clientWidth * 0.78, 1108), behavior: 'smooth' });
  }
  var prev = document.getElementById('rail-prev');
  var next = document.getElementById('rail-next');
  if (prev) prev.addEventListener('click', function () { scrollRail(-1); });
  if (next) next.addEventListener('click', function () { scrollRail(1); });

  // ----- lightbox -----
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightbox-img');
  var lightboxCaption = document.getElementById('lightbox-caption');
  document.querySelectorAll('.lightbox-trigger').forEach(function (el) {
    el.addEventListener('click', function () {
      lightboxImg.src = el.getAttribute('data-full');
      lightboxImg.alt = el.getAttribute('data-alt') || '';
      lightboxCaption.textContent = el.getAttribute('data-alt') || '';
      lightbox.classList.add('open');
    });
  });
  function closeLightbox() { lightbox.classList.remove('open'); lightboxImg.removeAttribute('src'); }
  lightbox.addEventListener('click', closeLightbox);

  // ----- pdf viewer -----
  var pdfOverlay = document.getElementById('pdf-overlay');
  var pdfFrame = document.getElementById('pdf-frame');
  var pdfName = document.getElementById('pdf-name');
  document.querySelectorAll('.doc-open').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      pdfFrame.src = el.getAttribute('data-pdf');
      pdfName.textContent = el.getAttribute('data-name') || 'Document';
      pdfOverlay.classList.add('open');
    });
  });
  function closePdf() { pdfOverlay.classList.remove('open'); pdfFrame.removeAttribute('src'); }
  document.getElementById('pdf-close').addEventListener('click', closePdf);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeLightbox(); closePdf(); }
  });

  // ----- indication of interest: composes an email, nothing is stored -----
  var form = document.getElementById('interest-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var subject = '3331 Trumbull — Indication of Interest from ' + (f.name.value || 'Investor');
      var body =
        'Name: ' + f.name.value +
        '\nEmail: ' + f.email.value +
        '\nAllocation: ' + f.amount.value +
        '\nSource of funds: ' + (f.method.value || '—') +
        '\n\n' + (f.message.value || '');
      window.location.href =
        'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      document.getElementById('interest-message').textContent = 'Opening your email client…';
    });
  }
})();
