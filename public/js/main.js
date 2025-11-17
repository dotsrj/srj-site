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

// 1) Keyboard nudge for horizontal carousels (if any)
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

    // announce activation (if needed elsewhere)
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

// 4) Releases → folder tree + inline player
(function(){
  const pane = document.getElementById('pane-releases');
  if (!pane) return;

  // A) Toggle folders (use :scope to target only this node's contents)
  pane.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-toggle');
    if (!toggle) return;

    const contents = toggle.parentElement?.querySelector(':scope > .tree-contents');
    const glyph    = toggle.querySelector('.tree-glyph');
    if (!contents) return;

    const willOpen = contents.hasAttribute('hidden');
    contents.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    if (glyph) glyph.textContent = willOpen ? '▾' : '▸';
  });

  // B) Shared inline player dock
  const dock  = document.getElementById('release-inline-player');
  const audio = document.getElementById('rip-audio');
  const label = document.getElementById('rip-label');

  function mountPlayer(afterEl, src, title){
    if (!dock || !audio || !label || !src) return;

    // Set audio + label
    audio.src = src;
    label.textContent = title || (src.split('/').pop() || 'audio');

    // Move dock right after the clicked <li> (or element itself)
    const hostLi = afterEl.closest('li') || afterEl;
    hostLi.insertAdjacentElement('afterend', dock);

    // Show dock (CSS keeps it visually pinned at bottom of pane)
    dock.hidden = false;

    // Try to play — user gesture might be required, controls stay visible
    audio.play().catch(() => {});
  }

  // C) Click handling for play / cover
  pane.addEventListener('click', async (e) => {
    // Any element that can play audio: track title, 'play' button, or cover with .track-play
    const playBtn = e.target.closest('.track-play, .track-playlink');
    if (playBtn) {
      const src   = playBtn.dataset.src;
      const title = playBtn.dataset.title || '';
      if (src) mountPlayer(playBtn, src, title);
      return;
    }

    // If a cover existed without data-src, fall back to first track in that folder
    const cover = e.target.closest('.tree-cover');
    if (cover && !cover.dataset.src) {
      const node = cover.closest('.tree-node');
      const first =
        node?.querySelector('.tree-tracks .track-playlink') ||
        node?.querySelector('.tree-tracks .track-play');
      if (first) first.click();
      return;
    }
  });

  // D) Keyboard support: toggle & play via Enter / Space
  pane.addEventListener('keydown', (e) => {
    const isToggle = e.target.classList?.contains('tree-toggle');
    const isPlay   = e.target.classList?.contains('track-playlink') || e.target.classList?.contains('track-play');

    // Enter/Space toggles folder open/close
    if (isToggle && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.target.click();
    }

    // Enter plays the track
    if (isPlay && e.key === 'Enter') {
      e.preventDefault();
      e.target.click();
    }
  });
})();

// 6) Entry log typewriter (ALL entries type at once, faster)
(function(){
  const entries = Array.from(document.querySelectorAll('.log-entry'));
  if (!entries.length) return;

  const SPEED_MS = 6;  // much faster per character

  entries.forEach((entry) => {
    const t = entry.querySelector('.typed');
    if (!t) return;

    const text = entry.dataset.text || '';
    t.textContent = '';
    let i = 0;

    (function tick(){
      t.textContent = text.slice(0, i++);

      // keep the log scrolled to bottom while typing
      const list = document.querySelector('.log-list');
      if (list) list.scrollTop = list.scrollHeight;

      if (i <= text.length) {
        setTimeout(tick, SPEED_MS);
      }
    })();
  });
})();

// 7) Art gallery: main image + thumbnail grid + fullscreen modal
(function(){
  const mainImg = document.getElementById('art-main');
  const metaBox = document.getElementById('art-meta');
  const thumbs  = Array.from(document.querySelectorAll('#pane-art .thumb'));

  const modal      = document.getElementById('art-modal');
  const modalImg   = document.getElementById('art-modal-img');
  const modalClose = modal ? modal.querySelector('.modal__close') : null;

  if (!mainImg || !thumbs.length) return;

  function setActive(i){
    const btn = thumbs[i];
    if (!btn) return;
    const src     = btn.dataset.src;
    const title   = btn.dataset.title || '';
    const preview = btn.dataset.preview || '';
    const buy     = btn.dataset.buy || '';

    // fade-out → swap → fade-in
    mainImg.style.opacity = '0';
    mainImg.addEventListener('load', () => { mainImg.style.opacity = '1'; }, { once: true });
    mainImg.src = src;
    mainImg.alt = `${title} image`;
    mainImg.dataset.index = String(i);

    // update meta (title + links)
    if (metaBox){
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
      typeText(titleEl, title, 18);
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

  // type the initial title once
  const initialTitleEl = metaBox?.querySelector('.gallery__title');
  if (initialTitleEl) {
    typeText(initialTitleEl, initialTitleEl.textContent || '', 18);
  }

  // keyboard left/right navigation over thumbs (grid-based, not row-based)
  const listbox = document.querySelector('#pane-art .gallery__thumbgrid');
  if (listbox){
    listbox.addEventListener('keydown', (e) => {
      const idx = parseInt(mainImg.dataset.index || '0', 10);
      if (e.key === 'ArrowRight') { e.preventDefault(); setActive(Math.min(idx+1, thumbs.length-1)); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setActive(Math.max(idx-1, 0)); }
      if (e.key === 'Home')       { e.preventDefault(); setActive(0); }
      if (e.key === 'End')        { e.preventDefault(); setActive(thumbs.length-1); }
    });
  }

  // ===== Fullscreen modal behavior =====
  function openModal(){
    if (!modal || !modalImg) return;
    modalImg.src = mainImg.src;
    modalImg.alt = mainImg.alt || 'art preview';
    modal.hidden = false;
  }

  function closeModal(){
    if (!modal) return;
    modal.hidden = true;
  }

  // Click main image to open modal
  mainImg.addEventListener('click', openModal);

  // Close via X button
  if (modalClose) {
    modalClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
  }

  // Close via backdrop click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal__backdrop')) {
        closeModal();
      }
    });
  }

  // Close via Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });
})();
