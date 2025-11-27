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
  if (!carousels.length) return;

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const root = document.activeElement?.closest?.('.carousel') || carousels[0];
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
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: fd
      });
      status.textContent = res.ok ? 'received' : 'send failed (server).';
      if (res.ok) input.value = '';
    } catch {
      status.textContent = 'send failed (network).';
    }
  });
})();

// 3) Tabs (releases / art)
(function(){
  const tabs = Array.from(document.querySelectorAll('.tab'));
  if (!tabs.length) return;

  const panes = {
    releases: document.getElementById('pane-releases'),
    art:      document.getElementById('pane-art')
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

    // announce activation
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

// 4) Releases → folder tree + inline player + waveform scrubber + auto-scroll-on-open
(function(){
  const pane  = document.getElementById('pane-releases');
  if (!pane) return;

  // helper: when a folder is opened near the bottom, scroll just enough to reveal it
  function ensureFolderVisible(node){
    if (!node || !pane) return;

    // Use requestAnimationFrame so layout is updated after expanding
    requestAnimationFrame(() => {
      const containerRect = pane.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();

      // How much of the node's bottom is cut off relative to the container?
      const overflowBottom = nodeRect.bottom - containerRect.bottom;

      // If overflowBottom > 0, it's clipped. Scroll by that amount plus a small margin.
      if (overflowBottom > 0) {
        const margin = 12; // small breathing room so it isn't glued to the edge
        pane.scrollBy({
          top: overflowBottom + margin,
          left: 0,
          behavior: 'smooth'
        });
      }
    });
  }

  // A) Toggle folders (use :scope to target only this node's contents)
  pane.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-toggle');
    if (!toggle) return;

    const node     = toggle.closest('.tree-node');
    const contents = toggle.parentElement?.querySelector(':scope > .tree-contents');
    const glyph    = toggle.querySelector('.tree-glyph');
    if (!contents) return;

    const willOpen = contents.hasAttribute('hidden');
    contents.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    if (glyph) glyph.textContent = willOpen ? '▾' : '▸';

    // NEW: if we just opened this folder, make sure it isn't clipped at the bottom
    if (willOpen && node) {
      ensureFolderVisible(node);
    }
  });

  // B) Shared inline player dock
  const dock        = document.getElementById('release-inline-player');
  const audio       = document.getElementById('rip-audio');
  const label       = document.getElementById('rip-label');
  const wave        = document.getElementById('rip-wave');
  const waveProg    = document.getElementById('rip-wave-progress');

  function updateWaveform(){
    if (!audio || !wave || !waveProg) return;
    const dur = audio.duration;
    if (!dur || !isFinite(dur) || dur <= 0) {
      waveProg.style.width = '0%';
      return;
    }
    const pct = Math.max(0, Math.min(1, audio.currentTime / dur)) * 100;
    waveProg.style.width = pct + '%';
  }

  function mountPlayer(afterEl, src, title){
    if (!dock || !audio || !label || !src) return;

    // Set audio + label
    audio.src = src;
    label.textContent = title || (src.split('/').pop() || 'audio');

    // Move dock right after the clicked <li> (or element itself)
    const hostLi = afterEl.closest('li') || afterEl;
    hostLi.insertAdjacentElement('afterend', dock);

    // Show dock
    dock.hidden = false;

    // reset waveform
    updateWaveform();

    // Try to play
    audio.play().catch(() => {});
  }

  // C) Waveform click → seek
  if (wave && audio) {
    wave.addEventListener('click', (e) => {
      const rect = wave.getBoundingClientRect();
      if (!rect.width) return;
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const dur = audio.duration;
      if (dur && isFinite(dur) && dur > 0) {
        audio.currentTime = ratio * dur;
      }
    });

    audio.addEventListener('timeupdate', updateWaveform);
    audio.addEventListener('loadedmetadata', updateWaveform);
    audio.addEventListener('play', updateWaveform);
    audio.addEventListener('seeked', updateWaveform);
  }

  // D) Click handling for play / cover
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

  // E) Keyboard support: toggle & play via Enter / Space
  pane.addEventListener('keydown', (e) => {
    const isToggle = e.target.classList?.contains('tree-toggle');
    const isPlay   =
      e.target.classList?.contains('track-playlink') ||
      e.target.classList?.contains('track-play');

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

// 5) Entry log typewriter (entries type, but do NOT auto-scroll to bottom)
(function(){
  const entries = Array.from(document.querySelectorAll('.log-entry'));
  if (!entries.length) return;

  const SPEED_MS = 6;  // fast per character

  entries.forEach((entry) => {
    const t = entry.querySelector('.typed');
    if (!t) return;

    const text = entry.dataset.text || '';
    t.textContent = '';
    let i = 0;

    (function tick(){
      t.textContent = text.slice(0, i++);

      // DO NOT force scroll to bottom; keep user's scroll position
      if (i <= text.length) {
        setTimeout(tick, SPEED_MS);
      }
    })();
  });
})();

// 6) Art gallery: main image + thumbnail grid + fullscreen modal
(function(){
  const mainImg = document.getElementById('art-main');
  const metaBox = document.getElementById('art-meta');
  const thumbs  = Array.from(document.querySelectorAll('#pane-art .thumb'));
  if (!mainImg || !thumbs.length) return;

  // Modal elements (optional — will no-op if not present)
  const modal        = document.getElementById('art-modal');
  const modalImg     = document.getElementById('art-modal-img');
  const modalClose   = modal?.querySelector('.modal__close') || null;
  const modalBackdrop= modal?.querySelector('.modal__backdrop') || null;

  let currentIndex = 0;
  let modalOpen    = false;

  function setActive(i){
    const btn = thumbs[i];
    if (!btn) return;
    const src     = btn.dataset.src;
    const title   = btn.dataset.title || '';
    const preview = btn.dataset.preview || '';
    const buy     = btn.dataset.buy || '';

    currentIndex = i;

    if (src) {
      // fade-out → swap → fade-in
      mainImg.style.opacity = '0';
      mainImg.addEventListener('load', () => {
        mainImg.style.opacity = '1';
      }, { once: true });
      mainImg.src = src;
    }

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

    // active thumb styles
    thumbs.forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected','false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected','true');
  }

  // click thumbnails → change main image
  thumbs.forEach((btn, i) => {
    btn.addEventListener('click', () => setActive(i));
  });

  // Simple fullscreen modal for art
  function openModal(index){
    if (!modal || !modalImg) return;
    const btn = thumbs[index];
    if (!btn) return;
    const src   = btn.dataset.src;
    const title = btn.dataset.title || '';
    if (!src) return;

    modalImg.src = src;
    modalImg.alt = `${title} full preview`;

    modal.hidden = false;
    modal.classList.remove('is-closing');
    modal.classList.add('is-open');
    modalOpen = true;
  }

  function closeModal(){
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.classList.add('is-closing');
    modalOpen = false;

    // after animation, hide
    setTimeout(() => {
      if (!modalOpen) {
        modal.hidden = true;
        modal.classList.remove('is-closing');
      }
    }, 200);
  }

  if (modal){
    // backdrop click
    if (modalBackdrop){
      modalBackdrop.addEventListener('click', closeModal);
    }
    // close button
    if (modalClose){
      modalClose.addEventListener('click', closeModal);
    }
    // ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOpen) {
        e.preventDefault();
        closeModal();
      }
    });
  }

  // click on main preview → open modal
  mainImg.addEventListener('click', () => {
    openModal(currentIndex);
  });

  // type the initial title once (if server-rendered)
  const initialTitleEl = metaBox?.querySelector('.gallery__title');
  if (initialTitleEl) {
    typeText(initialTitleEl, initialTitleEl.textContent || '', 18);
  }

  // keyboard left/right when focus is inside the thumb grid
  const listbox = document.querySelector('#pane-art .gallery__thumbgrid, #pane-art .gallery__thumbs');
  if (listbox){
    listbox.addEventListener('keydown', (e) => {
      const idx = parseInt(mainImg.dataset.index || '0', 10);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActive(Math.min(idx+1, thumbs.length-1));
      }
      if (e.key === 'ArrowLeft')  {
        e.preventDefault();
        setActive(Math.max(idx-1, 0));
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setActive(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        setActive(thumbs.length-1);
      }
    });
  }
})();
