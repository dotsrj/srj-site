// Simple typewriter for a single element (clears previous text)
function typeText(el, text, speed = 18) {
  if (!el) return;
  el.textContent = '';
  let i = 0;
  (function tick(){
    el.textContent = text.slice(0, i++);
    if (i <= text.length) setTimeout(tick, speed);
  })();
}


// 1) Keyboard nudge for horizontal carousels
(function(){
  const carousels = document.querySelectorAll('.carousel');
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    let root = document.activeElement?.closest?.('.carousel') || carousels[0];
    if (!root) return;
    root.scrollBy({ left: e.key === 'ArrowRight' ? 220 : -220, behavior: 'smooth' });
  });
})();

// 2) Inbox submit to Formspree on Enter
(function () {
  const form = document.getElementById('inbox-form');
  const input = document.getElementById('inbox-input');
  const status = document.getElementById('inbox-status');
  const ENDPOINT = "https://formspree.io/f/xanlrvgq";
  if (!form || !input) return;

  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const message = (input.value || '').trim();
    if (!message) { status.textContent = 'nothing to send.'; return; }
    if (message.length > 144) { status.textContent = 'message too long (max 144).'; return; }

    const fd = new FormData(form);
    fd.set('message', message);
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd });
      status.textContent = res.ok ? 'received' : 'send failed (server).';
      if (res.ok) input.value = '';
    } catch {
      status.textContent = 'send failed (network).';
    }
  });
})();

// 3) Tabs
(function(){
  const tabs = Array.from(document.querySelectorAll('.tab'));
  if (!tabs.length) return;

  const panes = {
    releases: document.getElementById('pane-releases'),
    art: document.getElementById('pane-art')
  };

  function activate(name){
    // tabs
    tabs.forEach(b => {
      const active = b.dataset.tab === name;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });

    // panes
    Object.entries(panes).forEach(([key, el]) => {
      if (!el) return;
      const show = key === name;
      el.classList.toggle('is-active', show);
      el.hidden = !show;
    });

    // announce activation (art pane uses this to refit)
    document.dispatchEvent(new CustomEvent('tab-activated', { detail: { name } }));
  }

  // listeners
  tabs.forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = tabs.indexOf(btn);
      const next = e.key === 'ArrowRight' ? (i+1) % tabs.length : (i-1+tabs.length) % tabs.length;
      tabs[next].focus();
      activate(tabs[next].dataset.tab);
    });
  });

  // initial
  const initial = tabs.find(b => b.classList.contains('is-active'))?.dataset.tab || 'releases';
  activate(initial);
})();


 
// 4) Releases → modal
(function(){
  const modal = document.getElementById('release-modal');
  if (!modal) return;
  const titleEl = document.getElementById('release-modal-title');
  const linksEl = document.getElementById('release-modal-links');
  const closeBtn = document.getElementById('release-modal-close');

  function openModal(data){
    titleEl.textContent = data.title || 'release';
    const rows = [];
    if (data.page) rows.push(`<a href="${data.page}" target="_blank" rel="noopener">release page</a>`);
    if (data.download) rows.push(`<a href="${data.download}" target="_blank" rel="noopener">free download</a>`);
    if (data.vinyl) rows.push(`<a href="${data.vinyl}" target="_blank" rel="noopener">vinyl</a>`);
    if (data.cd) rows.push(`<a href="${data.cd}" target="_blank" rel="noopener">cd</a>`);
    if (data.cassette) rows.push(`<a href="${data.cassette}" target="_blank" rel="noopener">cassette</a>`);
    linksEl.innerHTML = rows.length ? rows.map(r => `<div>${r}</div>`).join('') : '<div>no links available</div>';
    modal.hidden = false; document.body.style.overflow = 'hidden';
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.tree-item');
    if (!btn) return;
    openModal({
      title: btn.dataset.title,
      page: btn.dataset.page,
      download: btn.dataset.download,
      vinyl: btn.dataset.vinyl,
      cd: btn.dataset.cd,
      cassette: btn.dataset.cassette
    });
  });
  function close(){ modal.hidden = true; document.body.style.overflow = ''; }
  document.getElementById('release-modal-close')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target.classList.contains('modal__backdrop')) close(); });
  document.addEventListener('keydown', (e) => { if (!modal.hidden && e.key === 'Escape') close(); });
})();

// 6) Entry log typewriter (types each entry's text, sequentially)
(function(){
  const entries = Array.from(document.querySelectorAll('.log-entry'));
  if (!entries.length) return;

  const SPEED_MS   = 18;   // per character
  const ENTRY_PAUSE= 250;  // after each entry

  // Clear any pre-filled text (we will type it in)
  entries.forEach(e => {
    const t = e.querySelector('.typed');
    if (t) t.textContent = '';
  });

  function typeEntry(idx){
    if (idx >= entries.length) return;
    const el = entries[idx];
    const t  = el.querySelector('.typed');
    if (!t) return typeEntry(idx+1);

    const text = el.dataset.text || '';
    let i = 0;

    function tick(){
      t.textContent = text.slice(0, i++);
      // keep the log scrolled to bottom while typing
      const list = document.querySelector('.log-list');
      if (list) list.scrollTop = list.scrollHeight;

      if (i <= text.length) {
        setTimeout(tick, SPEED_MS);
      } else {
        setTimeout(() => typeEntry(idx+1), ENTRY_PAUSE);
      }
    }
    tick();
  }

  // Start typing from the first visible entry
  typeEntry(0);
})();

