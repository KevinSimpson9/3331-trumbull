// 3331 Trumbull — marketing site interactions

(function () {
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

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });
})();
