/* JS Jewellery CMS core.
   Shared by the public pages and by admin.html.
   Edits made in the admin panel are stored in Supabase (table site_content) and applied here.
   Each edit points to an element by its position in the page (path), and is only applied
   while the original content still matches, so a changed page can never be corrupted. */
(function () {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TEMPLATE']);
  const NOTEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'TEXTAREA', 'SELECT', 'TEMPLATE']);
  const DYN = '.live-products,.live-services,.approved-reviews';
  const isStatic = el => !SKIP.has(el.tagName) && !(el.matches && el.matches(DYN));
  const kids = el => Array.prototype.filter.call(el.children, isStatic);
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const sig = s => { s = String(s || ''); return s.length + ':' + s.slice(0, 24) + ':' + s.slice(-24); };

  function pathOf(el, root) {
    const p = [];
    while (el && el !== root) {
      const par = el.parentElement; if (!par) return null;
      p.unshift(kids(par).indexOf(el)); el = par;
    }
    return p.join('.');
  }
  function elAt(root, path) {
    let el = root; if (path === '') return el;
    for (const i of String(path).split('.')) { el = kids(el)[+i]; if (!el) return null; }
    return el;
  }
  function pageName(loc) {
    let p = (loc || location).pathname.split('/').pop() || 'index.html';
    if (!/\.[a-z]+$/i.test(p)) p += '.html';
    return p;
  }
  function labelOf(el) {
    const sec = el.closest('.topbar,header,footer,section,main,nav');
    if (!sec) return 'Page';
    if (sec.matches('.topbar')) return 'Top bar';
    if (sec.matches('header,nav')) return 'Header / Menu';
    if (sec.matches('footer')) return 'Footer';
    const h = sec.querySelector('h1,h2,h3');
    return h ? norm(h.textContent).slice(0, 50) : (sec.id || sec.className || 'Section');
  }

  /* Collect everything editable in a document. */
  function extract(doc) {
    const body = doc.body, items = [];
    (function walk(el) {
      if (el !== body && !isStatic(el)) return;
      if (NOTEXT.has(el.tagName)) return;
      if (el.tagName === 'IMG') {
        const src = el.getAttribute('src') || '';
        items.push({ kind: 'img', key: pathOf(el, body), el, orig: sig(src), origVal: src, label: labelOf(el), alt: el.getAttribute('alt') || '' });
        items.push({ kind: 'hide', key: pathOf(el, body), el, orig: '0', origVal: '0', label: labelOf(el), sub: 'image' });
        return;
      }
      if (el.tagName === 'A' && el.hasAttribute('href')) {
        const h = el.getAttribute('href');
        items.push({ kind: 'href', key: pathOf(el, body), el, orig: h, origVal: h, label: labelOf(el), text: norm(el.textContent).slice(0, 40) });
      }
      if (el.parentElement === body.querySelector('main') && el.parentElement) {
        items.push({ kind: 'hide', key: pathOf(el, body), el, orig: '0', origVal: '0', label: labelOf(el), sub: 'section' });
      }
      const pk = pathOf(el, body);
      el.childNodes.forEach((n, i) => {
        if (n.nodeType === 3 && n.nodeValue.trim()) {
          items.push({ kind: 'text', key: pk + '|' + i, node: n, el, orig: norm(n.nodeValue), origVal: n.nodeValue.trim(), label: labelOf(el), tag: el.tagName.toLowerCase() });
        } else if (n.nodeType === 1) walk(n);
      });
    })(body);
    const t = doc.querySelector('title');
    if (t) items.unshift({ kind: 'title', key: 'head', orig: norm(t.textContent), origVal: t.textContent.trim(), label: 'Page' });
    const d = doc.querySelector('meta[name="description"]');
    if (d) items.unshift({ kind: 'desc', key: 'head', orig: d.getAttribute('content') || '', origVal: d.getAttribute('content') || '', label: 'Page' });
    return items;
  }

  /* Apply stored edits to a live document. Safe to call repeatedly. */
  const undo = [];
  function apply(rows, doc) {
    doc = doc || document;
    while (undo.length) { try { undo.pop()(); } catch (e) {} }
    const body = doc.body;
    (rows || []).forEach(r => {
      try {
        if (r.kind === 'title') { const t = doc.querySelector('title'); if (t && norm(t.textContent) === r.orig) { const o = t.textContent; t.textContent = r.value; doc.title = r.value; undo.push(() => { t.textContent = o; doc.title = o; }); } return; }
        if (r.kind === 'desc') { const d = doc.querySelector('meta[name="description"]'); if (d && (d.getAttribute('content') || '') === r.orig) { const o = d.getAttribute('content'); d.setAttribute('content', r.value); undo.push(() => d.setAttribute('content', o)); } return; }
        if (r.kind === 'text') {
          const [path, idx] = r.key.split('|'); const par = elAt(body, path); const n = par && par.childNodes[+idx];
          if (!n || n.nodeType !== 3 || norm(n.nodeValue) !== r.orig) return;
          const old = n.nodeValue, m = old.match(/^(\s*)([\s\S]*?)(\s*)$/);
          n.nodeValue = m[1] + r.value + m[3]; undo.push(() => { n.nodeValue = old; });
          return;
        }
        const el = elAt(body, r.key); if (!el) return;
        if (r.kind === 'img' && el.tagName === 'IMG') {
          const src = el.getAttribute('src') || ''; if (sig(src) !== r.orig) return;
          const ss = el.getAttribute('srcset'); el.removeAttribute('srcset'); el.setAttribute('src', r.value);
          undo.push(() => { el.setAttribute('src', src); if (ss) el.setAttribute('srcset', ss); });
        } else if (r.kind === 'href' && el.tagName === 'A') {
          if ((el.getAttribute('href') || '') !== r.orig) return;
          const o = el.getAttribute('href'); el.setAttribute('href', r.value); undo.push(() => el.setAttribute('href', o));
        } else if (r.kind === 'hide' && r.value === '1') {
          const t = el.tagName === 'IMG' ? (el.closest('figure') || el) : el; const o = t.style.display;
          t.style.setProperty('display', 'none', 'important'); undo.push(() => { t.style.display = o; });
        }
      } catch (e) { /* ignore a broken row */ }
    });
  }

  const KEY = 'jsj_cms_v2', page = pageName();
  const raw = /[?&]cmsraw=1/.test(location.search) || window.__JSCMS_NOAPPLY;
  function readCache() { try { return (JSON.parse(localStorage.getItem(KEY) || '{}'))[page] || []; } catch (e) { return []; } }
  function writeCache(rows) { try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); all[page] = rows; localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} }

  window.JSCMS = { extract, apply, pathOf, elAt, norm, sig, pageName, readCache, writeCache, raw };
  if (!raw && document.body) apply(readCache());   // instant: last known edits, before the network answers
})();
