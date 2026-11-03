(function () {
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var base = (document.querySelector('link[href*="main.css"]').getAttribute('href') || '').replace(/assets\/css\/main\.css.*/, '');

  /* ---- reveal allo scroll + contatori + onde ---- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).concat(e.target.hasAttribute('data-count') ? [e.target] : []).forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: .18 });
  $$('.reveal, .stamp, .lime').forEach(function (el) { io.observe(el); });

  function countUp(el) {
    var raw = el.getAttribute('data-count');
    if (!/^\d+$/.test(raw) || reduce) return;
    var target = +raw, t0 = null;
    (function step(t) {
      t0 = t0 || t;
      var p = Math.min((t - t0) / 1400, 1), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  /* ---- header: nascondi scorrendo in giù ---- */
  var header = $('.site-header'), lastY = 0, toTop = $('[data-top]');
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    header.classList.toggle('hide', y > lastY && y > 160);
    toTop.classList.toggle('show', y > 600);
    lastY = y;
    scrubQuote();
  }, { passive: true });
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---- overlay menu / ricerca ---- */
  function openOv(id) {
    var o = document.getElementById(id); o.classList.add('open'); o.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (id === 'search') { loadIndex(); setTimeout(function () { $('#search-input').focus(); }, 300); }
  }
  function closeOv() {
    $$('.overlay.open').forEach(function (o) { o.classList.remove('open'); o.setAttribute('aria-hidden', 'true'); });
    document.body.style.overflow = '';
  }
  $$('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openOv(b.dataset.open); }); });
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeOv); });
  $$('.menu-list a').forEach(function (a) { a.addEventListener('click', closeOv); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOv();
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openOv('search'); }
  });

  /* ---- ricerca live ---- */
  var index = null;
  function loadIndex() {
    if (index) return;
    fetch(base + 'search.json').then(function (r) { return r.json(); }).then(function (d) { index = d; });
  }
  var labels = { posts: 'Blog', news: 'News', portfolio: 'Portfolio' };
  $('#search-input').addEventListener('input', function (e) {
    var q = e.target.value.trim().toLowerCase(), ul = $('#search-results');
    ul.innerHTML = '';
    if (!q || !index) return;
    index.filter(function (i) { return (i.title + ' ' + i.text).toLowerCase().indexOf(q) > -1; }).slice(0, 8).forEach(function (i) {
      var li = document.createElement('li');
      li.innerHTML = '<a href="' + i.url + '"><span></span><small>' + (labels[i.type] || i.type) + '</small></a>';
      li.querySelector('span').textContent = i.title;
      ul.appendChild(li);
    });
    if (!ul.children.length) ul.innerHTML = '<li style="padding:14px 4px;opacity:.7">Nessun risultato.</li>';
  });

  /* ---- carosello: frecce, barra, trascinamento ---- */
  var car = $('#carousel');
  if (car) {
    var bar = $('#progress');
    var step = function () { return (car.querySelector('.fcard').offsetWidth + 20); };
    $('[data-prev]').addEventListener('click', function () { car.scrollBy({ left: -step(), behavior: 'smooth' }); });
    $('[data-next]').addEventListener('click', function () { car.scrollBy({ left: step(), behavior: 'smooth' }); });
    var upd = function () {
      var max = car.scrollWidth - car.clientWidth, w = car.clientWidth / car.scrollWidth * 100;
      bar.style.width = w + '%'; bar.style.marginLeft = (max ? car.scrollLeft / max * (100 - w) : 0) + '%';
    };
    car.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
    var down = false, sx = 0, sl = 0, moved = false;
    car.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = car.scrollLeft; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return; var dx = e.clientX - sx;
      if (Math.abs(dx) > 5) { moved = true; car.classList.add('drag'); }
      car.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () { down = false; car.classList.remove('drag'); });
    car.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } }, true);
  }

  /* ---- frase che si illumina parola per parola ---- */
  var quote = $('#quote'), words = [];
  if (quote) {
    words = quote.textContent.trim().split(/\s+/).map(function (w) {
      var s = document.createElement('span'); s.className = 'wd'; s.textContent = w; return s;
    });
    quote.textContent = '';
    words.forEach(function (s, i) { quote.appendChild(s); if (i < words.length - 1) quote.appendChild(document.createTextNode(' ')); });
  }
  function scrubQuote() {
    if (!quote) return;
    var r = quote.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.min(Math.max((vh * .85 - r.top) / (vh * .5), 0), 1);
    var n = Math.round(p * words.length);
    words.forEach(function (s, i) { s.classList.toggle('on', i < n || reduce); });
  }
  scrubQuote();

  /* ---- filtri (blog, portfolio) con #hash ---- */
  $$('[data-filter-group]').forEach(function (group) {
    var items = $$('[data-filter-items] > *'), empty = $('.empty');
    function apply(f) {
      var shown = 0;
      $$('.chip', group).forEach(function (c) { c.classList.toggle('on', c.dataset.filter === f); });
      items.forEach(function (it) {
        var ok = f === 'all' || it.dataset.cat === f; it.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    }
    $$('.chip', group).forEach(function (c) {
      c.addEventListener('click', function () { apply(c.dataset.filter); history.replaceState(null, '', c.dataset.filter === 'all' ? location.pathname : '#' + c.dataset.filter); });
    });
    var h = location.hash.slice(1);
    apply($$('.chip', group).some(function (c) { return c.dataset.filter === h; }) ? h : 'all');
  });

  /* ---- tilt 3D leggero sulle card ---- */
  if (!reduce && window.matchMedia('(hover:hover)').matches) {
    $$('.tilt').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = 'perspective(700px) rotateY(' + x * 8 + 'deg) rotateX(' + -y * 8 + 'deg) translateY(-4px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
    var st = $('#stamp');
    document.addEventListener('mousemove', function (e) {
      if (!st || !st.classList.contains('in')) return;
      st.style.transform = 'rotate(' + (-1.6 + (e.clientX / innerWidth - .5) * 2) + 'deg) translateY(' + (e.clientY / innerHeight - .5) * 6 + 'px)';
    });
  }

  /* ---- messaggio form inviato ---- */
  if (/[?&]ok=1/.test(location.search)) { var ok = $('.ok'); if (ok) ok.hidden = false; }
})();
