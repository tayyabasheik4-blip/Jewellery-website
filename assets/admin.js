import { supabase, escapeHTML } from './supabase-client.js';
window.__adminLoaded = true;
const C = window.JSCMS;
const $ = id => document.getElementById(id);
let products = [], services = [];

/* ---------- basics ---------- */
function say(t, err) { const s = $('status'); s.textContent = t; s.classList.toggle('err', !!err); }
function showApp(user) {
  $('login').classList.add('hidden'); $('dashboard').classList.remove('hidden'); $('logout').classList.remove('hidden');
  $('welcome').textContent = 'Welcome, Admin'; loadAll(); loadPage();
}
function showTab(name) {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('hidden', x.id !== name));
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ---------- login (password only; the Supabase account email is kept under "Advanced") ---------- */
async function checkAdmin(user) {
  const { data, error } = await supabase.from('admin_profiles').select('role').eq('user_id', user.id).single();
  if (error || data?.role !== 'admin') { await supabase.auth.signOut(); throw new Error('This account does not have admin permission.'); }
}
async function doLogin() {
  const msg = $('loginMsg'); msg.textContent = '';
  const pw = $('password').value; if (!pw) { msg.textContent = 'Please enter the password.'; return; }
  $('loginBtn').disabled = true;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: $('email').value.trim(), password: pw });
    if (error) { msg.textContent = /invalid/i.test(error.message) ? 'Wrong password.' : error.message; return; }
    await checkAdmin(data.user); showApp(data.user);
  } catch (e) { msg.textContent = e.message; }
  finally { $('loginBtn').disabled = false; }
}
$('loginBtn').onclick = doLogin;
$('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('logout').onclick = async () => { await supabase.auth.signOut(); location.reload(); };
supabase.auth.getSession().then(async ({ data }) => {
  if (data.session) { try { await checkAdmin(data.session.user); showApp(data.session.user); } catch (e) { $('loginMsg').textContent = e.message; } }
});

$('pwBtn').onclick = async () => {
  const a = $('newPw').value, b = $('newPw2').value, m = $('pwMsg'); m.classList.add('err');
  if (a.length < 6) { m.textContent = 'Password must be at least 6 characters.'; return; }
  if (a !== b) { m.textContent = 'Passwords do not match.'; return; }
  const { error } = await supabase.auth.updateUser({ password: a });
  if (error) { m.textContent = error.message; return; }
  m.classList.remove('err'); m.textContent = 'Password changed. Use the new password next time you log in.'; $('newPw').value = $('newPw2').value = '';
};

/* ---------- storage upload ---------- */
async function upload(file, folder) {
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10 MB or smaller.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = folder + '/' + crypto.randomUUID() + '.' + ext;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error; return path;
}
const publicUrl = path => supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;

/* ====================================================================
   PAGE EDITOR
   ==================================================================== */
const KINDS = { title: 'Page title (browser tab)', desc: 'Search-engine description', hide: 'Show / hide', text: 'Texts', img: 'Images', href: 'Links & phone numbers' };
let page = 'index.html', items = [], stored = new Map(), pending = new Map(), idoc = null;
const ik = it => it.kind + '|' + it.key;
const base = it => it.kind === 'hide' ? '0' : it.origVal;
const cur = it => pending.has(ik(it)) ? pending.get(ik(it)) : (stored.has(ik(it)) ? stored.get(ik(it)) : base(it));
const isSame = (it, v) => it.kind === 'text' ? C.norm(v) === it.orig : (it.kind === 'img' ? v === it.origVal : v === it.origVal);

function setLive(it, v) {           // reflect a value inside the preview iframe
  try {
    if (it.kind === 'text') { const m = it.node.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/); it.node.nodeValue = m[1] + v + m[3]; }
    else if (it.kind === 'img') { it.el.removeAttribute('srcset'); it.el.setAttribute('src', v); }
    else if (it.kind === 'href') it.el.setAttribute('href', v);
    else if (it.kind === 'hide') { const t = it.el.tagName === 'IMG' ? (it.el.closest('figure') || it.el) : it.el; t.style.opacity = v === '1' ? '.2' : ''; t.style.outline = v === '1' ? '2px dashed #c33' : ''; }
    else if (it.kind === 'title' && idoc) idoc.title = v;
  } catch (e) {}
}
function markDirty() {
  const n = pending.size;
  $('saveContent').disabled = !n; $('discardContent').disabled = !n;
  $('saveContent').textContent = n ? `Save changes (${n})` : 'Save changes';
}
window.addEventListener('beforeunload', e => { if (pending.size) { e.preventDefault(); e.returnValue = ''; } });

