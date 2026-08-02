// 3331 Trumbull — marketing site interactions

(function () {
  var CONTACT_EMAIL = 'kevin@akcapital.fund';

  // ----- renderings lightbox -----
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightbox-img');

  document.querySelectorAll('.lightbox-trigger').forEach(function (el) {
    el.addEventListener('click', function () {
      lightboxImg.src = el.getAttribute('data-full');
      lightboxImg.alt = el.getAttribute('data-alt') || '';
      lightbox.classList.add('open');
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightboxImg.src = '';
  }
  lightbox.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  // ----- offering request form: composes an email, nothing is stored -----
  var form = document.getElementById('offering-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var subject = '3331 Trumbull — Offering Request from ' + (f.name.value || 'Investor');
      var body =
        'Name: ' + f.name.value +
        '\nEmail: ' + f.email.value +
        '\nPhone: ' + (f.phone.value || '—') +
        '\nInterest: ' + f.amount.value +
        '\nInvesting via: ' + (f.method.value || '—') +
        '\n\n' + (f.message.value || '');
      window.location.href =
        'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    });
  }
})();