// 7) Art gallery: main image + thumbnail strip
(function(){
  const mainImg = document.getElementById('art-main');
  const metaBox = document.getElementById('art-meta');
  const thumbs  = Array.from(document.querySelectorAll('#pane-art .thumb'));
  if (!mainImg || !thumbs.length) return;

    // Toggle fit (letterboxed) vs full (1:1 scrollable) mode
  function setFitMode(full){
    if (full) {
      mainImg.classList.add('is-full');     // CSS will remove max caps
    } else {
      mainImg.classList.remove('is-full');  // back to fit
      // ask the fitter to reapply caps after leaving full mode
      const evt = new CustomEvent('tab-activated', { detail: { name: 'art' }});
      document.dispatchEvent(evt);
    }
  }


  function setActive(i){
    const btn = thumbs[i];
    if (!btn) return;
    const src = btn.dataset.src;
    const title = btn.dataset.title || '';
    const preview = btn.dataset.preview || '';
    const buy = btn.dataset.buy || '';

// inside setActive(i), right before "mainImg.src = src;"
  // fade-out → swap → fade-in
  mainImg.style.opacity = '0';
  mainImg.addEventListener('load', () => { mainImg.style.opacity = '1'; }, { once: true });
  mainImg.src = src;
  mainImg.alt = `${title} image`;
  mainImg.dataset.index = String(i);

    // reset to fit mode on new image (so users don't get stuck zoomed)
    setFitMode(false);

// update meta (title + links) — keep the DOM so we can type into .gallery__title
if (metaBox){
  // ensure children exist (first render already created them)
  let titleEl = metaBox.querySelector('.gallery__title');
  let linksEl = metaBox.querySelector('.gallery__links');
  if (!titleEl) {
    titleEl = document.createElement('strong');
    titleEl.className = 'gallery__title';
    metaBox.appendChild(titleEl);
  }
  if (!linksEl) {
    linksEl = document.createElement('div');
    linksEl.className = 'gallery__links';
    metaBox.appendChild(linksEl);
  }

  // type the title
  typeText(titleEl, title, 18);

  // update links (static)
  const parts = [];
  if (preview) parts.push(`<a href="${preview}" target="_blank" rel="noopener">preview</a>`);
  if (preview && buy) parts.push('·');
  if (buy) parts.push(`<a href="${buy}" target="_blank" rel="noopener">buy print</a>`);
  linksEl.innerHTML = parts.join(' ');
}


    // active styles
    thumbs.forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected','false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected','true');
  }

  // click thumbnails
  thumbs.forEach((btn, i) => {
    btn.addEventListener('click', () => setActive(i));
  });

  // Double-click to toggle fit <-> 1:1
  mainImg.addEventListener('dblclick', () => {
    const full = !mainImg.classList.contains('is-full');
    setFitMode(full);
  });

  // Press "f" to toggle when Art pane is visible
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'f') return;
    const pane = document.getElementById('pane-art');
    if (!pane || pane.hidden) return;
    const full = !mainImg.classList.contains('is-full');
    setFitMode(full);
  });


// type the initial title once
const initialTitleEl = metaBox?.querySelector('.gallery__title');
if (initialTitleEl) {
  typeText(initialTitleEl, initialTitleEl.textContent || '', 18);
}


  // keyboard left/right on the thumbnail strip
  const listbox = document.querySelector('#pane-art .gallery__thumbs');
  if (listbox){
    listbox.addEventListener('keydown', (e) => {
      const idx = parseInt(mainImg.dataset.index || '0', 10);
      if (e.key === 'ArrowRight') { e.preventDefault(); setActive(Math.min(idx+1, thumbs.length-1)); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setActive(Math.max(idx-1, 0)); }
      if (e.key === 'Home')       { e.preventDefault(); setActive(0); }
      if (e.key === 'End')        { e.preventDefault(); setActive(thumbs.length-1); }
    });
  }
})();

// 8) Keep main art image fitted on visible resizes (guarded against hidden panes)
(function(){
  const box = document.querySelector('#pane-art .gallery__main');
  const img = document.getElementById('art-main');
  if (!box || !img) return;

  const pad = 16; // breathing room so borders/rounding don’t clip

  function fit(){
    // If user is in full (1:1) mode, do not clamp sizing
    if (img.classList.contains('is-full')) return;

    const rect = box.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    img.style.maxWidth  = (rect.width  - pad) + 'px';
    img.style.maxHeight = (rect.height - pad) + 'px';
  }


  // Re-fit when:
  window.addEventListener('resize', fit); // window changes
  img.addEventListener('load', fit);      // new image loads

  // when the Art tab is activated
  document.addEventListener('tab-activated', (e) => {
    if (e.detail?.name === 'art') {
      // allow layout to settle
      requestAnimationFrame(() => {
        fit();
        // one extra frame for fonts/scrollbars
        requestAnimationFrame(fit);
      });
    }
  });

  // initial attempt (covers case where Art is initially active)
  requestAnimationFrame(fit);
})();