function change(it, v, row) {
  const k = ik(it);
  const saved = stored.has(k) ? stored.get(k) : base(it);
  if ((it.kind === 'text' ? C.norm(v) === C.norm(saved) : v === saved)) pending.delete(k); else pending.set(k, v);
  setLive(it, v); row.classList.toggle('changed', !isSame(it, v)); markDirty();
}

async function loadPage() {
  if (pending.size && !confirm('You have unsaved changes on this page. Discard them?')) { $('pageSel').value = page; return; }
  page = $('pageSel').value; pending.clear(); markDirty(); items = []; idoc = null;
  $('fields').innerHTML = '<p class="muted">Loading page…</p>';
  const { data, error } = await supabase.from('site_content').select('*').eq('page', page);
  if (error) { $('fields').innerHTML = `<p class="status err">${escapeHTML(error.message)}<br>Did you run the SQL setup file (supabase_admin_setup.sql) in Supabase?</p>`; return; }
  stored = new Map((data || []).map(r => [r.kind + '|' + r.key, r.value]));
  const f = $('preview'); f.onload = null;
  f.onload = () => { try { idoc = f.contentDocument; buildEditor(); } catch (e) { $('fields').innerHTML = '<p class="status err">Cannot read the preview. Open the admin panel from your website address (https://…), not from a file on your computer.</p>'; } };
  f.src = page + '?cmsraw=1';
}
$('pageSel').onchange = loadPage;

function buildEditor() {
  items = C.extract(idoc);
  const st = idoc.createElement('style'); st.textContent = '*{cursor:pointer!important}.jsadm-hl{outline:2px solid #c5a04b!important;outline-offset:2px}';
  idoc.head.appendChild(st);
  idoc.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); locate(e.target); }, true);
  idoc.addEventListener('mouseover', e => { e.target.classList && e.target.classList.add('jsadm-hl'); });
  idoc.addEventListener('mouseout', e => { e.target.classList && e.target.classList.remove('jsadm-hl'); });
  items.forEach((it, i) => { it.id = i; if (stored.has(ik(it))) setLive(it, stored.get(ik(it))); });

  const box = $('fields'); box.innerHTML = '';
  Object.keys(KINDS).forEach(kind => {
    const list = items.filter(i => i.kind === kind); if (!list.length) return;
    const d = document.createElement('details'); d.className = 'grp'; d.dataset.kind = kind;
    d.open = kind === 'text' || kind === 'hide';
    d.innerHTML = `<summary>${KINDS[kind]} <span class="muted">(${list.length})</span></summary>`;
    list.forEach(it => d.appendChild(makeRow(it)));
    box.appendChild(d);
  });
  applyFilter();
}

