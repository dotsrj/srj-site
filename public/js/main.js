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

  const dock = document.getElementById('release-inline-player');

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

    // dock only when releases is active
    if (dock) {
      dock.hidden = name !== 'releases';
    }
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

  const initial = tabs.find(b => b.classList.contains('is-active'))?.dataset.tab || 'releases';
  activate(initial);
})();

// 4) Releases → folder tree + inline player + real waveform + playlist controls
(function(){
  const pane  = document.getElementById('pane-releases');
  if (!pane) return;

  const dock       = document.getElementById('release-inline-player');
  const audio      = document.getElementById('rip-audio');
  const label      = document.getElementById('rip-label');
  const wave       = document.getElementById('rip-wave');
  const waveProg   = document.getElementById('rip-wave-progress');
  const waveCanvas = document.getElementById('rip-wave-canvas');
  const waveCtx    = waveCanvas ? waveCanvas.getContext('2d') : null;
  const btnPrev    = document.getElementById('rip-prev');
  const btnToggle  = document.getElementById('rip-toggle');
  const btnNext    = document.getElementById('rip-next');

  const AudioCtx = window.AudioContext || window.webkitAudioContext || null;
  const audioCtx = AudioCtx ? new AudioCtx() : null;

  let trackList = [];
  let currentIndex = -1;
  let waveformPreloaded = false;

  // Cache of peaks per src
  const peakCache = new Map();
  let currentPeaks = null;

  function buildTrackList(){
    // Use the "\ play" chips as the canonical list so order is stable
    trackList = Array.from(pane.querySelectorAll('.track-play'));
  }

  function setPlayingVisual(isPlaying){
    if (!dock || !btnToggle) return;
    dock.classList.toggle('is-playing', isPlaying);
    btnToggle.textContent = isPlaying ? 'pause' : 'play';
    btnToggle.setAttribute('aria-pressed', String(isPlaying));
  }

  function updateWaveformProgress(){
    if (!audio || !waveProg) return;
    const dur = audio.duration;
    if (!dur || !isFinite(dur) || dur <= 0) {
      waveProg.style.width = '0%';
      return;
    }
    const pct = Math.max(0, Math.min(1, audio.currentTime / dur)) * 100;
    waveProg.style.width = pct + '%';
  }

  function drawPeaks(peaks){
    if (!wave || !waveCanvas || !waveCtx || !peaks || !peaks.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = wave.getBoundingClientRect();
    const width = Math.max(10, rect.width) * dpr;
    const height = Math.max(10, rect.height) * dpr;

    waveCanvas.width = width;
    waveCanvas.height = height;
    waveCanvas.style.width = rect.width + 'px';
    waveCanvas.style.height = rect.height + 'px';

    waveCtx.clearRect(0, 0, width, height);

    const barCount = peaks.length;
    const barWidth = width / barCount;
    const midY = height / 2;
    const maxBarHeight = height * 0.9;

    waveCtx.fillStyle = 'rgba(180,255,190,0.9)';

    for (let i = 0; i < barCount; i++) {
      const v = peaks[i];
      const h = Math.max(1, v * maxBarHeight);
      const x = i * barWidth;
      const y = midY - h / 2;
      waveCtx.fillRect(x, y, Math.max(1, barWidth * 0.7), h);
    }
  }

  async function computePeaks(src){
    if (!audioCtx || !src) return null;

    if (peakCache.has(src)) {
      return peakCache.get(src);
    }

    try {
      const res = await fetch(src);
      const buf = await res.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(buf);
      const channelData = decoded.getChannelData(0);

      const sampleCount = channelData.length;
      const buckets = 220;
      const samplesPerBucket = Math.max(1, Math.floor(sampleCount / buckets));
      const peaks = new Array(buckets);
      let globalMax = 0;

      for (let i = 0; i < buckets; i++) {
        const start = i * samplesPerBucket;
        const end = Math.min(start + samplesPerBucket, sampleCount);
        let peak = 0;
        for (let j = start; j < end; j++) {
          const v = Math.abs(channelData[j]);
          if (v > peak) peak = v;
        }
        peaks[i] = peak;
        if (peak > globalMax) globalMax = peak;
      }

      if (globalMax > 0) {
        for (let i = 0; i < peaks.length; i++) {
          peaks[i] = peaks[i] / globalMax;
        }
      }

      peakCache.set(src, peaks);
      return peaks;
    } catch (err) {
      console.error('waveform decode failed', err);
      return null;
    }
  }

  async function ensurePeaksForSrc(src){
    if (!src) return;
    const peaks = await computePeaks(src);
    if (!peaks) return;
    currentPeaks = peaks;
    drawPeaks(peaks);
  }

  // Pre-draw waveform for the first track without touching audio.src
  function preloadFirstWaveform(){
    if (waveformPreloaded) return;
    if (!trackList.length) buildTrackList();
    if (!trackList.length) return;

    const firstBtn = trackList[0];
    if (!firstBtn) return;

    const src = firstBtn.dataset.src;
    if (!src) return;

    waveformPreloaded = true;
    ensurePeaksForSrc(src).catch(() => {});
  }

  function mountPlayerFromSrc(src, title){
    if (!audio || !dock || !label || !src) return;

    audio.src = src;
    label.textContent = title || (src.split('/').pop() || 'audio');
    if (waveProg) waveProg.style.width = '0%';

    // Kick off waveform computation (doesn't block playback)
    ensurePeaksForSrc(src).catch(() => {});

    audio.play().then(() => {
      setPlayingVisual(true);
    }).catch(() => {
      setPlayingVisual(false);
    });
  }

  function playIndex(idx){
    if (!trackList.length) buildTrackList();
    if (!trackList.length) return;

    const max = trackList.length;

    // wrap indices
    if (idx < 0) idx = max - 1;
    if (idx >= max) idx = 0;

    const btn = trackList[idx];
    if (!btn) return;

    currentIndex = idx;
    const src   = btn.dataset.src;
    const title = btn.dataset.title || '';
    if (src) mountPlayerFromSrc(src, title);
  }

  function playFirstIfNeeded(){
    if (!trackList.length) buildTrackList();
    if (!trackList.length) return;

    if (currentIndex === -1 || !audio || !audio.src) {
      playIndex(0);
    } else if (audio.paused) {
      audio.play().catch(() => {});
    }
  }

  // Waveform → seek
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

    audio.addEventListener('timeupdate', updateWaveformProgress);
    audio.addEventListener('loadedmetadata', updateWaveformProgress);
    audio.addEventListener('seeked', updateWaveformProgress);

    audio.addEventListener('play', () => setPlayingVisual(true));
    audio.addEventListener('pause', () => setPlayingVisual(false));

    // Autoplay next track when one finishes (loops through all tracks)
    audio.addEventListener('ended', () => {
      setPlayingVisual(false);
      updateWaveformProgress();
      if (!trackList.length) buildTrackList();
      if (!trackList.length) return;
      const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;
      playIndex(nextIndex);
    });
  }

  // Playback chips
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      if (!audio) return;

      // If nothing has ever been picked, start first track in tree
      if (!audio.src) {
        playFirstIfNeeded();
        return;
      }

      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (!trackList.length) buildTrackList();
      if (!trackList.length) return;

      const nextIndex = currentIndex === -1 ? 0 : currentIndex - 1;
      playIndex(nextIndex);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!trackList.length) buildTrackList();
      if (!trackList.length) return;

      const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;
      playIndex(nextIndex);
    });
  }

  // Redraw peaks on resize
  window.addEventListener('resize', () => {
    if (currentPeaks) {
      drawPeaks(currentPeaks);
    }
  });

  // Helper: scroll newly opened folder into view if it's clipped
  function ensureFolderVisible(node){
    if (!node || !pane) return;

    requestAnimationFrame(() => {
      const containerRect = pane.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const overflowBottom = nodeRect.bottom - containerRect.bottom;

      if (overflowBottom > 0) {
        pane.scrollBy({
          top: overflowBottom + 12,
          left: 0,
          behavior: 'smooth'
        });
      }
    });
  }

  // Toggle folders + click-to-play
  pane.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-toggle');
    if (toggle) {
      const node     = toggle.closest('.tree-node');
      const contents = toggle.parentElement?.querySelector(':scope > .tree-contents');
      const glyph    = toggle.querySelector('.tree-glyph');
      if (!contents) return;

      const willOpen = contents.hasAttribute('hidden');
      contents.hidden = !willOpen;
      toggle.setAttribute('aria-expanded', String(willOpen));
      if (glyph) glyph.textContent = willOpen ? '▾' : '▸';

      if (willOpen && node) {
        ensureFolderVisible(node);
      }
      return;
    }

    // Any element that can play audio: track title, '\ play' button, or cover
    const playBtn = e.target.closest('.track-play, .track-playlink');
    if (playBtn) {
      const src   = playBtn.dataset.src;
      const title = playBtn.dataset.title || '';
      if (!src) return;

      // Sync playlist index with this src
      if (!trackList.length) buildTrackList();
      const idx = trackList.findIndex(btn => btn.dataset.src === src);
      if (idx !== -1) currentIndex = idx;

      mountPlayerFromSrc(src, title);
      return;
    }

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

  // Keyboard support: toggle & play via Enter / Space
  pane.addEventListener('keydown', (e) => {
    const isToggle = e.target.classList?.contains('tree-toggle');
    const isPlay   =
      e.target.classList?.contains('track-playlink') ||
      e.target.classList?.contains('track-play');

    if (isToggle && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.target.click();
    }

    if (isPlay && e.key === 'Enter') {
      e.preventDefault();
      e.target.click();
    }
  });

  // Auto-expand the first release folder on initial load
  const firstToggle = pane.querySelector('.tree-node .tree-toggle');
  if (firstToggle) {
    const contents = firstToggle.parentElement.querySelector(':scope > .tree-contents');
    const glyph    = firstToggle.querySelector('.tree-glyph');

    if (contents) {
      contents.hidden = false;
      firstToggle.setAttribute('aria-expanded', 'true');
      if (glyph) glyph.textContent = '▾';
    }
  }

  // Pre-draw waveform for the very first track in the release tree
  preloadFirstWaveform();
})();


