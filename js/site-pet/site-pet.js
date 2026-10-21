function createSitePet(gfx, opts = {}) {
  if (!gfx) gfx = 'sprite';

  const ANI = {
    IDEL1: 0, IDEL2: 1, IDEL3: 2,
    RIGHT: 3, DOWN: 4, LEFT: 5, UP: 6,
    PET: 7, SLEEP: 8
  };

  const ele = document.createElement("div");
  ele.style.position = 'fixed';
  ele.style.width = '64px';
  ele.style.height = '64px';
  ele.style.backgroundImage = `url(/js/site-pet/gfx/${gfx}.png?v=4)`;
  ele.style.backgroundRepeat = 'no-repeat';
  ele.style.backgroundPosition = '0px 0px';
  ele.style.imageRendering = 'pixelated';
  ele.style.zIndex = '0'; // behind the words, covers and buttons (in front of the plain page), so it never covers what you're reading
  document.body.appendChild(ele);

  const MaxFrame = 8;
  const tick = 150 + Math.random() * 100; // each one walks at its own pace
  let anim = 0, frame = 0, sleep = 0, moving = false;

  // Spawn off-screen
  const side = opts.side || (Math.random() < 0.5 ? 'left' : 'right');
  let y = Math.floor((opts.y ?? Math.random() * (window.innerHeight - 64)) / 64) * 64;
  let x = side === 'left' ? -64 : window.innerWidth;

  // where it is, and where it's walking to. each step glides there over the time its walk takes (8 frames),
  // drawn every animation frame, so it never jumps (and simply waits while the tab is hidden)
  const step = { fx: x, fy: y, at: 0, dur: 1 };
  const place = (px, py) => { ele.style.left = `${px}px`; ele.style.top = `${py}px`; };
  const here = (now = performance.now()) => {
    const k = Math.min(1, (now - step.at) / step.dur);
    return [step.fx + (x - step.fx) * k, step.fy + (y - step.fy) * k];
  };
  // being petted: two little happy hops
  let hopAt = -1e9;
  const hop = (now) => { const t = (now - hopAt) / 700; return t < 1 ? -7 * Math.abs(Math.sin(t * Math.PI * 2)) : 0; };
  const glide = (now) => { const [px, py] = here(now); place(px, py + hop(now)); requestAnimationFrame(glide); };
  place(x, y);
  requestAnimationFrame(glide);

  anim = side === 'left' ? ANI.RIGHT : ANI.LEFT;

  const setAnim = a => { frame = 0; anim = a; };
  // (the sleep row's last drawing belongs second, so the breathing loops without a flicker at the seam)
  const SLEEP_ORDER = [0, 7, 1, 2, 3, 4, 5, 6];
  const draw = () => {
    const col = anim === ANI.SLEEP ? SLEEP_ORDER[frame % MaxFrame] : frame;
    ele.style.backgroundPosition = `${-64 * col}px ${-64 * anim}px`;
  };

  let petting = 0; // the petting plays on its own quicker clock, and walking waits for it
  const update = () => {
    if (petting) return;
    // the next step is chosen before drawing, so a new direction shows the moment it starts moving that way
    if (frame >= MaxFrame) {
      moving = false;
      if (sleep > 0) {
        sleep--;
        setAnim(ANI.SLEEP);
      } else if (anim !== ANI.PET && anim !== ANI.SLEEP && Math.random() < 0.04) {
        // now and then, left to itself, it curls up for a little doze (about 10 to 25 seconds)
        sleep = 6 + Math.floor(Math.random() * 9);
        setAnim(ANI.SLEEP);
      } else {
        // Random movement after initial spawn
        let d = Math.floor(Math.random() * 4);
        let sx = 0, sy = 0, a;

        if (d === 0) { sx = 64; a = ANI.RIGHT; }
        else if (d === 1) { sx = -64; a = ANI.LEFT; }
        else if (d === 2) { sy = 64; a = ANI.DOWN; }
        else { sy = -64; a = ANI.UP; }

        // Prevent edge teleporting
        if (x + sx < 0) { sx = 64; a = ANI.RIGHT; }
        else if (x + sx > window.innerWidth - 64) { sx = -64; a = ANI.LEFT; }
        if (y + sy < 0) { sy = 64; a = ANI.DOWN; }
        else if (y + sy > window.innerHeight - 64) { sy = -64; a = ANI.UP; }

        const now = performance.now();
        [step.fx, step.fy] = here(now);
        step.at = now; step.dur = tick * MaxFrame;
        x += sx;
        y += sy;
        moving = true;
        setAnim(a);
      }
    }
    draw();
    frame++;
    ele.style.cursor = 'pointer';
  };

  setInterval(update, tick);

  // petting: it stops right where it is (even mid-step, or waking from a doze) and enjoys it
  ele.addEventListener('click', () => {
    if (petting) return;
    if (moving) {
      [x, y] = here();
      step.fx = x; step.fy = y;
      moving = false;
    }
    sleep = 0;
    // forward through the petting, then back to the start, quickly
    const SEQ = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0];
    anim = ANI.PET; let i = 0;
    const play = () => {
      frame = SEQ[i]; draw();
      if (++i < SEQ.length) return;
      clearInterval(petting); petting = 0;
      frame = MaxFrame; // (and then on its way)
    };
    clearInterval(petting); petting = setInterval(play, 80); play();
    hopAt = performance.now();
    for (let i = 0; i < 3; i++) setTimeout(() => heart(ele), i * 260);
  });

  return ele;
}

// a little pixel heart that floats up from a petted scorsby's head and fades
const HEART_SVG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 6" shape-rendering="crispEdges"><path fill="#ff4f8b" d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/><path fill="#fff" d="M1 1h1v1H1z"/></svg>');
function heart(pet) {
  const r = pet.getBoundingClientRect();
  const h = document.createElement('img');
  h.src = HEART_SVG; h.alt = '';
  const x = r.left + 22 + (Math.random() - 0.5) * 26, y = r.top + 2;
  h.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:14px;height:12px;image-rendering:pixelated;pointer-events:none;z-index:0;transition:transform 1100ms ease-out, opacity 1100ms ease-in;`;
  document.body.appendChild(h);
  requestAnimationFrame(() => requestAnimationFrame(() => { h.style.transform = `translate(${(Math.random() - 0.5) * 16}px, -34px)`; h.style.opacity = '0'; }));
  setTimeout(() => h.remove(), 1200);
}

function generateScorsbys() {
  for (let i = 0; i < 5; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const y = Math.random() * (64 + window.innerHeight - 64);
    createSitePet('example', { side, y });
  }
}