function makeRow(it) {
  const row = document.createElement('div'); row.className = 'row'; row.dataset.id = it.id;
  const v = cur(it); if (!isSame(it, v)) row.classList.add('changed');
  const ctx = `<div class="ctx">${escapeHTML(it.label)}${it.tag ? ' · ' + it.tag : ''}${it.sub ? ' · ' + it.sub : ''}</div>`;
  const reset = () => { const b = document.createElement('button'); b.className = 'light sm'; b.textContent = '↺ Reset'; b.type = 'button'; b.onclick = () => { const o = it.kind === 'text' ? it.origVal : base(it); change(it, o, row); row.replaceWith(makeRow(it)); }; return b; };
  if (it.kind === 'text' || it.kind === 'title' || it.kind === 'desc') {
    const long = v.length > 70 || it.kind === 'desc';
    row.innerHTML = ctx + `<${long ? 'textarea' : 'input'} aria-label="text"></${long ? 'textarea' : 'input'}>`;
    const inp = row.querySelector(long ? 'textarea' : 'input'); inp.value = v;
    inp.addEventListener('input', () => change(it, inp.value, row));
    const a = document.createElement('div'); a.className = 'acts'; a.appendChild(reset()); row.appendChild(a);
  } else if (it.kind === 'href') {
    row.innerHTML = ctx + `<div class="hint">Link on: “${escapeHTML(it.text || '(image/button)')}”</div><input aria-label="link">`;
    const inp = row.querySelector('input'); inp.value = v;
    inp.addEventListener('input', () => change(it, inp.value.trim(), row));
    row.insertAdjacentHTML('beforeend', '<div class="hint">Examples: tel:+923001234567 · mailto:name@mail.com · https://wa.me/923001234567</div>');
    const a = document.createElement('div'); a.className = 'acts'; a.appendChild(reset()); row.appendChild(a);
  } else if (it.kind === 'img') {
    row.innerHTML = ctx + `<img class="th" loading="lazy" alt=""><input type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div class="hint">Pick a new image to replace this one (max 10 MB).</div>`;
    row.querySelector('img').src = v;
    const fi = row.querySelector('input');
    fi.onchange = async () => {
      const f = fi.files[0]; if (!f) return; const hint = row.querySelector('.hint'); hint.textContent = 'Uploading…';
      try { const url = publicUrl(await upload(f, 'site')); change(it, url, row); row.querySelector('img').src = url; hint.textContent = 'Image replaced. Press Save changes to publish.'; }
      catch (e) { hint.textContent = e.message; }
    };
    const a = document.createElement('div'); a.className = 'acts'; a.appendChild(reset()); row.appendChild(a);
  } else if (it.kind === 'hide') {
    row.innerHTML = ctx + `<label style="margin:0;display:flex;gap:8px;align-items:center;font-weight:normal"><input type="checkbox" style="width:auto"> Hide this ${it.sub} from the website</label>`;
    const cb = row.querySelector('input'); cb.checked = v === '1';
    if (it.sub === 'image') { const im = document.createElement('img'); im.className = 'th'; im.loading = 'lazy'; im.alt = ''; im.src = it.origVal; row.insertBefore(im, row.querySelector('label')); }
    cb.onchange = () => change(it, cb.checked ? '1' : '0', row);
  }
  return row;
}

function applyFilter() {
  const q = $('fieldSearch').value.trim().toLowerCase();
  document.querySelectorAll('#fields .row').forEach(r => {
    const it = items[+r.dataset.id]; if (!it) return;
    const hay = (it.kind === 'img' || it.kind === 'hide' ? it.label + ' ' + (it.alt || '') : (r.querySelector('input,textarea')?.value || '') + ' ' + it.label).toLowerCase();
    r.classList.toggle('hidden', !!q && !hay.includes(q));
  });
}
$('fieldSearch').oninput = applyFilter;

function locate(target) {
  let found = null;
  for (let el = target; el && el !== idoc.body && !found; el = el.parentElement) {
    if (el.tagName === 'IMG') found = items.find(i => i.kind === 'img' && i.el === el);
    if (!found) found = items.find(i => i.kind === 'text' && i.node.parentNode === el);
    if (!found && el.tagName === 'A') found = items.find(i => i.kind === 'href' && i.el === el);
  }
  if (!found) return;
  const row = document.querySelector(`#fields .row[data-id="${found.id}"]`); if (!row) return;
  row.classList.remove('hidden'); row.closest('details').open = true;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
  const inp = row.querySelector('input:not([type=file]),textarea'); if (inp) inp.focus({ preventScroll: true });
}