// 5) Entry log typewriter (entries type, but DO NOT auto-scroll to bottom)
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
      if (i <= text.length) {
        setTimeout(tick, SPEED_MS);
      }
    })();
  });
})();

// 6) Log images: double-tap/double-click to open fullscreen modal
(function(){
  const modal    = document.getElementById('art-modal');
  const modalImg = document.getElementById('art-modal-img');
  if (!modal || !modalImg) return;

  const imgs = Array.from(document.querySelectorAll('.log-entry img'));
  if (!imgs.length) return;

  let lastClickTime = 0;
  let lastTarget = null;
  const DOUBLE_MS = 280;

  function openImage(img){
    modalImg.src = img.src;
    modalImg.alt = img.alt || 'log entry image';
    modal.hidden = false;
    modal.classList.remove('is-closing');
    modal.classList.add('is-open');
  }

  imgs.forEach(img => {
    img.addEventListener('click', () => {
      const now = Date.now();
      if (lastTarget === img && (now - lastClickTime) < DOUBLE_MS) {
        openImage(img);
      }
      lastClickTime = now;
      lastTarget = img;
    });
  });

  // Extra ESC handler so ESC also closes when opened from log
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      modal.classList.remove('is-open');
      modal.classList.add('is-closing');
      setTimeout(() => {
        if (!modal.classList.contains('is-open')) {
          modal.hidden = true;
          modal.classList.remove('is-closing');
        }
      }, 200);
    }
  });
})();

