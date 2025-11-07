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
  const tabs = document.querySelectorAll('.tab');
  const panes = {
    releases: document.getElementById('pane-releases'),
    art: document.getElementById('pane-art')
  };
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      Object.values(panes).forEach(p => p.classList.remove('is-active'));
      panes[btn.dataset.tab]?.classList.add('is-active');
    });
  });
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

// 5) Art auto-orientation (per-card CSS vars)
(function(){
  document.querySelectorAll('#pane-art .card .folder img').forEach(img => {
    const ready = () => {
      const landscape = img.naturalWidth > img.naturalHeight;
      const card = img.closest('.card');
      if (!card) return;
      card.style.setProperty('--card-w', landscape ? '880px' : '340px');
      card.style.setProperty('--card-h', landscape ? '340px' : '880px');
    };
    if (img.complete) ready(); else img.addEventListener('load', ready);
  });
})();