/* Shared save: upsert changed rows, delete rows that went back to the original. */
async function saveRows(pg, upserts, deletes) {
  if (upserts.length) { const { error } = await supabase.from('site_content').upsert(upserts.map(r => ({ ...r, page: pg, updated_at: new Date().toISOString() })), { onConflict: 'page,kind,key' }); if (error) throw error; }
  for (const kind of [...new Set(deletes.map(d => d.kind))]) {
    const keys = deletes.filter(d => d.kind === kind).map(d => d.key);
    const { error } = await supabase.from('site_content').delete().eq('page', pg).eq('kind', kind).in('key', keys); if (error) throw error;
  }
}

$('saveContent').onclick = async () => {
  const btn = $('saveContent'), s = $('contentStatus'); btn.disabled = true; s.classList.remove('err'); s.textContent = 'Saving…';
  try {
    const ups = [], dels = [];
    items.forEach(it => {
      const k = ik(it); if (!pending.has(k)) return; const v = pending.get(k);
      if (isSame(it, v)) dels.push({ kind: it.kind, key: it.key });
      else ups.push({ kind: it.kind, key: it.key, orig: it.orig, value: v });
    });
    await saveRows(page, ups, dels);
    ups.forEach(u => stored.set(u.kind + '|' + u.key, u.value)); dels.forEach(d => stored.delete(d.kind + '|' + d.key));
    pending.clear(); markDirty(); s.textContent = 'Saved. Changes are live.';
    document.querySelectorAll('#fields .row.changed').forEach(r => { const it = items[+r.dataset.id]; r.classList.toggle('changed', stored.has(ik(it))); });
    try { const all = JSON.parse(localStorage.getItem('jsj_cms_v2') || '{}'); delete all[page]; localStorage.setItem('jsj_cms_v2', JSON.stringify(all)); } catch (e) {}
  } catch (e) { s.classList.add('err'); s.textContent = e.message || String(e); markDirty(); }
};
$('discardContent').onclick = () => { pending.clear(); markDirty(); loadPage(); };

/* ====================================================================
   FIND & REPLACE ACROSS ALL PAGES
   ==================================================================== */
const PAGES = ['index.html', 'collection.html', 'services.html', 'about.html', 'contact.html', 'reviews.html'];
let found = [];
$('scanBtn').onclick = async () => {
  const f = $('rFind').value, w = $('rWith').value, hf = $('hFind').value, hw = $('hWith').value, s = $('scanStatus');
  if (!f && !hf) { s.classList.add('err'); s.textContent = 'Type something to find.'; return; }
  s.classList.remove('err'); found = []; $('matches').innerHTML = ''; $('applyReplace').classList.add('hidden'); $('scanBtn').disabled = true;
  try {
    const { data, error } = await supabase.from('site_content').select('*'); if (error) throw error;
    const ov = new Map((data || []).map(r => [r.page + '|' + r.kind + '|' + r.key, r.value]));
    for (const pg of PAGES) {
      s.textContent = 'Reading ' + pg + '…';
      const html = await (await fetch(pg + '?cmsraw=1')).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      C.extract(doc).forEach(it => {
        const eff = ov.get(pg + '|' + it.kind + '|' + it.key) ?? it.origVal;
        if (it.kind === 'text' && f && eff.includes(f)) found.push({ pg, it, from: eff, to: eff.split(f).join(w) });
        else if (it.kind === 'href' && hf && eff.includes(hf)) found.push({ pg, it, from: eff, to: eff.split(hf).join(hw) });
      });
    }
    s.textContent = found.length ? `${found.length} match(es) found.` : 'Nothing found.';
    $('matches').innerHTML = found.map((m, i) => `<label class="match" style="font-weight:normal;margin:0"><input type="checkbox" data-m="${i}" checked><b>${escapeHTML(m.pg)}</b><span>${m.it.kind === 'href' ? '🔗 ' : ''}<del>${escapeHTML(m.from)}</del> → <ins>${escapeHTML(m.to)}</ins></span></label>`).join('');
    $('applyReplace').classList.toggle('hidden', !found.length);
  } catch (e) { s.classList.add('err'); s.textContent = e.message || String(e); }
  $('scanBtn').disabled = false;
};
$('applyReplace').onclick = async () => {
  const s = $('scanStatus'); $('applyReplace').disabled = true;
  try {
    const sel = [...document.querySelectorAll('#matches input:checked')].map(c => found[+c.dataset.m]);
    for (const pg of PAGES) {
      const ups = [], dels = [];
      sel.filter(m => m.pg === pg).forEach(m => { const same = m.it.kind === 'text' ? C.norm(m.to) === m.it.orig : m.to === m.it.origVal; (same ? dels : ups).push(same ? { kind: m.it.kind, key: m.it.key } : { kind: m.it.kind, key: m.it.key, orig: m.it.orig, value: m.to }); });
      if (ups.length || dels.length) await saveRows(pg, ups, dels);
    }
    s.classList.remove('err'); s.textContent = `Done. ${sel.length} change(s) are live.`; $('matches').innerHTML = ''; $('applyReplace').classList.add('hidden'); found = [];
    try { localStorage.removeItem('jsj_cms_v2'); } catch (e) {}
    loadPage();
  } catch (e) { s.classList.add('err'); s.textContent = e.message || String(e); }
  $('applyReplace').disabled = false;
};