// 7) Art gallery: main image + thumbnail grid + fullscreen modal
(function(){
  const mainImg = document.getElementById('art-main');
  const metaBox = document.getElementById('art-meta');
  const thumbs  = Array.from(document.querySelectorAll('#pane-art .thumb'));
  if (!mainImg || !thumbs.length) return;

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
      mainImg.style.opacity = '0';
      mainImg.addEventListener('load', () => {
        mainImg.style.opacity = '1';
      }, { once: true });
      mainImg.src = src;
    }

    mainImg.alt = `${title} image`;
    mainImg.dataset.index = String(i);

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

    thumbs.forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected','false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected','true');
  }

  thumbs.forEach((btn, i) => {
    btn.addEventListener('click', () => setActive(i));
  });

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

    setTimeout(() => {
      if (!modalOpen) {
        modal.hidden = true;
        modal.classList.remove('is-closing');
      }
    }, 200);
  }

  if (modal){
    if (modalBackdrop){
      modalBackdrop.addEventListener('click', closeModal);
    }
    if (modalClose){
      modalClose.addEventListener('click', closeModal);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOpen) {
        e.preventDefault();
        closeModal();
      }
    });
  }

  mainImg.addEventListener('click', () => {
    openModal(currentIndex);
  });

  const initialTitleEl = metaBox?.querySelector('.gallery__title');
  if (initialTitleEl) {
    typeText(initialTitleEl, initialTitleEl.textContent || '', 18);
  }

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
