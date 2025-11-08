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

    // update meta (title + links)
    if (metaBox){
      metaBox.innerHTML = `
        <strong class="gallery__title">${title}</strong>
        <div class="gallery__links">
          ${preview ? `<a href="${preview}" target="_blank" rel="noopener">preview</a>` : ``}
          ${(preview && buy) ? ' · ' : ``}
          ${buy ? `<a href="${buy}" target="_blank" rel="noopener">buy print</a>` : ``}
        </div>
      `;
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
    // If the pane is hidden, sizes are ~0. Bail out to avoid setting 0px caps.
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