/* ====================================================================
   PRODUCTS / SERVICES / REVIEWS / MESSAGES
   ==================================================================== */
async function loadAll() { await Promise.all([loadProducts(), loadServices(), loadReviews(), loadMessages()]); }
async function loadProducts() { const { data, error } = await supabase.from('products').select('*').order('display_order').order('created_at', { ascending: false }); if (error) { say(error.message, 1); return; } products = data || []; $('productRows').innerHTML = products.map(p => `<tr><td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.category || '')}</td><td>${p.price ?? '—'}</td><td>${p.is_published ? 'Published' : 'Hidden'}</td><td><button data-edit-p="${p.id}">Edit</button><button class="danger" data-del-p="${p.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5">No products yet.</td></tr>'; }
async function loadServices() { const { data, error } = await supabase.from('services').select('*').order('display_order').order('created_at', { ascending: false }); if (error) { say(error.message, 1); return; } services = data || []; $('serviceRows').innerHTML = services.map(s => `<tr><td>${escapeHTML(s.name)}</td><td>${s.is_published ? 'Published' : 'Hidden'}</td><td><button data-edit-s="${s.id}">Edit</button><button class="danger" data-del-s="${s.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="3">No services yet.</td></tr>'; }
async function loadReviews() { const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }); if (error) { say(error.message, 1); return; } $('reviewRows').innerHTML = (data || []).map(r => `<tr><td>${escapeHTML(r.customer_name)}</td><td>${r.rating}/5</td><td>${escapeHTML(r.review_text)}</td><td>${r.is_approved ? 'Approved' : 'Pending'}</td><td>${r.is_approved ? `<button data-unapprove="${r.id}">Hide</button>` : `<button data-approve="${r.id}" class="gold">Approve</button>`}<button class="danger" data-del-r="${r.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5">No reviews yet.</td></tr>'; }
async function loadMessages() { const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }); if (error) { say(error.message, 1); return; } $('messageRows').innerHTML = (data || []).map(m => `<tr><td>${new Date(m.created_at).toLocaleString()}</td><td>${escapeHTML(m.name)}<br>${escapeHTML(m.phone)}</td><td>${escapeHTML(m.subject || '')}<br>${escapeHTML(m.message)}</td><td>${m.status}</td><td><select data-msg-status="${m.id}">${['new', 'read', 'replied', 'archived'].map(o => `<option ${m.status === o ? 'selected' : ''}>${o}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="5">No messages yet.</td></tr>'; }

$('productForm').onsubmit = async e => { e.preventDefault(); try { let image_path = products.find(p => p.id === $('productId').value)?.image_path || null; const file = $('pImage').files[0]; if (file) image_path = await upload(file, 'products'); const payload = { name: $('pName').value.trim(), category: $('pCategory').value.trim() || null, price: $('pPrice').value === '' ? null : Number($('pPrice').value), display_order: Number($('pOrder').value) || 0, description: $('pDescription').value, is_published: $('pPublished').checked, image_path }; const id = $('productId').value; const { error } = await (id ? supabase.from('products').update(payload).eq('id', id) : supabase.from('products').insert(payload)); if (error) throw error; $('productForm').reset(); $('productId').value = ''; $('pPublished').checked = true; await loadProducts(); say('Product saved successfully.'); } catch (err) { say(err.message, 1); } };
$('serviceForm').onsubmit = async e => { e.preventDefault(); try { let image_path = services.find(s => s.id === $('serviceId').value)?.image_path || null; const file = $('sImage').files[0]; if (file) image_path = await upload(file, 'services'); const payload = { name: $('sName').value.trim(), description: $('sDescription').value, display_order: Number($('sOrder').value) || 0, is_published: $('sPublished').checked, image_path }; const id = $('serviceId').value; const { error } = await (id ? supabase.from('services').update(payload).eq('id', id) : supabase.from('services').insert(payload)); if (error) throw error; $('serviceForm').reset(); $('serviceId').value = ''; $('sPublished').checked = true; await loadServices(); say('Service saved successfully.'); } catch (err) { say(err.message, 1); } };
$('clearProduct').onclick = () => { $('productForm').reset(); $('productId').value = ''; $('pPublished').checked = true; };
$('clearService').onclick = () => { $('serviceForm').reset(); $('serviceId').value = ''; $('sPublished').checked = true; };

document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.editP) { const p = products.find(x => x.id === b.dataset.editP); $('productId').value = p.id; $('pName').value = p.name; $('pCategory').value = p.category || ''; $('pPrice').value = p.price ?? ''; $('pOrder').value = p.display_order; $('pDescription').value = p.description || ''; $('pPublished').checked = p.is_published; showTab('products'); window.scrollTo(0, 0); }
    if (b.dataset.delP && confirm('Delete this product?')) { const { error } = await supabase.from('products').delete().eq('id', b.dataset.delP); if (error) throw error; await loadProducts(); say('Product deleted.'); }
    if (b.dataset.editS) { const s = services.find(x => x.id === b.dataset.editS); $('serviceId').value = s.id; $('sName').value = s.name; $('sOrder').value = s.display_order; $('sDescription').value = s.description || ''; $('sPublished').checked = s.is_published; showTab('services'); window.scrollTo(0, 0); }
    if (b.dataset.delS && confirm('Delete this service?')) { const { error } = await supabase.from('services').delete().eq('id', b.dataset.delS); if (error) throw error; await loadServices(); say('Service deleted.'); }
    if (b.dataset.approve || b.dataset.unapprove) { const { error } = await supabase.from('reviews').update({ is_approved: !!b.dataset.approve }).eq('id', b.dataset.approve || b.dataset.unapprove); if (error) throw error; await loadReviews(); say('Review status updated.'); }
    if (b.dataset.delR && confirm('Delete this review?')) { const { error } = await supabase.from('reviews').delete().eq('id', b.dataset.delR); if (error) throw error; await loadReviews(); say('Review deleted.'); }
  } catch (err) { say(err.message, 1); }
});
document.addEventListener('change', async e => { const id = e.target.dataset.msgStatus; if (!id) return; const { error } = await supabase.from('contact_messages').update({ status: e.target.value }).eq('id', id); say(error ? error.message : 'Message status updated.', !!error); });
