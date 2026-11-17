import { supabase, escapeHTML, mediaUrl } from './supabase-client.js';

async function loadProducts() {
  const grid = document.querySelector('.product-grid');
  if (!grid) return;
  const { data, error } = await supabase.from('products').select('*').eq('is_published', true).order('display_order').order('created_at', {ascending:false});
  if (error || !data?.length) return;
  const dynamic = document.createElement('section');
  dynamic.className = 'section live-products';
  dynamic.innerHTML = `<h2>Latest Jewellery</h2><p class="intro">Explore our latest additions.</p><div class="product-grid live-product-grid"></div>`;
  const target = dynamic.querySelector('.live-product-grid');
  target.innerHTML = data.map(p => `<article class="product-card">
    <div class="product-photo">${p.image_path ? `<img src="${mediaUrl(p.image_path)}" alt="${escapeHTML(p.name)}">` : '<span>JS Jewellery</span>'}</div>
    <div class="product-info"><h3>${escapeHTML(p.name)}</h3>${p.category ? `<span>${escapeHTML(p.category)}</span>` : ''}<p>${escapeHTML(p.description||'')}</p>${p.price != null ? `<p><strong>Rs. ${Number(p.price).toLocaleString('en-PK')}</strong></p>`:''}</div></article>`).join('');
  const cta = document.querySelector('.collection-cta');
  (cta || grid.parentElement).before(dynamic);
}
async function loadServices() {
  const grid = document.querySelector('.service-grid');
  if (!grid || location.pathname.endsWith('collection.html')) return;
  const { data, error } = await supabase.from('services').select('*').eq('is_published', true).order('display_order').order('created_at',{ascending:false});
  if (error || !data?.length) return;
  const section = document.createElement('section');
  section.className = 'section live-services';
  section.innerHTML = `<h2>Our Updated Services</h2><div class="service-grid"></div>`;
  section.querySelector('.service-grid').innerHTML = data.map(s => `<article class="service-card"><div class="card-top"></div>${s.image_path ? `<img src="${mediaUrl(s.image_path)}" alt="${escapeHTML(s.name)}" style="width:100%;max-height:220px;object-fit:cover">`:''}<div class="card-body"><h3>${escapeHTML(s.name)}</h3><p>${escapeHTML(s.description||'')}</p></div></article>`).join('');
  const cta = document.querySelector('.cta');
  (cta || grid.parentElement).before(section);
}
async function setupContact() {
  const form = document.querySelector('#contactForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const b = form.querySelector('[type=submit]'); const old = b.textContent; b.disabled = true; b.textContent = 'Sending...';
    const f = new FormData(form);
    const { error } = await supabase.from('contact_messages').insert({
      name: f.get('name')?.trim(), phone: f.get('phone')?.trim(),
      subject: f.get('subject')?.trim() || '', message: f.get('message')?.trim()
    });
    b.disabled = false; b.textContent = old;
    if (error) { alert('Message could not be saved. Please try again or contact us on WhatsApp.'); return; }
    alert('Thank you! Your message has been received.');
    form.reset();
  });
}
async function setupReviews() {
  const form = document.querySelector('#reviewForm');
  const { data } = await supabase.from('reviews').select('customer_name,rating,review_text,created_at').eq('is_approved',true).order('created_at',{ascending:false}).limit(30);
  if (form && data?.length) {
    const box = document.createElement('section'); box.className='approved-reviews';
    box.style.cssText='max-width:1120px;margin:35px auto;padding:20px';
    box.innerHTML='<h2>Customer Reviews</h2><div class="approved-review-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px"></div>';
    box.querySelector('div').innerHTML=data.map(r=>`<article style="background:#fff;padding:18px;border:1px solid #e7dcc3"><strong>${escapeHTML(r.customer_name)}</strong><p style="color:#b08d35">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</p><p>${escapeHTML(r.review_text)}</p></article>`).join('');
    form.closest('.panel')?.before(box) || form.before(box);
  }
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const b=form.querySelector('[type=submit]'); const old=b.textContent; b.disabled=true; b.textContent='Submitting...';
    const f=new FormData(form); const rating=parseInt(String(f.get('rating')).split(' ')[0],10);
    const {error}=await supabase.from('reviews').insert({customer_name:f.get('name')?.trim(),rating,review_text:f.get('review')?.trim(),is_approved:false});
    b.disabled=false; b.textContent=old;
    if(error){alert('Review could not be submitted. Please try again.');return;}
    alert('Thank you! Your review has been submitted and will appear after approval.');
    form.reset();
  });
}
async function loadContent() {
  const C = window.JSCMS; if (!C) return;
  try {
    const { data, error } = await supabase.from('site_content').select('kind,key,orig,value').eq('page', C.pageName());
    if (error || !data) return;
    C.writeCache(data); C.apply(data);
  } catch (e) {}
}
// Page-editor preview (admin) loads pages with ?cmsraw=1: leave them untouched so edit positions stay exact.
if (!(window.JSCMS && window.JSCMS.raw)) {
  await loadContent();   // text/image/link edits first, then dynamic products/services/reviews
  loadProducts(); loadServices(); setupContact(); setupReviews();
}
