// ============================================================
// ORTHOBOARD — AI TREATMENT PREVIEW (front-end)
// Self-contained: one file, no dependencies.
// Usage:  OrthoAI.open({ src: photo.src, onSave: (src, meta) => { ... } })
// ============================================================
(function () {
  'use strict';

  // ── Settings ──────────────────────────────────────────────
  const CONFIG = {
    // Paste your Firebase Function URL here after deploying (see SETUP.md)
    endpoint: 'https://europe-west1-YOUR-PROJECT-ID.cloudfunctions.net/aiTreatmentPreview',
    maxSide: 1536,          // photo is resized to this before sending
    accessKeyStore: 'orthoboard-ai-access-code',
    disclaimerTitle: 'AI Treatment Visualization',
    disclaimer: 'This image is an AI-generated approximation for patient communication and is not a clinically exact prediction or guarantee of treatment outcome.',
    consentText: 'Patient consent for AI treatment visualization has been obtained.',
    watermark: 'AI SIMULATION · not a guaranteed outcome',
  };

  // ── Small helpers ─────────────────────────────────────────
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const loadImage = (src) => new Promise((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = bad;
    i.src = src;
  });
  const store = {
    get: () => { try { return localStorage.getItem(CONFIG.accessKeyStore) || ''; } catch { return ''; } },
    set: (v) => { try { localStorage.setItem(CONFIG.accessKeyStore, v); } catch {} },
  };

  // Redraw on a canvas → removes all hidden data (date, device, GPS) and resizes
  const cleanPhoto = async (src) => {
    const img = await loadImage(src);
    const scale = Math.min(1, CONFIG.maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  };

  // Stamp "AI SIMULATION" onto the generated image itself
  const addWatermark = async (src) => {
    const img = await loadImage(src);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const fs = Math.max(12, Math.round(img.width * 0.022));
    ctx.font = `600 ${fs}px Geist, system-ui, -apple-system, sans-serif`;
    const pad = fs * 0.6;
    const w = ctx.measureText(CONFIG.watermark).width + pad * 2;
    const h = fs + pad * 1.4;
    const x = fs, y = img.height - h - fs;
    ctx.fillStyle = 'rgba(10,10,10,0.62)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, h / 2) : ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(CONFIG.watermark, x + pad, y + h / 2 + 1);
    return c.toDataURL('image/jpeg', 0.92);
  };

  // ── Styles (injected once) ────────────────────────────────
  const CSS = `
  .oai-back{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;
    background:rgba(10,10,10,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
    font-family:'Geist',system-ui,-apple-system,sans-serif;animation:oai-fade .18s ease}
  .oai-card{width:100%;max-width:880px;max-height:calc(100dvh - 32px);overflow:auto;border-radius:20px;
    background:#fff;color:#171717;border:1px solid #e5e5e5;box-shadow:0 30px 80px -20px rgba(0,0,0,.45)}
  body.dark .oai-card{background:#171717;color:#f5f5f5;border-color:#262626}
  .oai-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 6px}
  .oai-title{display:flex;align-items:center;gap:10px;font-weight:600;font-size:17px;letter-spacing:-.01em}
  .oai-badge{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:3px 8px;border-radius:99px;
    background:rgba(57,191,240,.12);color:#0e8fc0}
  body.dark .oai-badge{color:#7dd3f5}
  .oai-x{width:34px;height:34px;border-radius:10px;border:0;background:transparent;color:inherit;opacity:.55;cursor:pointer;font-size:20px}
  .oai-x:hover{opacity:1;background:rgba(127,127,127,.12)}
  .oai-body{padding:10px 22px 22px}
  .oai-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .oai-grid.one{grid-template-columns:1fr;max-width:460px;margin:0 auto}
  .oai-pane{position:relative;border-radius:14px;overflow:hidden;background:#f5f5f4;aspect-ratio:4/3;
    display:flex;align-items:center;justify-content:center}
  body.dark .oai-pane{background:#0a0a0a}
  .oai-pane img{width:100%;height:100%;object-fit:contain;display:block}
  .oai-tag{position:absolute;top:10px;left:10px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;
    padding:4px 9px;border-radius:99px;background:rgba(255,255,255,.88);color:#171717}
  .oai-tag.after{background:#39bff0;color:#fff}
  .oai-spin{width:34px;height:34px;border-radius:50%;border:2.5px solid #39bff0;border-top-color:transparent;animation:oai-rot .8s linear infinite}
  .oai-wait{display:flex;flex-direction:column;align-items:center;gap:12px;font-size:12.5px;opacity:.75;text-align:center;padding:0 16px}
  .oai-note{margin-top:14px;padding:12px 14px;border-radius:12px;font-size:12px;line-height:1.55;
    background:#fffbeb;border:1px solid #fde68a;color:#78350f}
  body.dark .oai-note{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.25);color:#fcd34d}
  .oai-note b{display:block;font-size:12.5px;margin-bottom:2px}
  .oai-consent{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px 14px;border-radius:12px;cursor:pointer;
    border:1px solid #e5e5e5;font-size:13px;line-height:1.45;user-select:none}
  body.dark .oai-consent{border-color:#262626}
  .oai-consent input{width:17px;height:17px;margin-top:1px;accent-color:#39bff0;flex-shrink:0;cursor:pointer}
  .oai-key{display:flex;gap:8px;align-items:center;margin-top:12px;font-size:12px}
  .oai-key input{flex:1;padding:9px 11px;border-radius:10px;border:1px solid #d4d4d4;background:transparent;color:inherit;
    font-size:13px;outline:none;-webkit-user-select:text;user-select:text}
  body.dark .oai-key input{border-color:#404040}
  .oai-key input:focus{border-color:#39bff0}
  .oai-link{background:none;border:0;color:#0e8fc0;font-size:11.5px;cursor:pointer;padding:0;margin-top:8px}
  .oai-err{margin-top:12px;padding:10px 14px;border-radius:12px;font-size:12.5px;background:rgba(239,68,68,.08);
    border:1px solid rgba(239,68,68,.25);color:#dc2626}
  .oai-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}
  .oai-btn{padding:10px 18px;border-radius:12px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;
    font-family:inherit;transition:opacity .15s,background .15s}
  .oai-btn:disabled{opacity:.35;cursor:not-allowed}
  .oai-ghost{background:transparent;color:inherit;border-color:#e5e5e5}
  body.dark .oai-ghost{border-color:#333}
  .oai-ghost:hover:not(:disabled){background:rgba(127,127,127,.08)}
  .oai-main{background:#171717;color:#fff}
  body.dark .oai-main{background:#f5f5f5;color:#171717}
  .oai-accent{background:linear-gradient(135deg,#39bff0,#0ea5e9);color:#fff;box-shadow:0 8px 22px -10px rgba(14,165,233,.7)}
  @keyframes oai-rot{to{transform:rotate(360deg)}}
  @keyframes oai-fade{from{opacity:0}}
  @media (max-width:640px){.oai-grid{grid-template-columns:1fr}}`;

  const injectCSS = () => {
    if (document.getElementById('oai-css')) return;
    const s = el('style'); s.id = 'oai-css'; s.textContent = CSS;
    document.head.appendChild(s);
  };

  // ── Main: open the modal ──────────────────────────────────
  function open({ src, onSave }) {
    injectCSS();
    const state = { step: 'start', consent: false, consentAt: null, result: null, meta: null, error: '' };
    let busy = false;

    const back = el('div', 'oai-back');
    const card = el('div', 'oai-card');
    back.appendChild(card);
    document.body.appendChild(back);

    const close = () => { document.removeEventListener('keydown', onKey); back.remove(); };
    const onKey = (e) => { if (e.key === 'Escape' && !busy) close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('pointerdown', (e) => { if (e.target === back && !busy) close(); });

    const generate = async () => {
      const key = store.get();
      if (!key) { state.error = 'Enter the clinic access code first.'; return render(); }
      busy = true; state.step = 'loading'; state.error = ''; render();
      try {
        const image = await cleanPhoto(src);
        const r = await fetch(CONFIG.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-orthoboard-key': key },
          body: JSON.stringify({ image, consent: true }),
        });
        const json = await r.json().catch(() => ({}));
        if (r.status === 401) store.set(''); // wrong code → ask again
        if (!r.ok) throw new Error(json.error || `Server error (${r.status})`);
        state.result = await addWatermark(json.image);
        state.meta = {
          aiSimulation: true,
          consentAt: state.consentAt,
          generatedAt: json.createdAt || new Date().toISOString(),
          model: json.model || '',
        };
        state.step = 'result';
      } catch (err) {
        state.error = err.message === 'Failed to fetch'
          ? 'Could not reach the AI server. Check your connection or the endpoint setting.'
          : err.message;
        state.step = 'start';
      }
      busy = false; render();
    };

    function render() {
      card.innerHTML = '';

      // Header
      const head = el('div', 'oai-head');
      head.append(
        el('div', 'oai-title', `AI Treatment Preview <span class="oai-badge">Simulation</span>`),
      );
      const x = el('button', 'oai-x', '×');
      x.title = 'Close';
      x.onclick = () => { if (!busy) close(); };
      head.appendChild(x);
      card.appendChild(head);

      const body = el('div', 'oai-body');
      card.appendChild(body);

      // Images
      const grid = el('div', state.step === 'start' ? 'oai-grid one' : 'oai-grid');
      const before = el('div', 'oai-pane');
      before.append(el('img'), el('span', 'oai-tag', 'Before'));
      before.querySelector('img').src = src;
      grid.appendChild(before);

      if (state.step === 'loading') {
        const wait = el('div', 'oai-pane');
        wait.appendChild(el('div', 'oai-wait', '<div class="oai-spin"></div>Generating preview…<br>This can take up to a minute.'));
        grid.appendChild(wait);
      }
      if (state.step === 'result') {
        const after = el('div', 'oai-pane');
        after.append(el('img'), el('span', 'oai-tag after', 'After · AI'));
        after.querySelector('img').src = state.result;
        grid.appendChild(after);
      }
      body.appendChild(grid);

      // Disclaimer (always visible)
      body.appendChild(el('div', 'oai-note', `<b>${CONFIG.disclaimerTitle}</b>${CONFIG.disclaimer}`));

      // Start step: consent + access code
      if (state.step === 'start') {
        const label = el('label', 'oai-consent');
        const box = el('input'); box.type = 'checkbox'; box.checked = state.consent;
        box.onchange = () => {
          state.consent = box.checked;
          state.consentAt = box.checked ? new Date().toISOString() : null;
          genBtn.disabled = !state.consent;
        };
        label.append(box, el('span', '', CONFIG.consentText));
        body.appendChild(label);

        if (!store.get()) {
          const row = el('div', 'oai-key');
          const inp = el('input'); inp.type = 'password'; inp.placeholder = 'Clinic access code';
          inp.oninput = () => store.set(inp.value.trim());
          row.appendChild(inp);
          body.appendChild(row);
        } else {
          const change = el('button', 'oai-link', 'Change access code');
          change.onclick = () => { store.set(''); render(); };
          body.appendChild(change);
        }
      }

      if (state.error) body.appendChild(el('div', 'oai-err', state.error));

      // Buttons
      const foot = el('div', 'oai-foot');
      let genBtn;
      if (state.step === 'start') {
        const cancel = el('button', 'oai-btn oai-ghost', 'Cancel'); cancel.onclick = close;
        genBtn = el('button', 'oai-btn oai-accent', 'Generate');
        genBtn.disabled = !state.consent;
        genBtn.onclick = generate;
        foot.append(cancel, genBtn);
      }
      if (state.step === 'loading') {
        const wait = el('button', 'oai-btn oai-ghost', 'Please wait…'); wait.disabled = true;
        foot.appendChild(wait);
      }
      if (state.step === 'result') {
        const discard = el('button', 'oai-btn oai-ghost', 'Discard'); discard.onclick = close;
        const again = el('button', 'oai-btn oai-ghost', 'Try again'); again.onclick = generate;
        const save = el('button', 'oai-btn oai-main', 'Save to board');
        save.onclick = () => { if (onSave) onSave(state.result, state.meta); close(); };
        foot.append(discard, again, save);
      }
      body.appendChild(foot);
    }

    // Typing in the modal must not trigger whiteboard shortcuts (Esc still closes)
    card.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });

    render();
  }

  window.OrthoAI = { open, CONFIG };
})();
