// letters from scorsby: a little window for leaving your name and email, opened by any link to #subscribe.
// it works on every page. the name and email go to the hearth (a cloudflare worker), which keeps them in a small
// database. a quiet check that you're a person (cloudflare turnstile) comes first, once it has a key.
(() => {
  if (window.scorsbyLetters) return;
  window.scorsbyLetters = true;

  // the public half of the turnstile key (the secret half lives only in the worker). empty: no check widget yet.
  const SITEKEY = '';
  const meta = document.querySelector('meta[name="hearth"]')?.content;
  const ENDPOINT = location.port === '8787' ? '/subscribe'
    : (meta ? meta.replace(/^ws/, 'http').replace(/\/hearth$/, '/subscribe') : 'https://scorsby-hearth.samrobertsbaca.workers.dev/subscribe');

  const css = `
  #letters { position: fixed; z-index: 1000; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(360px, calc(100vw - 32px));
    background: #fff; color: #1d1a5e; border: 1px solid #1d1a5e; box-shadow: 4px 4px 0 #1d1a5e; font-family: inherit; }
  #letters[hidden], #letters [hidden] { display: none !important; }
  #letters .bar { display: flex; justify-content: space-between; align-items: center; background: #1d1a5e; color: #fff;
    font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 3px 4px 3px 8px; }
  #letters .bar button { width: 16px; height: 16px; line-height: 14px; font-size: 13px; padding: 0; border: 1px solid #fff; color: #fff; background: none; cursor: pointer; }
  #letters form, #letters .done { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; }
  #letters p { margin: 0; font-size: 13px; line-height: 1.5; }
  #letters label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; opacity: .75; }
  #letters input { font: inherit; font-size: 15px; color: #1d1a5e; background: #fff; border: 1px solid #1d1a5e; padding: 7px 9px; border-radius: 0; width: 100%; box-sizing: border-box; }
  #letters input:focus { outline: 2px solid #00b4ff; outline-offset: 1px; }
  #letters .trap { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
  #letters button[type=submit] { align-self: flex-start; font: inherit; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #1d1a5e;
    background: #fff; border: 1px solid #1d1a5e; box-shadow: 3px 3px 0 #1d1a5e; padding: 7px 14px; cursor: pointer; margin-top: 2px; }
  #letters button[type=submit]:hover { background: #1d1a5e; color: #fff; }
  #letters button[type=submit]:active { transform: translate(3px, 3px); box-shadow: none; }
  #letters button[disabled] { opacity: .5; pointer-events: none; }
  #letters .why { font-size: 12px; color: #d4145a; }
  #letters .why:empty, #letters .check:empty { display: none; }
  /* phones: sit near the top, so the keyboard never covers the bottom */
  @media (max-width: 600px) { #letters { top: 12px; transform: translateX(-50%); } }
  #letters .small { font-size: 11px; opacity: .7; }
  #letters .done p.big { font-size: 16px; }`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const win = document.createElement('section');
  win.id = 'letters'; win.hidden = true; win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'subscribe');
  win.innerHTML = `
    <div class="bar"><span>letters.exe</span><button type="button" class="x" aria-label="close">×</button></div>
    <form novalidate>
      <p>leave your name and email and scorsby will write when something interesting happens ♥</p>
      <label for="letters-name">name</label>
      <input id="letters-name" name="name" maxlength="60" autocomplete="name" placeholder="glonk" required>
      <label for="letters-email">email</label>
      <input id="letters-email" name="email" type="email" maxlength="254" autocomplete="email" placeholder="glonk@example.com" required>
      <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="check"></div>
      <p class="why" aria-live="polite"></p>
      <button type="submit">subscribe</button>
      <p class="small">only letters from scorsby. never shared.<br>reply any time to be taken off.</p>
    </form>
    <div class="done" hidden><p class="big"></p><p class="small">you can close this window.</p></div>`;
  document.body.appendChild(win);

  const form = win.querySelector('form'), why = win.querySelector('.why'), send = win.querySelector('button[type=submit]');
  const done = win.querySelector('.done'), checkBox = win.querySelector('.check');
  let openedAt = 0, token = '', widget = null;

  // the person check: cloudflare's turnstile, loaded only when the window first opens
  function startCheck() {
    if (!SITEKEY || widget !== null) return;
    widget = false;
    const go = () => { widget = window.turnstile.render(checkBox, { sitekey: SITEKEY, appearance: 'interaction-only', callback: (t) => { token = t; }, 'expired-callback': () => { token = ''; } }); };
    if (window.turnstile) return go();
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.onload = go;
    document.head.appendChild(sc);
  }

  function open() {
    win.hidden = false; openedAt = performance.now(); why.textContent = '';
    startCheck();
    // on a phone, focusing a field pops the keyboard up over the window, so only focus on a computer
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => (done.hidden ? win.querySelector('#letters-name') : win.querySelector('.x')).focus(), 30);
  }
  const close = () => { win.hidden = true; if (location.hash === '#subscribe') history.replaceState(null, '', location.pathname + location.search); };

  win.querySelector('.x').addEventListener('click', close);
  // dragged by its title bar like the world's windows: anywhere on a computer, up and down on a phone, never off the page
  {
    const bar = win.querySelector('.bar');
    bar.style.cursor = 'grab'; bar.style.touchAction = 'none';
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, phone = innerWidth < 600;
      const keep = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      Object.assign(win.style, { left: `${r.left}px`, top: `${r.top}px`, transform: 'none' });
      bar.setPointerCapture(e.pointerId); bar.style.cursor = 'grabbing';
      const move = (ev) => {
        if (!phone) win.style.left = `${keep(ev.clientX - dx, 0, innerWidth - win.offsetWidth - 4)}px`;
        win.style.top = `${keep(ev.clientY - dy, 0, innerHeight - win.offsetHeight - 4)}px`;
      };
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); bar.style.cursor = 'grab'; };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !win.hidden) close(); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-subscribe], a[href="#subscribe"]');
    if (a) { e.preventDefault(); open(); return; }
    if (!win.hidden && !win.contains(e.target)) close();
  }, true);
  if (location.hash === '#subscribe') addEventListener('load', open);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim(), email = form.email.value.trim();
    if (!name) { why.textContent = 'what should we call you?'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { why.textContent = "that email doesn't look quite right."; return; }
    if (SITEKEY && !token) { why.textContent = 'one moment, checking you are a person…'; return; }
    send.disabled = true; why.textContent = '';
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, website: form.website.value, ms: Math.round(performance.now() - openedAt), token }) });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.ok) {
        form.hidden = true; done.hidden = false;
        done.querySelector('.big').textContent = `many blessings, friend :-)`;
      } else {
        why.textContent = out.why || 'something went wrong. try again soon?';
        if (widget && window.turnstile) { window.turnstile.reset(widget); token = ''; }
      }
    } catch {
      why.textContent = "couldn't reach scorsby just now. try again soon?";
    }
    send.disabled = false;
  });
})();
