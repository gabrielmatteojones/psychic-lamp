(function () {
  var gate = document.getElementById('drive-gate'), app = document.getElementById('drive-app');
  if (!gate || !app) return;
  var $ = function (id) { return document.getElementById(id); };
  var ni = window.netlifyIdentity;
  var API = '/.netlify/functions/drive';
  var LETTERHEAD = (document.querySelector('link[href*="main.css"]').getAttribute('href') || '')
    .replace(/assets\/css\/main\.css.*/, '') + 'assets/img/carta-intestata.png';

  var user = null, cur = { id: null, mine: true }, dirty = false, lhData = null, timer = null, started = false;
  var el = { title: $('doc-title'), body: $('doc-body'), pt: $('doc-print-title'), status: $('doc-status'),
             list: $('doc-list'), del: $('doc-del'), save: $('doc-save'), preview: $('doc-preview') };

  /* ---------- accesso (Netlify Identity) ---------- */
  $('drive-login').addEventListener('click', function () { if (ni) ni.open('login'); else alert('Netlify Identity non disponibile.'); });
  $('drive-logout').addEventListener('click', function () { if (ni) ni.logout(); });
  function start(u) {
    if (started) return; started = true; user = u;
    gate.hidden = true; app.hidden = false;
    $('drive-who').textContent = (u.user_metadata && u.user_metadata.full_name) || u.email;
    refresh(); newDoc(true);
  }
  function stop() { started = false; user = null; app.hidden = true; gate.hidden = false; }
  if (ni) {
    ni.on('init', function (u) { if (u) start(u); else stop(); });
    ni.on('login', function (u) { ni.close(); start(u); });
    ni.on('logout', stop);
    var u0 = ni.currentUser(); if (u0) start(u0);
  }

  /* ---------- API ---------- */
  function api(method, qs, body) {
    return user.jwt().then(function (t) {
      return fetch(API + (qs || ''), {
        method: method, headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ('Errore ' + r.status)); return d;
      });
    });
  }
  function say(msg, bad) { el.status.textContent = msg; el.status.style.color = bad ? '#c0270f' : ''; }

  /* ---------- elenco ---------- */
  function refresh() {
    api('GET').then(function (docs) {
      el.list.innerHTML = '';
      if (!docs.length) { el.list.innerHTML = '<li class="small">Nessun documento, per ora.</li>'; return; }
      docs.forEach(function (d) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; if (d.id === cur.id) b.className = 'on';
        var t = document.createElement('strong'); t.textContent = d.title;
        var m = document.createElement('small');
        m.textContent = new Date(d.updated).toLocaleDateString('it-IT') + ' · ' + (d.authorName || '');
        b.appendChild(t); b.appendChild(m);
        b.addEventListener('click', function () { openDoc(d.id); });
        li.appendChild(b); el.list.appendChild(li);
      });
    }).catch(function (e) { say(e.message, true); });
  }
  function confirmLeave() { return !dirty || confirm('Ci sono modifiche non salvate. Continuare?'); }
  function newDoc(silent) {
    if (!silent && !confirmLeave()) return;
    cur = { id: null, mine: true }; el.title.value = ''; el.body.value = '';
    el.del.hidden = true; dirty = false; say(''); el.save.disabled = false; preview();
    Array.prototype.forEach.call(el.list.querySelectorAll('button'), function (b) { b.classList.remove('on'); });
  }
  function openDoc(id) {
    if (!confirmLeave()) return;
    say('Apro…');
    api('GET', '?id=' + encodeURIComponent(id)).then(function (d) {
      cur = { id: d.id, mine: d.mine }; el.title.value = d.title; el.body.value = d.body;
      el.del.hidden = !d.mine; el.save.disabled = !d.mine; dirty = false;
      say(d.mine ? '' : 'Sola lettura: puoi scaricare il PDF ma non modificarlo.');
      preview(); refresh();
    }).catch(function (e) { say(e.message, true); });
  }
  el.save.addEventListener('click', function () {
    say('Salvo…');
    api('POST', '', { id: cur.id, title: el.title.value, body: el.body.value }).then(function (r) {
      cur.id = r.id; el.del.hidden = false; dirty = false; say('Salvato ✓'); refresh();
    }).catch(function (e) { say(e.message, true); });
  });
  el.del.addEventListener('click', function () {
    if (!cur.id || !confirm('Eliminare definitivamente questo documento?')) return;
    api('DELETE', '?id=' + encodeURIComponent(cur.id)).then(function () { newDoc(true); refresh(); say('Eliminato.'); })
      .catch(function (e) { say(e.message, true); });
  });
  $('doc-new').addEventListener('click', function () { newDoc(); });
  [el.title, el.body, el.pt].forEach(function (i) {
    i.addEventListener('input', function () { dirty = true; clearTimeout(timer); timer = setTimeout(preview, 700); });
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- PDF su carta intestata ---------- */
  // Area utile in mm (misurata sulla carta intestata A4).
  var PAGE = { w: 210, h: 297, x: 60, right: 198, top: 53, bottom: 270 };
  var SAFE = /[^\u0000-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g;

  function loadLetterhead() {
    if (lhData) return Promise.resolve(lhData);
    return fetch(LETTERHEAD).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { lhData = fr.result; res(lhData); }; fr.readAsDataURL(b); });
    });
  }
  function tokens(text) { // **grassetto** → [{t, b}]
    var out = [], bold = false;
    text.split('**').forEach(function (part, i) {
      if (i > 0) bold = !bold;
      part.split(/\s+/).filter(Boolean).forEach(function (w) { out.push({ t: w, b: bold }); });
    });
    return out;
  }
  function build(title, body, printTitle) {
    return loadLetterhead().then(function (lh) {
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' }), y = PAGE.top;
      function page(first) { if (!first) doc.addPage(); doc.addImage(lh, 'PNG', 0, 0, PAGE.w, PAGE.h, 'lh', 'FAST'); y = PAGE.top; }
      page(true);
      function line(parts, size, indent, firstMarker) {
        var lh2 = size * 0.3528 * 1.4, x0 = PAGE.x + indent, maxW = PAGE.right - x0;
        doc.setFontSize(size);
        var cur = [], w = 0, first = true;
        function flush() {
          if (y + lh2 > PAGE.bottom) page(false);
          var x = x0;
          if (first && firstMarker) { doc.setFont('times', 'normal'); doc.text(firstMarker, PAGE.x + indent - 5, y + size * 0.3528); }
          cur.forEach(function (p) { doc.setFont('times', p.b ? 'bold' : 'normal'); doc.text(p.t, x, y + size * 0.3528); x += p.w; });
          y += lh2; cur = []; w = 0; first = false;
        }
        parts.forEach(function (p) {
          doc.setFont('times', p.b ? 'bold' : 'normal');
          var ww = doc.getTextWidth(p.t), sp = doc.getTextWidth(' ');
          if (cur.length && w + ww > maxW) flush();
          cur.push({ t: p.t, b: p.b, w: ww + sp }); w += ww + sp;
        });
        if (cur.length) flush();
      }
      if (printTitle && title.trim()) line([{ t: title.trim().replace(SAFE, ''), b: true }], 16, 0), y += 2;
      body.replace(SAFE, '').split(/\r?\n/).forEach(function (raw) {
        var l = raw.replace(/\s+$/, ''), m;
        if (!l.trim()) { y += 11 * 0.3528 * 0.9; return; }
        if ((m = l.match(/^##\s+(.*)/))) { y += 1.5; line(tokens('**' + m[1] + '**'), 13, 0); y += 0.8; }
        else if ((m = l.match(/^#\s+(.*)/))) { y += 2; line(tokens('**' + m[1] + '**'), 16, 0); y += 1; }
        else if ((m = l.match(/^[-*]\s+(.*)/))) line(tokens(m[1]), 11, 6, '\u2022');
        else if ((m = l.match(/^(\d+[.)])\s+(.*)/))) line(tokens(m[2]), 11, 6, m[1]);
        else line(tokens(l), 11, 0);
      });
      return doc;
    });
  }
  var blobUrl = null;
  function preview() {
    if (!window.jspdf) { setTimeout(preview, 400); return; }
    build(el.title.value, el.body.value, el.pt.checked).then(function (doc) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(doc.output('blob'));
      el.preview.src = blobUrl + '#toolbar=0&navpanes=0&view=FitH';
    });
  }
  $('doc-pdf').addEventListener('click', function () {
    build(el.title.value, el.body.value, el.pt.checked).then(function (doc) {
      var name = (el.title.value || 'documento').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'documento';
      doc.save(name + '.pdf');
    });
  });
})();
